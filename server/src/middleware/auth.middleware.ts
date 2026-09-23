import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-enterprise-jwt-key-attendance-2026';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  prn?: string;
  teacherId?: string;
  fullName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function signToken(payload: AuthenticatedUser, expiresIn: string = '12h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication credentials were not provided or token is missing.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication token is invalid or has expired.'
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'User identity is not authenticated.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Access denied. Role '${req.user.role}' does not have required permissions.`
      });
    }

    next();
  };
}
