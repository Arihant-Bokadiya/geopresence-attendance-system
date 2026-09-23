import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5180';

app.use(cors({
  origin: [CORS_ORIGIN, 'http://localhost:5180', 'http://127.0.0.1:5180', 'http://localhost:3000'],
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
