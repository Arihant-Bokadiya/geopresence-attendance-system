import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

export const adminRouter = Router();

// Enforce ADMIN role on all admin routes
adminRouter.use(authenticate, requireRole(['ADMIN']));

// -------------------------------------------------------------
// 1. STATS OVERVIEW
// -------------------------------------------------------------
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalClassrooms,
      totalDivisions,
      totalBatches,
      activeSessionsCount,
      totalDevices
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.subject.count(),
      prisma.classroom.count(),
      prisma.division.count(),
      prisma.batch.count(),
      prisma.attendanceSession.count({ where: { status: 'ACTIVE' } }),
      prisma.classroomDevice.count()
    ]);

    res.json({
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalClassrooms,
      totalDivisions,
      totalBatches,
      activeSessionsCount,
      totalDevices
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch admin statistics', error: err.message });
  }
});

// -------------------------------------------------------------
// 2. DEPARTMENTS CRUD
// -------------------------------------------------------------
adminRouter.get('/departments', async (_req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { teachers: true, students: true, subjects: true, divisions: true }
        }
      },
      orderBy: { code: 'asc' }
    });
    res.json({ departments });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

adminRouter.post('/departments', async (req: Request, res: Response) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) {
      return res.status(400).json({ message: 'Department code and name are required.' });
    }

    const dept = await prisma.department.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim()
      }
    });

    res.status(201).json({ department: dept });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create department.' });
  }
});

adminRouter.put('/departments/:id', async (req: Request, res: Response) => {
  try {
    const { code, name } = req.body;
    const dept = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(name ? { name: name.trim() } : {})
      }
    });
    res.json({ department: dept });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update department.' });
  }
});

adminRouter.delete('/departments/:id', async (req: Request, res: Response) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Department deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete department with associated records.' });
  }
});

// -------------------------------------------------------------
// 3. CLASSROOMS CRUD (Part 9)
// -------------------------------------------------------------
adminRouter.get('/classrooms', async (_req: Request, res: Response) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      include: {
        device: true
      },
      orderBy: { roomCode: 'asc' }
    });
    res.json({ classrooms });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch classrooms' });
  }
});

adminRouter.post('/classrooms', async (req: Request, res: Response) => {
  try {
    const { roomCode, buildingName, floorNumber, latitude, longitude, allowedRadiusMeters, hardwareBeaconId, isActive } = req.body;

    if (!roomCode || !buildingName || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Room code, building, latitude, and longitude are required.' });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const radius = allowedRadiusMeters !== undefined ? parseFloat(allowedRadiusMeters) : 25.0;

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      return res.status(400).json({ message: 'Coordinates and radius must be valid numbers.' });
    }

    const classroom = await prisma.classroom.create({
      data: {
        roomCode: roomCode.trim().toUpperCase(),
        buildingName: buildingName.trim(),
        floorNumber: parseInt(floorNumber, 10) || 1,
        latitude: lat,
        longitude: lon,
        allowedRadiusMeters: radius,
        hardwareBeaconId: hardwareBeaconId ? hardwareBeaconId.trim() : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true
      }
    });

    res.status(201).json({ classroom });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create classroom. Room code may already exist.' });
  }
});

adminRouter.put('/classrooms/:id', async (req: Request, res: Response) => {
  try {
    const { roomCode, buildingName, floorNumber, latitude, longitude, allowedRadiusMeters, hardwareBeaconId, isActive } = req.body;

    const data: any = {};
    if (roomCode) data.roomCode = roomCode.trim().toUpperCase();
    if (buildingName) data.buildingName = buildingName.trim();
    if (floorNumber !== undefined) data.floorNumber = parseInt(floorNumber, 10);
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (allowedRadiusMeters !== undefined) data.allowedRadiusMeters = parseFloat(allowedRadiusMeters);
    if (hardwareBeaconId !== undefined) data.hardwareBeaconId = hardwareBeaconId ? hardwareBeaconId.trim() : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const classroom = await prisma.classroom.update({
      where: { id: req.params.id },
      data
    });

    res.json({ classroom });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update classroom.' });
  }
});

adminRouter.delete('/classrooms/:id', async (req: Request, res: Response) => {
  try {
    await prisma.classroom.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Classroom removed successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete classroom associated with attendance sessions. Deactivate it instead.' });
  }
});

