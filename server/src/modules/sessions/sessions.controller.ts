import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { generateSecureOtp, hashOtp, generateSessionCode } from '../../utils/crypto.js';
import { cacheService } from '../../utils/cache.js';

export const sessionsRouter = Router();

/**
 * GET /api/v1/sessions
 * List attendance sessions with summary metrics
 */
sessionsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query;
    const isTeacher = req.user?.role === 'TEACHER' || req.user?.role === 'ADMIN';

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        ...(isTeacher && req.user?.teacherId ? { teacherId: req.user.teacherId } : {}),
        ...(status ? { status: String(status) } : {})
      },
      include: {
        subject: true,
        division: {
          include: {
            _count: { select: { enrollments: true } }
          }
        },
        classroom: true,
        teacher: true,
        attendanceRecords: true,
        erpBatches: true
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(parseInt(String(limit)) || 50, 100)
    });

    const formatted = sessions.map((s) => {
      const totalEnrolled = s.division._count?.enrollments || 0;
      const presentCount = s.attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'MANUAL_OVERRIDE').length;
      const absentCount = Math.max(0, totalEnrolled - presentCount);
      const percentage = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 1000) / 10 : 0;
      const isSynced = s.erpBatches.some(b => b.status === 'SYNCED') || s.attendanceRecords.some(r => r.isErpSynced);

      return {
        id: s.id,
        sessionCode: s.sessionCode,
        status: s.status,
        startedAt: s.startedAt,
        closedAt: s.closedAt,
        expiresAt: s.otpExpiresAt,
        durationSeconds: s.durationSeconds,
        subject: s.subject,
        division: s.division,
        classroom: s.classroom,
        teacher: {
          fullName: s.teacher.fullName,
          teacherCode: s.teacher.teacherCode
        },
        stats: {
          totalEnrolled,
          presentCount,
          absentCount,
          attendancePercentage: percentage
        },
        isErpSynced: isSynced
      };
    });

    res.json({ sessions: formatted });
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ message: 'Failed to fetch attendance sessions' });
  }
});

/**
 * POST /api/v1/sessions
 * Teacher initiates an attendance session
 */
