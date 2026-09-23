import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { hashOtp, timingSafeCompare, generateAttendanceReceiptHash } from '../../utils/crypto.js';
import { evaluateGeofence } from '../../utils/haversine.js';
import { cacheService } from '../../utils/cache.js';
import { ClassroomPresenceProvider } from './presence.provider.js';
import { IdentityAuthenticationProvider } from './identity.provider.js';

export const attendanceRouter = Router();

/**
 * POST /api/v1/attendance/submit
 * Authoritative Student Verification Endpoint
 * Requires:
 * 1. PRN login (Authenticated User)
 * 2. Classroom Presence: Valid GPS inside Classroom Radius + Active Classroom Device (ESP32/BLE)
 * 3. Phone Biometric Authentication (Face / Touch ID / WebAuthn with development simulation)
 */
attendanceRouter.post('/submit', authenticate, requireRole(['STUDENT']), async (req: Request, res: Response) => {
  const studentPrn = req.user?.prn;

  if (!studentPrn) {
    return res.status(403).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Forbidden',
      status: 403,
      detail: 'Student PRN identity is missing.'
    });
  }

  const { sessionId, latitude, longitude, accuracy, devicePayload, otp } = req.body;
  const authPayload = req.body.authPayload || (req.body.webauthnResponse ? {
    type: 'WEBAUTHN',
    webauthnResponse: req.body.webauthnResponse,
    credentialId: req.body.webauthnResponse?.id
  } : req.body.webauthnPayload ? {
    type: 'WEBAUTHN',
    webauthnResponse: req.body.webauthnPayload,
    credentialId: req.body.webauthnPayload?.id
  } : undefined);

  // 1. Payload validation (Location coordinates and Session ID are mandatory)
  if (!sessionId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: 400,
      detail: 'Session ID, latitude, and longitude are required.'
    });
  }

  const parsedLat = parseFloat(latitude);
  const parsedLon = parseFloat(longitude);
  const parsedAccuracy = accuracy !== undefined ? parseFloat(accuracy) : 10.0;

  if (isNaN(parsedLat) || isNaN(parsedLon)) {
    return res.status(400).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Invalid Coordinates',
      status: 400,
      detail: 'Geographical coordinates must be valid floating point numbers.'
    });
  }

  // 2. Sliding Window Rate Limiting
  const rateLimitKey = `ratelimit:punch:${studentPrn}:${sessionId}`;
  const rateCheck = cacheService.checkRateLimit(rateLimitKey, 10, 60);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Too Many Requests',
      status: 429,
      detail: `Too many attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`
    });
  }

  try {
    // 3. Fetch Session & Classroom from DB
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        classroom: true,
        division: true,
        subject: true,
      }
    });

    if (!session) {
      return res.status(404).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Session Not Found',
        status: 404,
        detail: 'The specified attendance session does not exist.'
      });
    }

    // 4. Check Session Expiration & Status
    const now = new Date();
    if (session.status !== 'ACTIVE' || now > session.otpExpiresAt) {
      // Record rejected attempt in audit
      return res.status(410).json({
        status: 'REJECTED',
        code: 'SESSION_EXPIRED',
        message: 'This attendance session is no longer active or has expired.'
      });
    }

    // 5. Check Student Enrollment Eligibility
    let enrollment = await prisma.studentEnrollment.findUnique({
      where: {
        studentPrn_divisionId_academicYear: {
          studentPrn,
          divisionId: session.divisionId,
          academicYear: session.division.academicYear
        }
      },
      include: { student: true }
    });

    if (!enrollment) {
      enrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentPrn,
          divisionId: session.divisionId,
          isActive: true
        },
        include: { student: true }
      });
    }

    if (!enrollment || !enrollment.isActive) {
      return res.status(403).json({
        status: 'REJECTED',
        code: 'NOT_ENROLLED',
        message: 'You are not enrolled in the academic division assigned to this session.'
      });
    }

    // Check Batch eligibility if session is restricted to a specific batch
    if (session.batchId && enrollment.batchId && enrollment.batchId !== session.batchId) {
      return res.status(403).json({
        status: 'REJECTED',
        code: 'BATCH_MISMATCH',
        message: 'You are not enrolled in the specific batch assigned to this session.'
      });
    }

    // 6. Duplicate Attendance Check
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentPrn: {
          sessionId,
          studentPrn
        }
      }
    });

    if (existingRecord && (existingRecord.status === 'PRESENT' || existingRecord.status === 'MANUAL_OVERRIDE')) {
      return res.status(409).json({
        status: 'ALREADY_MARKED',
        code: 'ALREADY_MARKED',
        message: 'Your attendance has already been successfully recorded for this session.',
        markedAt: existingRecord.markedAt,
        distanceMeters: existingRecord.computedDistanceMeters
      });
    }

    // 7. Layer 2: Classroom Presence Verification (GPS + Classroom Device ESP32/BLE)
    const presenceResult = await ClassroomPresenceProvider.verifyPresence({
      sessionId,
      classroomId: session.classroomId,
      studentPrn,
      studentCoords: {
        latitude: parsedLat,
        longitude: parsedLon,
        accuracy: parsedAccuracy
      },
      devicePayload
    });

    if (!presenceResult.verified) {
      const failureReason = !presenceResult.gpsVerified ? 'OUTSIDE_GEOFENCE' : (presenceResult.status || 'DEVICE_NOT_FOUND');
      
      await prisma.attendanceRecord.upsert({
        where: { sessionId_studentPrn: { sessionId, studentPrn } },
        create: {
          sessionId,
          studentPrn,
          status: 'REJECTED',
          failureReason,
          submittedLatitude: parsedLat,
          submittedLongitude: parsedLon,
          computedDistanceMeters: presenceResult.distanceMeters,
          gpsAccuracyMeters: parsedAccuracy,
          deviceId: presenceResult.device?.deviceId || null,
          deviceVerified: presenceResult.deviceVerified,
          clientIp: req.ip,
          userAgent: req.headers['user-agent']
        },
        update: {
          status: 'REJECTED',
          failureReason,
          submittedLatitude: parsedLat,
          submittedLongitude: parsedLon,
          computedDistanceMeters: presenceResult.distanceMeters,
          gpsAccuracyMeters: parsedAccuracy,
          deviceId: presenceResult.device?.deviceId || null,
          deviceVerified: presenceResult.deviceVerified
        }
      });

      cacheService.publishAttendancePunch(sessionId, {
        prn: studentPrn,
        studentName: enrollment.student.fullName,
        rollNumber: enrollment.student.rollNumber,
        markedAt: new Date().toISOString(),
        distanceMeters: presenceResult.distanceMeters,
        status: 'REJECTED',
        failureReason: presenceResult.message
      });

      return res.status(422).json({
        status: 'REJECTED',
        code: failureReason,
        message: presenceResult.message,
        distanceMeters: presenceResult.distanceMeters,
        allowedRadiusMeters: presenceResult.allowedRadiusMeters,
        device: presenceResult.device
      });
    }

    // 8. Layer 3: Phone Biometric Authentication Verification
    let authVerificationMode = 'GPS_BIOMETRIC';
    let biometricType = 'FINGERPRINT';

    if (authPayload) {
      const authResult = await IdentityAuthenticationProvider.verifyIdentity({
        studentPrn,
        userId: req.user!.userId,
        sessionId,
        authPayload
      });

      if (!authResult.verified) {
        return res.status(401).json({
          status: 'REJECTED',
          code: 'BIOMETRIC_FAILED',
          message: authResult.message
        });
      }
      authVerificationMode = authResult.authMode === 'WEBAUTHN' ? 'GPS_WEBAUTHN' : 'GPS_BIOMETRIC';
      biometricType = authResult.biometricType;
    } else if (otp && session.otpHash && process.env.NODE_ENV !== 'production') {
      // Isolated development emergency fallback OTP check only in non-production
      const candidateHash = hashOtp(otp.trim());
      const isOtpValid = timingSafeCompare(candidateHash, session.otpHash);
      if (!isOtpValid) {
        return res.status(422).json({
          status: 'REJECTED',
          code: 'INVALID_OTP',
          message: 'The OTP entered is incorrect or expired.'
        });
      }
      authVerificationMode = 'GPS_OTP';
    } else {
      // Biometric authentication required by default
      return res.status(400).json({
        status: 'REJECTED',
        code: 'AUTH_REQUIRED',
        message: 'Phone biometric authentication is required to verify identity.'
      });
    }

    // 9. All Required Layers Verified! Commit PRESENT Attendance Record
    const markedAt = new Date();
    const record = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentPrn: { sessionId, studentPrn } },
      create: {
        sessionId,
        studentPrn,
        status: 'PRESENT',
        submittedLatitude: parsedLat,
        submittedLongitude: parsedLon,
        computedDistanceMeters: presenceResult.distanceMeters,
        gpsAccuracyMeters: parsedAccuracy,
        deviceId: presenceResult.device?.deviceId || null,
        deviceVerified: presenceResult.deviceVerified,
        biometricVerified: true,
        verificationMode: authVerificationMode,
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
        markedAt
      },
      update: {
        status: 'PRESENT',
        failureReason: null,
        submittedLatitude: parsedLat,
        submittedLongitude: parsedLon,
        computedDistanceMeters: presenceResult.distanceMeters,
        gpsAccuracyMeters: parsedAccuracy,
        deviceId: presenceResult.device?.deviceId || null,
        deviceVerified: presenceResult.deviceVerified,
        biometricVerified: true,
        verificationMode: authVerificationMode,
        markedAt
      }
    });

    // Reset rate limit on success
    cacheService.resetRateLimit(rateLimitKey);

    // Generate cryptographic receipt hash for student
    const receiptHash = generateAttendanceReceiptHash({
      studentPrn,
      sessionId,
      timestamp: markedAt.toISOString(),
      distanceMeters: presenceResult.distanceMeters
    });

    // Stream real-time punch event to teacher dashboard via SSE
    cacheService.publishAttendancePunch(sessionId, {
      prn: studentPrn,
      studentName: enrollment.student.fullName,
      rollNumber: enrollment.student.rollNumber,
      markedAt: markedAt.toISOString(),
      distanceMeters: presenceResult.distanceMeters,
      status: 'PRESENT'
    });

    return res.status(200).json({
      status: 'PRESENT',
      message: 'Attendance verified and recorded successfully!',
      data: {
        recordId: record.id,
        prn: studentPrn,
        studentName: enrollment.student.fullName,
        rollNumber: enrollment.student.rollNumber,
        subject: session.subject.name,
        classroom: session.classroom.roomCode,
        markedAt: markedAt.toISOString(),
        distanceMeters: presenceResult.distanceMeters,
        deviceId: presenceResult.device?.deviceId,
        biometricType,
        verificationMode: authVerificationMode,
        receiptHash
      }
    });
  } catch (error: any) {
    console.error('Attendance submission error:', error);
    return res.status(500).json({ message: 'Internal server error during verification.' });
  }
});