// -------------------------------------------------------------
// 4. SUBJECTS CRUD (Part 10)
// -------------------------------------------------------------
adminRouter.get('/subjects', async (_req: Request, res: Response) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: { department: true },
      orderBy: { code: 'asc' }
    });
    res.json({ subjects });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

adminRouter.post('/subjects', async (req: Request, res: Response) => {
  try {
    const { code, name, departmentId, semester, credits, isActive } = req.body;

    if (!code || !name || !departmentId) {
      return res.status(400).json({ message: 'Subject code, name, and department are required.' });
    }

    const subject = await prisma.subject.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        departmentId,
        semester: parseInt(semester, 10) || 1,
        credits: parseInt(credits, 10) || 3,
        isActive: isActive !== undefined ? Boolean(isActive) : true
      },
      include: { department: true }
    });

    res.status(201).json({ subject });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create subject. Course code may already exist.' });
  }
});

adminRouter.put('/subjects/:id', async (req: Request, res: Response) => {
  try {
    const { code, name, departmentId, semester, credits, isActive } = req.body;
    const data: any = {};
    if (code) data.code = code.trim().toUpperCase();
    if (name) data.name = name.trim();
    if (departmentId) data.departmentId = departmentId;
    if (semester !== undefined) data.semester = parseInt(semester, 10);
    if (credits !== undefined) data.credits = parseInt(credits, 10);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data,
      include: { department: true }
    });

    res.json({ subject });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update subject.' });
  }
});

adminRouter.delete('/subjects/:id', async (req: Request, res: Response) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete subject with existing attendance sessions.' });
  }
});

// -------------------------------------------------------------
// 5. DIVISIONS & BATCHES CRUD (Part 11)
// -------------------------------------------------------------
adminRouter.get('/divisions', async (_req: Request, res: Response) => {
  try {
    const divisions = await prisma.division.findMany({
      include: {
        department: true,
        batches: { orderBy: { name: 'asc' } },
        _count: { select: { enrollments: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json({ divisions });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch divisions' });
  }
});

adminRouter.post('/divisions', async (req: Request, res: Response) => {
  try {
    const { name, departmentId, academicYear, semester, batchNames } = req.body;

    if (!name || !departmentId || !academicYear) {
      return res.status(400).json({ message: 'Division name, department, and academic year are required.' });
    }

    const division = await prisma.division.create({
      data: {
        name: name.trim(),
        departmentId,
        academicYear: academicYear.trim(),
        semester: parseInt(semester, 10) || 1,
      },
      include: { department: true }
    });

    // Optionally create batches right away (e.g. ["B1", "B2"])
    if (Array.isArray(batchNames) && batchNames.length > 0) {
      for (const bName of batchNames) {
        if (bName && typeof bName === 'string') {
          await prisma.batch.create({
            data: {
              name: bName.trim().toUpperCase(),
              divisionId: division.id
            }
          });
        }
      }
    }

    const fullDivision = await prisma.division.findUnique({
      where: { id: division.id },
      include: { department: true, batches: true }
    });

    res.status(201).json({ division: fullDivision });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create division.' });
  }
});

adminRouter.put('/divisions/:id', async (req: Request, res: Response) => {
  try {
    const { name, departmentId, academicYear, semester } = req.body;
    const data: any = {};
    if (name) data.name = name.trim();
    if (departmentId) data.departmentId = departmentId;
    if (academicYear) data.academicYear = academicYear.trim();
    if (semester !== undefined) data.semester = parseInt(semester, 10);

    const division = await prisma.division.update({
      where: { id: req.params.id },
      data,
      include: { department: true, batches: true }
    });

    res.json({ division });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update division.' });
  }
});

adminRouter.delete('/divisions/:id', async (req: Request, res: Response) => {
  try {
    await prisma.division.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Division removed successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete division with active enrollments.' });
  }
});

// Batches sub-routes
adminRouter.post('/batches', async (req: Request, res: Response) => {
  try {
    const { divisionId, name } = req.body;
    if (!divisionId || !name) {
      return res.status(400).json({ message: 'Division ID and batch name are required.' });
    }

    const batch = await prisma.batch.create({
      data: {
        divisionId,
        name: name.trim().toUpperCase()
      }
    });

    res.status(201).json({ batch });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create batch.' });
  }
});

adminRouter.post('/divisions/:divisionId/batches', async (req: Request, res: Response) => {
  try {
    const divisionId = req.params.divisionId;
    const { name } = req.body;
    if (!divisionId || !name) {
      return res.status(400).json({ message: 'Division ID and batch name are required.' });
    }

    const batch = await prisma.batch.create({
      data: {
        divisionId,
        name: name.trim().toUpperCase()
      }
    });

    res.status(201).json({ batch });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create batch.' });
  }
});

adminRouter.delete('/batches/:id', async (req: Request, res: Response) => {
  try {
    await prisma.batch.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Batch removed successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete batch with student enrollments.' });
  }
});

// -------------------------------------------------------------
// 6. TEACHERS CRUD (Part 13)
// -------------------------------------------------------------
adminRouter.get('/teachers', async (_req: Request, res: Response) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: true,
        department: true,
        assignments: {
          include: { subject: true, division: true, batch: true }
        }
      },
      orderBy: { fullName: 'asc' }
    });

    const formatted = teachers.map(t => ({
      id: t.id,
      employeeId: t.teacherCode,
      fullName: t.fullName,
      email: t.user.email,
      department: t.department.name,
      departmentId: t.departmentId,
      phone: t.phone,
      isActive: t.user.isActive,
      assignments: t.assignments.map(a => ({
        id: a.id,
        subjectCode: a.subject.code,
        subjectName: a.subject.name,
        divisionName: a.division.name,
        batchName: a.batch?.name || 'All Batches'
      }))
    }));

    res.json({ teachers: formatted });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch teachers' });
  }
});