sessionsRouter.post('/', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { subjectId, divisionId, batchId, classroomId, durationMinutes, durationSeconds } = req.body;

    if (!subjectId || !divisionId || !classroomId) {
      return res.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Validation Error',
        status: 400,
        detail: 'Subject, Division, and Classroom are required to start an attendance session.'
      });
    }

    // Ensure classroom exists, is active, and has configured location
    const classroom = await prisma.classroom.findUnique({ 
      where: { id: classroomId },
      include: { device: true }
    });
    if (!classroom || !classroom.isActive) {
      return res.status(404).json({ message: 'Selected classroom is not active or does not exist.' });
    }

    if (!classroom.latitude || !classroom.longitude) {
      return res.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Classroom Location Unconfigured',
        status: 400,
        message: 'Classroom location has not been configured.'
      });
    }

    // Verify cohort has enrolled students
    const enrolledStudentsCount = await prisma.studentEnrollment.count({
      where: {
        divisionId,
        isActive: true,
        ...(batchId ? { batchId } : {})
      }
    });

    if (enrolledStudentsCount === 0) {
      return res.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'No Enrolled Students',
        status: 400,
        message: 'Attendance cannot be started because this subject has no enrolled students.'
      });
    }

    // Teacher ID resolution
    let teacherId = req.user?.teacherId;
    if (!teacherId && req.user?.role === 'ADMIN') {
      const defaultTeacher = await prisma.teacher.findFirst();
      teacherId = defaultTeacher?.id;
    }

    if (!teacherId) {
      return res.status(400).json({ 
        message: 'Attendance cannot be started because no faculty account is assigned or found.' 
      });
    }

    // Teacher assignment validation (if assignments configured for this teacher)
    if (req.user?.role === 'TEACHER' && req.user.teacherId) {
      const teacherAssignmentsCount = await prisma.teacherAssignment.count({
        where: { teacherId: req.user.teacherId }
      });
      if (teacherAssignmentsCount > 0) {
        const hasAssignment = await prisma.teacherAssignment.findFirst({
          where: {
            teacherId: req.user.teacherId,
            subjectId,
            divisionId,
            OR: [
              { batchId: null },
              { batchId: batchId || undefined }
            ]
          }
        });
        if (!hasAssignment) {
          return res.status(403).json({
            message: 'You are not assigned to conduct attendance for this subject and division.'
          });
        }
      }
    }

    // Auto-close any previous active sessions created by this teacher for this division and batch
    const existingActive = await prisma.attendanceSession.findMany({
      where: {
        teacherId,
        divisionId,
        batchId: batchId || null,
        status: 'ACTIVE'
      }
    });

    for (const oldSession of existingActive) {
      await prisma.attendanceSession.update({
        where: { id: oldSession.id },
        data: { status: 'CLOSED', closedAt: new Date() }
      });
      cacheService.closeSession(oldSession.id);
    }

    // Generate cryptographic OTP and session code
    const rawOtp = generateSecureOtp();
    const otpHash = hashOtp(rawOtp);
    const sessionCode = generateSessionCode();
    const dur = durationMinutes !== undefined 
      ? parseInt(durationMinutes, 10) * 60 
      : (parseInt(durationSeconds, 10) || 300);
    const duration = Math.max(30, Math.min(dur, 3600)); // 30s to 1 hr
    const expiresAt = new Date(Date.now() + duration * 1000);

    const session = await prisma.attendanceSession.create({
      data: {
        sessionCode,
        teacherId,
        subjectId,
        divisionId,
        batchId: batchId || null,
        classroomId,
        otpHash,
        otpExpiresAt: expiresAt,
        durationSeconds: duration,
        status: 'ACTIVE',
        verificationLayers: 'GPS_DEVICE_BIOMETRIC',
      },
      include: {
        subject: true,
        division: true,
        batch: true,
        classroom: {
          include: { device: true }
        },
        teacher: true,
      },
    });

    // Populate active cache entry
    cacheService.setSession(session.id, {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      teacherId: session.teacherId,
      classroomId: session.classroomId,
      divisionId: session.divisionId,
      subjectId: session.subjectId,
      rawOtp,
      otpHash,
      expiresAt,
      status: 'ACTIVE'
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        sessionId: session.id,
        entityName: 'AttendanceSession',
        entityId: session.id,
        action: 'SESSION_START',
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        details: JSON.stringify({
          sessionCode,
          classroom: classroom.roomCode,
          radius: classroom.allowedRadiusMeters,
          durationSeconds: duration
        }),
        ipAddress: req.ip
      }
    });

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        sessionCode: session.sessionCode,
        rawOtp, // Explicitly exposed to teacher for classroom projector / screen display
        expiresAt: session.otpExpiresAt,
        durationSeconds: session.durationSeconds,
        status: session.status,
        subject: {
          id: session.subject.id,
          code: session.subject.code,
          name: session.subject.name
        },
        division: {
          id: session.division.id,
          name: session.division.name
        },
        classroom: {
          id: session.classroom.id,
          roomCode: session.classroom.roomCode,
          buildingName: session.classroom.buildingName,
          floorNumber: session.classroom.floorNumber,
          latitude: session.classroom.latitude,
          longitude: session.classroom.longitude,
          allowedRadiusMeters: session.classroom.allowedRadiusMeters,
          hardwareBeaconId: session.classroom.hardwareBeaconId,
          device: session.classroom.device
        }
      }
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Failed to create attendance session' });
  }
});

/**
 * GET /api/v1/sessions/:id
 * Get session details and active statistics
 */
sessionsRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: req.params.id },
      include: {
        subject: true,
        division: true,
        classroom: {
          include: { device: true }
        },
        teacher: true,
        attendanceRecords: {
          include: {
            student: true
          },
          orderBy: { markedAt: 'desc' }
        },
        _count: {
          select: { attendanceRecords: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Attendance session not found' });
    }

    const cached = cacheService.getSession(session.id);
    const isTeacher = req.user?.role === 'TEACHER' || req.user?.role === 'ADMIN';

    // Auto-update DB status if cached expired
    let currentStatus = session.status;
    if (session.status === 'ACTIVE' && new Date() > session.otpExpiresAt) {
      currentStatus = 'EXPIRED';
      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' }
      });
    }

    const presentRecords = session.attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'MANUAL_OVERRIDE');
    const rejectedRecords = session.attendanceRecords.filter(r => r.status === 'REJECTED');

    res.json({
      session: {
        id: session.id,
        sessionCode: session.sessionCode,
        status: currentStatus,
        startedAt: session.startedAt,
        closedAt: session.closedAt,
        expiresAt: session.otpExpiresAt,
        durationSeconds: session.durationSeconds,
        // Raw OTP only visible to Teacher/Admin
        ...(isTeacher && cached ? { rawOtp: cached.rawOtp } : {}),
        subject: session.subject,
        division: session.division,
        classroom: session.classroom,
        teacher: {
          fullName: session.teacher.fullName,
          teacherCode: session.teacher.teacherCode
        },
        stats: {
          presentCount: presentRecords.length,
          rejectedCount: rejectedRecords.length,
          totalSubmissions: session.attendanceRecords.length
        },
        records: isTeacher ? session.attendanceRecords.map(r => ({
          id: r.id,
          studentPrn: r.studentPrn,
          studentName: r.student.fullName,
          rollNumber: r.student.rollNumber,
          status: r.status,
          failureReason: r.failureReason,
          distanceMeters: r.computedDistanceMeters,
          markedAt: r.markedAt
        })) : []
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

/**
 * GET /api/v1/sessions/:id/roster
 * Teacher views live attendance roster for a session
 */
sessionsRouter.get('/:id/roster', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: req.params.id },
      include: {
        subject: true,
        division: true,
        classroom: true,
        teacher: true,
        attendanceRecords: {
          include: { student: true },
          orderBy: { markedAt: 'desc' }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        divisionId: session.divisionId,
        isActive: true,
        OR: [
          { batchId: null },
          { batchId: session.batchId || undefined }
        ]
      },
      include: { student: true }
    });

    const recordsMap = new Map(session.attendanceRecords.map(r => [r.studentPrn, r]));
    const students = enrollments.map(enr => {
      const rec = recordsMap.get(enr.studentPrn);
      return {
        student: {
          prn: enr.studentPrn,
          fullName: enr.student.fullName,
          rollNumber: enr.student.rollNumber
        },
        status: rec?.status || 'ABSENT',
        markedAt: rec?.markedAt || null,
        distanceMeters: rec?.computedDistanceMeters || null
      };
    });

    const presentCount = students.filter(s => s.status === 'PRESENT' || s.status === 'MANUAL_OVERRIDE').length;

    res.json({
      session: {
        id: session.id,
        status: session.status,
        subject: session.subject,
        division: session.division,
        classroom: session.classroom,
        presentCount,
        totalEligible: students.length,
        students
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch session roster' });
  }
});

/**
 * POST /api/v1/sessions/:id/close
 * Teacher manually terminates an active session
 */
sessionsRouter.post('/:id/close', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const updated = await prisma.attendanceSession.update({
      where: { id: req.params.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    cacheService.closeSession(session.id);

    await prisma.auditLog.create({
      data: {
        sessionId: session.id,
        entityName: 'AttendanceSession',
        entityId: session.id,
        action: 'SESSION_CLOSE',
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        details: JSON.stringify({ closedAt: updated.closedAt }),
        ipAddress: req.ip
      }
    });

    res.json({ success: true, status: 'CLOSED', session: updated, closedAt: updated.closedAt });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to close session' });
  }
});

/**
 * POST /api/v1/sessions/:id/rotate-otp
 * Teacher generates a fresh dynamic OTP during an active session
 */
sessionsRouter.post('/:id/rotate-otp', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
    if (!session || session.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Cannot rotate OTP for an inactive or closed session.' });
    }

    const rawOtp = generateSecureOtp();
    const otpHash = hashOtp(rawOtp);

    await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { otpHash }
    });

    const cached = cacheService.getSession(session.id);
    if (cached) {
      cached.rawOtp = rawOtp;
      cached.otpHash = otpHash;
      cacheService.setSession(session.id, cached);
    }

    res.json({ success: true, rawOtp });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to rotate OTP' });
  }
});