/**
 * POST /api/v1/attendance/manual-override
 * Teacher manually updates or marks student attendance with mandatory audit reason
 */
attendanceRouter.post('/manual-override', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { sessionId, studentPrn, status, reason } = req.body;

    if (!sessionId || !studentPrn || !status || !reason) {
      return res.status(400).json({
        message: 'Session ID, student PRN, status (PRESENT / ABSENT), and override reason are required.'
      });
    }

    const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const student = await prisma.student.findUnique({ where: { prn: studentPrn } });
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    let record;
    if (status === 'PRESENT') {
      record = await prisma.attendanceRecord.upsert({
        where: { sessionId_studentPrn: { sessionId, studentPrn } },
        create: {
          sessionId,
          studentPrn,
          status: 'MANUAL_OVERRIDE',
          verificationMode: 'MANUAL_OVERRIDE',
          failureReason: null,
          markedAt: new Date()
        },
        update: {
          status: 'MANUAL_OVERRIDE',
          failureReason: null,
          markedAt: new Date()
        }
      });
    } else {
      // Mark as rejected/absent
      record = await prisma.attendanceRecord.upsert({
        where: { sessionId_studentPrn: { sessionId, studentPrn } },
        create: {
          sessionId,
          studentPrn,
          status: 'REJECTED',
          failureReason: `MANUAL_OVERRIDE: ${reason}`,
          markedAt: new Date()
        },
        update: {
          status: 'REJECTED',
          failureReason: `MANUAL_OVERRIDE: ${reason}`
        }
      });
    }

    // Write immutable audit log
    await prisma.auditLog.create({
      data: {
        sessionId,
        entityName: 'AttendanceRecord',
        entityId: record.id,
        action: 'MANUAL_OVERRIDE',
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        details: JSON.stringify({
          studentPrn,
          newStatus: status,
          reason,
          timestamp: new Date().toISOString()
        }),
        ipAddress: req.ip
      }
    });

    // Notify teacher dashboard stream
    cacheService.publishAttendancePunch(sessionId, {
      prn: studentPrn,
      studentName: student.fullName,
      rollNumber: student.rollNumber,
      markedAt: new Date().toISOString(),
      distanceMeters: 0,
      status: status === 'PRESENT' ? 'PRESENT' : 'REJECTED',
      failureReason: `Manual: ${reason}`
    });

    res.json({ success: true, record, message: 'Attendance status overridden successfully.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to perform manual override.' });
  }
});