adminRouter.post('/teachers', async (req: Request, res: Response) => {
  try {
    const { employeeId, fullName, email, password, departmentId, phone } = req.body;

    if (!employeeId || !fullName || !email || !password || !departmentId) {
      return res.status(400).json({ message: 'Employee ID, Name, Email, Password, and Department are all required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employeeId.trim().toUpperCase();

    // Check existing email
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email address already exists.' });
    }

    const existingTeacher = await prisma.teacher.findUnique({ where: { teacherCode: cleanEmpId } });
    if (existingTeacher) {
      return res.status(400).json({ message: 'A faculty record with this Employee ID already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          role: 'TEACHER',
          isActive: true
        }
      });

      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          teacherCode: cleanEmpId,
          fullName: fullName.trim(),
          departmentId,
          phone: phone ? phone.trim() : null
        },
        include: { department: true }
      });

      return { user, teacher };
    });

    res.status(201).json({
      teacher: {
        id: result.teacher.id,
        employeeId: result.teacher.teacherCode,
        fullName: result.teacher.fullName,
        email: result.user.email,
        department: result.teacher.department.name
      }
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create teacher account.' });
  }
});

adminRouter.put('/teachers/:id', async (req: Request, res: Response) => {
  try {
    const { fullName, departmentId, phone, isActive, newPassword } = req.body;

    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found.' });
    }

    await prisma.$transaction(async (tx) => {
      if (fullName || departmentId || phone !== undefined) {
        await tx.teacher.update({
          where: { id: teacher.id },
          data: {
            ...(fullName ? { fullName: fullName.trim() } : {}),
            ...(departmentId ? { departmentId } : {}),
            ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {})
          }
        });
      }

      if (isActive !== undefined || newPassword) {
        const userData: any = {};
        if (isActive !== undefined) userData.isActive = Boolean(isActive);
        if (newPassword) userData.passwordHash = await bcrypt.hash(newPassword, 10);

        await tx.user.update({
          where: { id: teacher.userId },
          data: userData
        });
      }
    });

    res.json({ success: true, message: 'Teacher updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update teacher.' });
  }
});

adminRouter.delete('/teachers/:id', async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id }
    });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    // Delete cascading User
    await prisma.user.delete({ where: { id: teacher.userId } });
    res.json({ success: true, message: 'Teacher removed successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete teacher with existing attendance records. Deactivate instead.' });
  }
});

