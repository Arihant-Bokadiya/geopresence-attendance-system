import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const academicRouter = Router();

// GET /api/v1/academic/subjects
academicRouter.get('/subjects', authenticate, async (req: Request, res: Response) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: { department: true },
      orderBy: { code: 'asc' },
    });
    res.json({ subjects });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

// GET /api/v1/academic/divisions
academicRouter.get('/divisions', authenticate, async (req: Request, res: Response) => {
  try {
    const divisions = await prisma.division.findMany({
      include: {
        department: true,
        batches: { orderBy: { name: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ divisions });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch divisions' });
  }
});

// GET /api/v1/academic/divisions/:id/roster - Full student list with PRN
academicRouter.get('/divisions/:id/roster', authenticate, async (req: Request, res: Response) => {
  try {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { divisionId: req.params.id, isActive: true },
      include: {
        student: {
          include: { department: true }
        }
      },
      orderBy: { student: { rollNumber: 'asc' } },
    });

    const students = enrollments.map((e) => ({
      prn: e.student.prn,
      rollNumber: e.student.rollNumber,
      fullName: e.student.fullName,
      email: e.student.institutionalEmail,
      department: e.student.department.name,
      academicYear: e.student.academicYear,
    }));

    res.json({ students });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch division roster' });
  }
});

// GET /api/v1/academic/students - All students directory
academicRouter.get('/students', authenticate, async (req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        department: true,
        enrollments: {
          include: { division: true },
          where: { isActive: true }
        }
      },
      orderBy: { rollNumber: 'asc' }
    });

    const formatted = students.map((s) => ({
      prn: s.prn,
      rollNumber: s.rollNumber,
      fullName: s.fullName,
      email: s.institutionalEmail,
      department: s.department.name,
      academicYear: s.academicYear,
      division: s.enrollments[0]?.division?.name || 'Unassigned',
      divisionId: s.enrollments[0]?.divisionId || null,
      isActive: s.isActive
    }));

    res.json({ students: formatted, totalCount: formatted.length });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch students directory' });
  }
});
