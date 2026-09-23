import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { signToken, authenticate, requireRole } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

/**
 * GET /api/v1/auth/setup-status
 * Checks if the system has been initialized with at least one administrator account
 */
authRouter.get('/setup-status', async (_req: Request, res: Response) => {
  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });
    return res.json({
      needsSetup: adminCount === 0,
      adminCount
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to check setup status', error: err.message });
  }
});

/**
 * POST /api/v1/auth/initialize-admin
 * One-time setup endpoint to create the FIRST system administrator.
 * Automatically disabled as soon as any admin user exists.
 */
authRouter.post('/initialize-admin', async (req: Request, res: Response) => {
  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });

    if (adminCount > 0) {
      return res.status(403).json({
        message: 'System has already been initialized. An administrator account already exists. Please log in normally.'
      });
    }

    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: 'Full Name, Email/Username, and Password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const adminUser = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        role: 'ADMIN',
        isActive: true
      }
    });

    const tokenPayload = {
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN' as const,
      fullName: fullName.trim()
    };

    const token = signToken(tokenPayload);

    return res.status(201).json({
      success: true,
      message: 'System administrator account successfully initialized.',
      token,
      user: {
        id: adminUser.id,
        role: 'ADMIN',
        email: adminUser.email,
        fullName: fullName.trim()
      }
    });
  } catch (err: any) {
    console.error('Initialize admin error:', err);
    return res.status(500).json({ message: 'Failed to initialize administrator', error: err.message });
  }
});

/**
 * GET /api/v1/auth/student/academic-options
 * Public endpoint allowing self-registering students to view configured departments, divisions, and batches
 */
authRouter.get('/student/academic-options', async (_req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        divisions: {
          include: {
            batches: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formatted = departments.map((d: any) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      divisions: d.divisions.map((div: any) => ({
        id: div.id,
        name: div.name,
        academicYear: div.academicYear,
        semester: div.semester,
        batches: div.batches.map((b: any) => ({
          id: b.id,
          name: b.name
        }))
      }))
    }));

    return res.json({ departments: formatted });
  } catch (err: any) {
    console.error('Failed to fetch academic options:', err);
    return res.status(500).json({ message: 'Failed to retrieve academic enrollment options.' });
  }
});

/**
 * POST /api/v1/auth/student/signup
 * Public self-registration for students with database validations
 */