/**
 * GET /api/v1/sessions/active/for-student
 * Student queries active session available for their enrolled division
 */
sessionsRouter.get('/active/for-student', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.prn) {
      return res.status(403).json({ message: 'Only authenticated students can query student active sessions.' });
    }

    // Find student's active enrollment
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentPrn: req.user.prn, isActive: true },
      include: { division: true, batch: true }
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'No active division enrollment found for student.' });
    }

    // Find all active sessions for division & batch
    const activeSessions = await prisma.attendanceSession.findMany({
      where: {
        divisionId: enrollment.divisionId,
        status: 'ACTIVE',
        otpExpiresAt: { gt: new Date() },
        OR: [
          { batchId: null },
          { batchId: enrollment.batchId || undefined }
        ]
      },
      include: {
        subject: true,
        division: true,
        batch: true,
        classroom: {
          include: { device: true }
        },
        teacher: true,
      },
      orderBy: { startedAt: 'desc' }
    });

    if (!activeSessions || activeSessions.length === 0) {
      return res.json({ hasActiveSession: false, activeSessions: [], session: null });
    }

    const formattedSessions = await Promise.all(
      activeSessions.map(async (sess) => {
        const existingRecord = await prisma.attendanceRecord.findUnique({
          where: {
            sessionId_studentPrn: {
              sessionId: sess.id,
              studentPrn: req.user!.prn!
            }
          }
        });

        const isMarked = existingRecord?.status === 'PRESENT' || existingRecord?.status === 'MANUAL_OVERRIDE';

        return {
          id: sess.id,
          sessionCode: sess.sessionCode,
          startedAt: sess.startedAt,
          expiresAt: sess.otpExpiresAt,
          durationSeconds: sess.durationSeconds,
          subject: {
            code: sess.subject.code,
            name: sess.subject.name
          },
          division: {
            name: sess.division.name
          },
          batch: sess.batch ? { name: sess.batch.name } : null,
          classroom: {
            roomCode: sess.classroom.roomCode,
            buildingName: sess.classroom.buildingName,
            floorNumber: sess.classroom.floorNumber,
            allowedRadiusMeters: sess.classroom.allowedRadiusMeters,
            device: sess.classroom.device,
          },
          teacher: {
            fullName: sess.teacher.fullName
          },
          alreadyMarked: isMarked,
          existingRecord: existingRecord ? {
            status: existingRecord.status,
            markedAt: existingRecord.markedAt,
            distanceMeters: existingRecord.computedDistanceMeters,
            failureReason: existingRecord.failureReason
          } : null
        };
      })
    );

    const primarySession = formattedSessions[0];

    res.json({
      hasActiveSession: true,
      activeSessions: formattedSessions,
      // Backwards compatibility for single session consumers
      alreadyMarked: primarySession?.alreadyMarked || false,
      existingRecord: primarySession?.existingRecord || null,
      session: primarySession || null
    });
  } catch (error: any) {
    console.error('Error fetching student active session:', error);
    res.status(500).json({ message: 'Failed to fetch student active session' });
  }
});

/**
 * GET /api/v1/sessions/:id/live
 * Server-Sent Events (SSE) stream for Teacher Dashboard
 */
sessionsRouter.get('/:id/live', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Set SSE HTTP response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable proxy buffering
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  // Listener for live attendance punches
  const punchListener = (data: any) => {
    res.write(`event: punch\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Listener for session status changes
  const statusListener = (data: any) => {
    res.write(`event: status\ndata: ${JSON.stringify(data)}\n\n`);
  };

  cacheService.eventEmitter.on(`session:${sessionId}:punch`, punchListener);
  cacheService.eventEmitter.on(`session:${sessionId}:status`, statusListener);

  // Heartbeat ping every 15s to keep connection alive through campus proxies
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    cacheService.eventEmitter.off(`session:${sessionId}:punch`, punchListener);
    cacheService.eventEmitter.off(`session:${sessionId}:status`, statusListener);
    res.end();
  });
});