/**
 * POST /api/v1/attendance/verify-presence
 * Authoritative Preliminary Presence Verification (Layer 2: Physical GPS Geofence + ESP32 Classroom Device)
 */
attendanceRouter.post('/verify-presence', authenticate, requireRole(['STUDENT']), async (req: Request, res: Response) => {
  try {
    const { sessionId, latitude, longitude, accuracy, devicePayload } = req.body;

    if (!sessionId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Session ID, latitude, and longitude are required.' });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { classroom: { include: { device: true } } }
    });

    if (!session || session.status !== 'ACTIVE' || new Date() > session.otpExpiresAt) {
      return res.status(410).json({
        verified: false,
        status: 'SESSION_EXPIRED',
        message: 'This attendance session is no longer active.'
      });
    }

    const parsedLat = parseFloat(latitude);
    const parsedLon = parseFloat(longitude);
    const parsedAcc = accuracy !== undefined ? parseFloat(accuracy) : 10.0;

    if (parsedAcc > 35.0) {
      return res.status(422).json({
        verified: false,
        status: 'ACCURACY_TOO_LOW',
        message: 'GPS accuracy is too low for physical verification. Please ensure Wi-Fi is enabled to improve indoor location lock.',
        accuracy: parsedAcc,
        threshold: 35.0
      });
    }

    const presenceResult = await ClassroomPresenceProvider.verifyPresence({
      sessionId,
      classroomId: session.classroomId,
      studentPrn: req.user!.prn || '',
      studentCoords: { latitude: parsedLat, longitude: parsedLon, accuracy: parsedAcc },
      devicePayload
    });

    if (!presenceResult.verified) {
      return res.status(422).json({
        verified: false,
        status: presenceResult.status,
        message: presenceResult.message,
        distanceMeters: presenceResult.distanceMeters,
        allowedRadiusMeters: presenceResult.allowedRadiusMeters,
        classroom: session.classroom.roomCode,
        device: presenceResult.device
      });
    }

    return res.status(200).json({
      verified: true,
      status: 'PRESENCE_VERIFIED',
      message: "Classroom presence verified via GPS and Classroom Device.",
      distanceMeters: presenceResult.distanceMeters,
      allowedRadiusMeters: presenceResult.allowedRadiusMeters,
      classroom: session.classroom.roomCode,
      device: presenceResult.device
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to verify classroom presence.' });
  }
});

/**
 * POST /api/v1/attendance/verify-location
 * Authoritative Preliminary Geofence Verification (Step 6 in Student Flow)
 */
attendanceRouter.post('/verify-location', authenticate, requireRole(['STUDENT']), async (req: Request, res: Response) => {
  try {
    const { sessionId, latitude, longitude, accuracy } = req.body;

    if (!sessionId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Session ID, latitude, and longitude are required.' });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { classroom: { include: { device: true } } }
    });

    if (!session || session.status !== 'ACTIVE' || new Date() > session.otpExpiresAt) {
      return res.status(410).json({
        verified: false,
        status: 'SESSION_EXPIRED',
        message: 'This attendance session is no longer active.'
      });
    }

    const parsedLat = parseFloat(latitude);
    const parsedLon = parseFloat(longitude);
    const parsedAcc = accuracy !== undefined ? parseFloat(accuracy) : 10.0;

    if (parsedAcc > 35.0) {
      return res.status(422).json({
        verified: false,
        status: 'ACCURACY_TOO_LOW',
        message: 'GPS accuracy is too low for physical verification. Please ensure Wi-Fi is enabled to improve indoor location lock.',
        accuracy: parsedAcc,
        threshold: 35.0
      });
    }

    const studentCoords = { latitude: parsedLat, longitude: parsedLon };
    const classroomCoords = { latitude: session.classroom.latitude, longitude: session.classroom.longitude };
    const geofenceResult = evaluateGeofence(studentCoords, classroomCoords, session.classroom.allowedRadiusMeters);

    const device = session.classroom.device ? {
      id: session.classroom.device.id,
      deviceId: session.classroom.device.deviceId,
      bleIdentifier: session.classroom.device.bleIdentifier,
      status: session.classroom.device.status,
      isSimulated: true
    } : null;

    if (!geofenceResult.isInside) {
      return res.status(422).json({
        verified: false,
        status: 'OUTSIDE_CLASSROOM',
        message: 'Attendance rejected. You are outside the classroom attendance area.',
        distanceMeters: geofenceResult.distanceMeters,
        allowedRadiusMeters: geofenceResult.allowedRadiusMeters,
        classroom: session.classroom.roomCode,
        device
      });
    }

    return res.status(200).json({
      verified: true,
      status: 'LOCATION_VERIFIED',
      message: "You're within the classroom attendance zone.",
      distanceMeters: geofenceResult.distanceMeters,
      allowedRadiusMeters: geofenceResult.allowedRadiusMeters,
      classroom: session.classroom.roomCode,
      device
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to verify location coordinates' });
  }
});

/**
 * GET /api/v1/attendance/history
 * Student Personal Attendance History and Subject-Wise Metrics
 */
attendanceRouter.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const studentPrn = req.user?.prn;
    if (!studentPrn) {
      return res.status(403).json({ message: 'PRN identity is required for attendance history.' });
    }

    // Student's active enrollment
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentPrn, isActive: true }
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Active student enrollment not found.' });
    }

    // All sessions conducted for this student's division
    const sessions = await prisma.attendanceSession.findMany({
      where: { divisionId: enrollment.divisionId },
      include: {
        subject: true,
        classroom: true,
        teacher: true,
        attendanceRecords: {
          where: { studentPrn }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Compute subject stats
    const subjectMap = new Map<string, { code: string; name: string; conducted: number; attended: number }>();

    const history = sessions.map((sess) => {
      const rec = sess.attendanceRecords[0];
      const isPresent = rec && (rec.status === 'PRESENT' || rec.status === 'MANUAL_OVERRIDE');
      const isRejected = rec && rec.status === 'REJECTED';

      const status = isPresent
        ? rec.status
        : (isRejected ? 'REJECTED' : 'ABSENT');

      // Subject stats accumulation
      const subId = sess.subjectId;
      if (!subjectMap.has(subId)) {
        subjectMap.set(subId, {
          code: sess.subject.code,
          name: sess.subject.name,
          conducted: 0,
          attended: 0
        });
      }
      const stat = subjectMap.get(subId)!;
      stat.conducted += 1;
      if (isPresent) stat.attended += 1;

      return {
        sessionId: sess.id,
        sessionCode: sess.sessionCode,
        date: sess.startedAt.toISOString().split('T')[0],
        time: sess.startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        subjectCode: sess.subject.code,
        subjectName: sess.subject.name,
        classroom: sess.classroom.roomCode,
        teacherName: sess.teacher.fullName,
        status,
        distanceMeters: rec?.computedDistanceMeters ?? null,
        markedAt: rec?.markedAt?.toISOString() ?? null,
        failureReason: rec?.failureReason ?? null
      };
    });

    const totalConducted = history.length;
    const totalAttended = history.filter(h => h.status === 'PRESENT' || h.status === 'MANUAL_OVERRIDE').length;
    const overallPercentage = totalConducted > 0
      ? Math.round((totalAttended / totalConducted) * 1000) / 10
      : 0;

    const subjectStats = Array.from(subjectMap.values()).map(s => ({
      ...s,
      percentage: s.conducted > 0 ? Math.round((s.attended / s.conducted) * 1000) / 10 : 0
    }));

    res.json({
      summary: {
        totalConducted,
        totalAttended,
        overallPercentage
      },
      subjectStats,
      history
    });
  } catch (error: any) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ message: 'Failed to fetch attendance history.' });
  }
});