authRouter.post('/student/signup', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      prn,
      email,
      phone,
      rollNumber,
      departmentId,
      divisionId,
      batchId,
      password,
      confirmPassword
    } = req.body;

    // 1. Mandatory Fields Validation
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: 'Full name is required.' });
    }
    if (!prn || !prn.trim()) {
      return res.status(400).json({ message: 'Permanent Registration Number (PRN) is required.' });
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Password and confirmation password do not match.' });
    }
    if (!departmentId) {
      return res.status(400).json({ message: 'Department selection is required.' });
    }
    if (!divisionId) {
      return res.status(400).json({ message: 'Academic division selection is required.' });
    }

    const trimmedPrn = prn.trim().toUpperCase();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const trimmedPhone = phone ? String(phone).trim() : null;
    const trimmedRoll = rollNumber ? String(rollNumber).trim() : trimmedPrn.slice(-4);

    // 2. Uniqueness Validations
    const existingStudent = await prisma.student.findUnique({
      where: { prn: trimmedPrn }
    });
    if (existingStudent) {
      return res.status(409).json({ message: `A student with PRN "${trimmedPrn}" is already registered.` });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail }
    });
    if (existingUser) {
      return res.status(409).json({ message: `An account with email "${trimmedEmail}" already exists.` });
    }

    // 3. Database Entity Relationship Verification
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });
    if (!department) {
      return res.status(400).json({ message: 'The selected department does not exist.' });
    }

    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: { batches: true }
    });
    if (!division || division.departmentId !== departmentId) {
      return res.status(400).json({ message: 'The selected division is not valid for this department.' });
    }

    let selectedBatch = null;
    if (batchId) {
      selectedBatch = division.batches.find((b: any) => b.id === batchId);
      if (!selectedBatch) {
        return res.status(400).json({ message: 'The selected batch is not valid for this division.' });
      }
    }

    // 4. Secure Password Hashing
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Atomic Account Creation in Database
    const result = await prisma.$transaction(async (tx) => {
      // Create User account
      const user = await tx.user.create({
        data: {
          email: trimmedEmail,
          passwordHash,
          role: 'STUDENT',
          isActive: true
        }
      });

      // Create Student profile
      const student = await tx.student.create({
        data: {
          prn: trimmedPrn,
          userId: user.id,
          fullName: trimmedName,
          institutionalEmail: trimmedEmail,
          rollNumber: trimmedRoll,
          departmentId,
          academicYear: division.academicYear,
          phone: trimmedPhone,
          isActive: true
        }
      });

      // Create Student Enrollment in division / batch
      const enrollment = await tx.studentEnrollment.create({
        data: {
          studentPrn: student.prn,
          divisionId: division.id,
          batchId: selectedBatch ? selectedBatch.id : null,
          academicYear: division.academicYear,
          isActive: true
        }
      });

      return { user, student, enrollment };
    });

    // 6. Sign JWT Token with AUTHENTICATION_PENDING state
    const tokenPayload = {
      userId: result.user.id,
      email: result.user.email,
      role: 'STUDENT' as const,
      prn: result.student.prn,
      fullName: result.student.fullName
    };
    const token = signToken(tokenPayload);

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully. Please complete secure platform authentication registration.',
      status: 'AUTHENTICATION_PENDING',
      token,
      user: {
        id: result.user.id,
        role: 'STUDENT',
        prn: result.student.prn,
        fullName: result.student.fullName,
        email: result.student.institutionalEmail,
        phone: result.student.phone,
        rollNumber: result.student.rollNumber,
        department: department.name,
        academicYear: result.student.academicYear,
        activeDivision: { id: division.id, name: division.name },
        activeBatch: selectedBatch ? { id: selectedBatch.id, name: selectedBatch.name } : null,
        isAuthenticationRegistered: false
      }
    });
  } catch (err: any) {
    console.error('Student signup error:', err);
    return res.status(500).json({ message: 'Failed to create student account.', error: err.message });
  }
});