// -------------------------------------------------------------
// 7. STUDENTS CRUD (Part 12)
// -------------------------------------------------------------
adminRouter.get('/students', async (req: Request, res: Response) => {
  try {
    const { divisionId, batchId, search } = req.query;

    const where: any = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { prn: { contains: search } },
        { fullName: { contains: search } },
        { rollNumber: { contains: search } }
      ];
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        user: true,
        department: true,
        enrollments: {
          include: { division: true, batch: true },
          where: { isActive: true }
        }
      },
      orderBy: { rollNumber: 'asc' }
    });

    let filtered = students;
    if (divisionId && typeof divisionId === 'string') {
      filtered = filtered.filter(s => s.enrollments.some(e => e.divisionId === divisionId));
    }
    if (batchId && typeof batchId === 'string') {
      filtered = filtered.filter(s => s.enrollments.some(e => e.batchId === batchId));
    }

    const formatted = filtered.map(s => {
      const enrollment = s.enrollments[0];
      return {
        prn: s.prn,
        fullName: s.fullName,
        rollNumber: s.rollNumber,
        email: s.institutionalEmail,
        department: s.department.name,
        departmentId: s.departmentId,
        divisionName: enrollment?.division?.name || 'Unassigned',
        divisionId: enrollment?.divisionId || null,
        batchName: enrollment?.batch?.name || 'All Batches',
        batchId: enrollment?.batchId || null,
        academicYear: s.academicYear,
        isActive: s.isActive && s.user.isActive
      };
    });

    res.json({ students: formatted });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch students directory' });
  }
});

adminRouter.post('/students', async (req: Request, res: Response) => {
  try {
    const { prn, fullName, rollNumber, departmentId, divisionId, batchId, academicYear, email, password } = req.body;

    if (!prn || !fullName || !rollNumber || !departmentId || !email || !password) {
      return res.status(400).json({ message: 'PRN, Full Name, Roll Number, Department, Email, and Password are all required.' });
    }

    const cleanPrn = prn.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanRoll = rollNumber.trim();
    const year = academicYear ? academicYear.trim() : '2024-2028';

    // PRN format validation (Alphanumeric 6-16 chars e.g. 124B1C088)
    const prnRegex = /^[A-Z0-9]{6,16}$/;
    if (!prnRegex.test(cleanPrn)) {
      return res.status(400).json({ message: 'Invalid PRN format. Must be 6-16 alphanumeric characters (e.g. 124B1C088).' });
    }

    const existingPrn = await prisma.student.findUnique({ where: { prn: cleanPrn } });
    if (existingPrn) {
      return res.status(400).json({ message: `Student with PRN '${cleanPrn}' already exists.` });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return res.status(400).json({ message: 'A user account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          role: 'STUDENT',
          isActive: true
        }
      });

      const student = await tx.student.create({
        data: {
          prn: cleanPrn,
          userId: user.id,
          fullName: fullName.trim(),
          rollNumber: cleanRoll,
          institutionalEmail: cleanEmail,
          departmentId,
          academicYear: year,
          isActive: true
        }
      });

      if (divisionId) {
        const div = await tx.division.findUnique({ where: { id: divisionId } });
        await tx.studentEnrollment.create({
          data: {
            studentPrn: student.prn,
            divisionId,
            batchId: batchId || null,
            academicYear: div?.academicYear || year,
            isActive: true
          }
        });
      }

      return student;
    });

    res.status(201).json({ student: result });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create student.' });
  }
});

adminRouter.put('/students/:prn', async (req: Request, res: Response) => {
  try {
    const { fullName, rollNumber, departmentId, divisionId, batchId, academicYear, isActive, newPassword } = req.body;
    const targetPrn = req.params.prn.trim().toUpperCase();

    const student = await prisma.student.findUnique({
      where: { prn: targetPrn },
      include: { user: true, enrollments: true }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student record not found.' });
    }

    await prisma.$transaction(async (tx) => {
      const studentData: any = {};
      if (fullName) studentData.fullName = fullName.trim();
      if (rollNumber) studentData.rollNumber = rollNumber.trim();
      if (departmentId) studentData.departmentId = departmentId;
      if (academicYear) studentData.academicYear = academicYear.trim();
      if (isActive !== undefined) studentData.isActive = Boolean(isActive);

      if (Object.keys(studentData).length > 0) {
        await tx.student.update({
          where: { prn: targetPrn },
          data: studentData
        });
      }

      if (isActive !== undefined || newPassword) {
        const userData: any = {};
        if (isActive !== undefined) userData.isActive = Boolean(isActive);
        if (newPassword) userData.passwordHash = await bcrypt.hash(newPassword, 10);

        await tx.user.update({
          where: { id: student.userId },
          data: userData
        });
      }

      // Update division/batch enrollment if requested
      if (divisionId) {
        const existingEnrollment = student.enrollments[0];
        if (existingEnrollment) {
          await tx.studentEnrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              divisionId,
              batchId: batchId || null
            }
          });
        } else {
          await tx.studentEnrollment.create({
            data: {
              studentPrn: targetPrn,
              divisionId,
              batchId: batchId || null,
              academicYear: student.academicYear,
              isActive: true
            }
          });
        }
      }
    });

    res.json({ success: true, message: 'Student profile updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update student.' });
  }
});

