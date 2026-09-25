import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { authRouter } from './modules/auth/auth.controller.js';
import { classroomsRouter } from './modules/classrooms/classrooms.controller.js';
import { academicRouter } from './modules/academic/academic.controller.js';
import { sessionsRouter } from './modules/sessions/sessions.controller.js';
import { attendanceRouter } from './modules/attendance/attendance.controller.js';
import { rosterRouter } from './modules/roster/roster.controller.js';
import { auditRouter } from './modules/audit/audit.controller.js';
import { hardwareRouter } from './modules/hardware/hardware.controller.js';
import { adminRouter } from './modules/admin/admin.controller.js';
import { webauthnRouter } from './modules/webauthn/webauthn.controller.js';

export const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN;

const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Allow requests without Origin (curl, server-to-server, mobile native)
  if (!origin) return true;

  if (CORS_ORIGIN && origin === CORS_ORIGIN) return true;

  // In non-production, dynamically allow localhost, 127.0.0.1, .local, .nip.io, and private LAN IP ranges
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.nip.io') ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  const staticAllowed = [
    'http://localhost:5180',
    'http://127.0.0.1:5180',
    'https://localhost:5180',
    'https://127.0.0.1:5180',
    'http://localhost:4050',
    'http://127.0.0.1:4050',
    'https://localhost:4050',
    'https://127.0.0.1:4050',
    'http://localhost:3000'
  ];
  return staticAllowed.includes(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin not allowed: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// Request logging in development
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AttendanceSystem_GPS_Backend'
  });
});

// Endpoint to download local development mkcert Root CA certificate for iPhone / mobile trust
const serveRootCA = (_req: Request, res: Response) => {
  const possiblePaths = [
    path.resolve(process.cwd(), 'certs/rootCA.pem'),
    path.resolve(process.cwd(), '../certs/rootCA.pem'),
    path.resolve(process.cwd(), '../../certs/rootCA.pem'),
    path.resolve(process.env.HOME || '', 'Library/Application Support/mkcert/rootCA.pem')
  ];

  for (const certPath of possiblePaths) {
    if (fs.existsSync(certPath)) {
      res.setHeader('Content-Type', 'application/x-x509-ca-cert');
      res.setHeader('Content-Disposition', 'inline; filename="rootCA.pem"');
      return res.sendFile(certPath);
    }
  }

  res.status(404).json({
    error: 'Root CA certificate not found on server. Run scripts/generate-certs.sh first.'
  });
};

app.get('/ca.pem', serveRootCA);
app.get('/api/v1/ca.pem', serveRootCA);

// API v1 Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/classrooms', classroomsRouter);
app.use('/api/v1/academic', academicRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/reports', rosterRouter);
app.use('/api/v1/erp', rosterRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/hardware', hardwareRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/auth/webauthn', webauthnRouter);

// Global RFC 7807 Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title: err.name || 'Internal Server Error',
    status: err.status || 500,
    detail: err.message || 'An unexpected error occurred processing your request.'
  });
});
