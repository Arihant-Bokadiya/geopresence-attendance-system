import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

export const auditRouter = Router();

// GET /api/v1/audit/logs - View system audit logs
auditRouter.get('/logs', authenticate, requireRole(['TEACHER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { sessionId, limit = 50 } = req.query;

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(sessionId ? { sessionId: String(sessionId) } : {}),
      },
      include: {
        session: {
          select: { sessionCode: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(String(limit)) || 50, 100),
    });

    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});