/**
 * POST /api/v1/auth/login
 * Supports Student login via PRN or Institutional Email
 * Supports Faculty / Admin login via Email
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const rawIdentifier = req.body.identifier || req.body.emailOrPrn || req.body.email || req.body.prn;
    const { password } = req.body;
    const identifier = rawIdentifier;

    if (!identifier || !password) {
      return res.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'Both identifier (PRN or Email) and password are required.'
      });
    }

    const trimmedIdentifier = identifier.trim();

    // Check if identifier is PRN or Institutional Email
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { prn: trimmedIdentifier.toUpperCase() },
          { institutionalEmail: trimmedIdentifier.toLowerCase() }
        ]
      },
      include: {
        user: true,
        department: true,
        webAuthnCredentials: { select: { id: true } },
        enrollments: {
          include: { division: true, batch: true },
          where: { isActive: true }
        }
      }
    });

    if (student) {
      // Validate student password
      const isMatch = await bcrypt.compare(password, student.user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid PRN or password.'
        });
      }

      if (!student.isActive || !student.user.isActive) {
        return res.status(403).json({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Account Disabled',
          status: 403,
          detail: 'Your student account is currently suspended. Contact college registrar.'
        });
      }

      const tokenPayload = {
        userId: student.user.id,
        email: student.institutionalEmail,
        role: 'STUDENT' as const,
        prn: student.prn,
        fullName: student.fullName
      };

      const token = signToken(tokenPayload);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: student.user.id,
          role: 'STUDENT',
          prn: student.prn,
          rollNumber: student.rollNumber,
          fullName: student.fullName,
          email: student.institutionalEmail,
          phone: student.phone,
          department: student.department.name,
          academicYear: student.academicYear,
          activeDivision: student.enrollments[0]?.division || null,
          activeBatch: student.enrollments[0]?.batch || null,
          isAuthenticationRegistered: (student.webAuthnCredentials?.length || 0) > 0
        }
      });
    }

    // Check if identifier is Staff/Admin Email or Employee ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmedIdentifier.toLowerCase() },
          { teacher: { teacherCode: trimmedIdentifier.toUpperCase() } }
        ]
      },
      include: {
        teacher: {
          include: {
            department: true,
            assignments: {
              include: { subject: true, division: true, batch: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid credentials provided.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid credentials provided.'
      });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'TEACHER' | 'STUDENT',
      teacherId: user.teacher?.id,
      fullName: user.teacher?.fullName || 'Administrator'
    };

    const token = signToken(tokenPayload);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        fullName: tokenPayload.fullName,
        teacherCode: user.teacher?.teacherCode,
        department: user.teacher?.department?.name,
        assignments: user.teacher?.assignments || []
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An error occurred during authentication.'
    });
  }
});

/**
 * GET /api/v1/auth/me
 */
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'STUDENT' && req.user.prn) {
      const student = await prisma.student.findUnique({
        where: { prn: req.user.prn },
        include: {
          department: true,
          webAuthnCredentials: { select: { id: true } },
          enrollments: {
            include: { division: true, batch: true },
            where: { isActive: true }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ message: 'Student record not found' });
      }

      return res.json({
        user: {
          id: req.user.userId,
          role: 'STUDENT',
          prn: student.prn,
          rollNumber: student.rollNumber,
          fullName: student.fullName,
          email: student.institutionalEmail,
          phone: student.phone,
          department: student.department.name,
          academicYear: student.academicYear,
          activeDivision: student.enrollments[0]?.division || null,
          activeBatch: student.enrollments[0]?.batch || null,
          isAuthenticationRegistered: (student.webAuthnCredentials?.length || 0) > 0
        }
      });
    }

    if (req.user?.role === 'TEACHER' && req.user.teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: req.user.teacherId },
        include: {
          department: true,
          assignments: {
            include: { subject: true, division: true }
          }
        }
      });

      return res.json({
        user: {
          id: req.user.userId,
          role: 'TEACHER',
          email: req.user.email,
          fullName: teacher?.fullName,
          teacherCode: teacher?.teacherCode,
          phone: teacher?.phone || null,
          department: teacher?.department?.name,
          assignments: teacher?.assignments || []
        }
      });
    }

    return res.json({
      user: {
        id: req.user?.userId,
        role: req.user?.role,
        email: req.user?.email,
        fullName: req.user?.fullName
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to retrieve user profile' });
  }
});

/**
 * PUT /api/v1/auth/teacher/profile
 * Allows logged-in teacher to update personal information (name, email, phone)
 * Strictly protects institutional controls (role, teacherCode, departmentId, assignments)
 */
authRouter.put('/teacher/profile', authenticate, requireRole(['TEACHER']), async (req: Request, res: Response) => {
  try {
    const teacherId = req.user?.teacherId;
    const userId = req.user?.userId;

    if (!teacherId || !userId) {
      return res.status(403).json({ message: 'Teacher identity context not found.' });
    }

    const { fullName, email, phone } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ message: 'Full name is required.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const trimmedPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : undefined;

    // Check if new email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: trimmedEmail,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(409).json({ message: 'This email address is already in use by another user.' });
    }

    // Update User and Teacher atomically
    const [updatedUser, updatedTeacher] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { email: trimmedEmail }
      }),
      prisma.teacher.update({
        where: { id: teacherId },
        data: {
          fullName: trimmedName,
          ...(trimmedPhone !== undefined && { phone: trimmedPhone })
        },
        include: {
          department: true,
          assignments: {
            include: { subject: true, division: true }
          }
        }
      })
    ]);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
        email: updatedUser.email,
        fullName: updatedTeacher.fullName,
        teacherCode: updatedTeacher.teacherCode,
        phone: updatedTeacher.phone,
        department: updatedTeacher.department?.name,
        assignments: updatedTeacher.assignments || []
      }
    });
  } catch (error: any) {
    console.error('Teacher profile update error:', error);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

/**
 * POST /api/v1/auth/change-password
 * Secure Change Password flow requiring current password and new password
 */
authRouter.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current password and new password are required.' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Validate current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return res.status(401).json({ message: 'Current password does not match.' });
    }

    // Hash new password securely with bcrypt (10 rounds)
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Failed to change password.' });
  }
});