adminRouter.delete('/students/:prn', async (req: Request, res: Response) => {
  try {
    const targetPrn = req.params.prn.trim().toUpperCase();
    const student = await prisma.student.findUnique({ where: { prn: targetPrn } });
    if (!student) {
      return res.status(404).json({ message: 'Student record not found.' });
    }

    await prisma.user.delete({ where: { id: student.userId } });
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Cannot delete student with recorded attendance. Deactivate instead.' });
  }
});

// -------------------------------------------------------------
// 8. TEACHER-SUBJECT-CLASS ASSIGNMENTS (Part 14)
// -------------------------------------------------------------
adminRouter.get('/assignments', async (_req: Request, res: Response) => {
  try {
    const assignments = await prisma.teacherAssignment.findMany({
      include: {
        teacher: true,
        subject: true,
        division: true,
        batch: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ assignments });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch assignments' });
  }
});

adminRouter.post('/assignments', async (req: Request, res: Response) => {
  try {
    const { teacherId, subjectId, divisionId, batchId } = req.body;

    if (!teacherId || !subjectId || !divisionId) {
      return res.status(400).json({ message: 'Teacher, Subject, and Division are required.' });
    }

    const assignment = await prisma.teacherAssignment.create({
      data: {
        teacherId,
        subjectId,
        divisionId,
        batchId: batchId || null
      },
      include: {
        teacher: true,
        subject: true,
        division: true,
        batch: true
      }
    });

    res.status(201).json({ assignment });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'This teacher is already assigned to this class and subject.' });
  }
});

adminRouter.delete('/assignments/:id', async (req: Request, res: Response) => {
  try {
    await prisma.teacherAssignment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Assignment removed.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Failed to remove assignment.' });
  }
});

// -------------------------------------------------------------
// 9. CLASSROOM DEVICES CRUD (ESP32 / BLE Presence Hardware)
// -------------------------------------------------------------
adminRouter.get('/devices', async (_req: Request, res: Response) => {
  try {
    const devices = await prisma.classroomDevice.findMany({
      include: {
        classroom: true
      },
      orderBy: { deviceId: 'asc' }
    });
    res.json({ devices });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch classroom devices', error: err.message });
  }
});

adminRouter.post('/devices', async (req: Request, res: Response) => {
  try {
    const { deviceId, classroomId, bleIdentifier, status } = req.body;

    if (!deviceId || !classroomId || !bleIdentifier) {
      return res.status(400).json({ message: 'Device ID, Classroom, and BLE Identifier are required.' });
    }

    // Verify classroom exists
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ message: 'Specified classroom does not exist.' });
    }

    const device = await prisma.classroomDevice.create({
      data: {
        deviceId: deviceId.trim().toUpperCase(),
        classroomId,
        bleIdentifier: bleIdentifier.trim(),
        status: status || 'ACTIVE'
      },
      include: { classroom: true }
    });

    res.status(201).json({ device });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to create classroom device. Device ID or Classroom link may already exist.' });
  }
});

adminRouter.put('/devices/:id', async (req: Request, res: Response) => {
  try {
    const { deviceId, classroomId, bleIdentifier, status } = req.body;

    const data: any = {};
    if (deviceId) data.deviceId = deviceId.trim().toUpperCase();
    if (classroomId) data.classroomId = classroomId;
    if (bleIdentifier) data.bleIdentifier = bleIdentifier.trim();
    if (status) data.status = status;

    const device = await prisma.classroomDevice.update({
      where: { id: req.params.id },
      data,
      include: { classroom: true }
    });

    res.json({ device });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to update classroom device.' });
  }
});

adminRouter.delete('/devices/:id', async (req: Request, res: Response) => {
  try {
    await prisma.classroomDevice.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Classroom device deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ message: 'Failed to delete classroom device.' });
  }
});

