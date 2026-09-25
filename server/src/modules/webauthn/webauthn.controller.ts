import { Router, Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  type AuthenticatorTransport
} from '@simplewebauthn/server';
import { prisma } from '../../db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { cacheService } from '../../utils/cache.js';

export const webauthnRouter = Router();

// RP (Relying Party) Configuration
const RP_NAME = 'GeoPresence Attendance';

export function getRpID(req: Request): string {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID.trim().toLowerCase();

  // 1. Check Origin header
  const origin = req.headers.origin as string;
  if (origin) {
    try {
      const parsed = new URL(origin);
      const h = parsed.hostname.toLowerCase();
      if (h === '127.0.0.1') return 'localhost';
      if (h) return h;
    } catch {}
  }

  // 2. Check X-Forwarded-Host (from reverse proxy like Vite)
  const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(':')[0]?.trim().toLowerCase();
  if (forwardedHost) {
    if (forwardedHost === '127.0.0.1') return 'localhost';
    return forwardedHost;
  }

  // 3. Fallback to Host / req.hostname
  const hostHeader = (req.headers['host'] as string)?.split(':')[0]?.trim().toLowerCase();
  const hostname = hostHeader || req.hostname?.toLowerCase() || 'localhost';
  if (hostname === '127.0.0.1') return 'localhost';
  return hostname;
}

export function getExpectedOrigins(req?: Request): string[] {
  const origins = new Set<string>([
    'http://localhost:5180',
    'http://127.0.0.1:5180',
    'https://localhost:5180',
    'https://127.0.0.1:5180',
    'http://localhost:4050',
    'http://127.0.0.1:4050',
    'https://localhost:4050',
    'https://127.0.0.1:4050'
  ]);

  if (process.env.WEBAUTHN_ORIGIN) {
    process.env.WEBAUTHN_ORIGIN.split(',').forEach(s => {
      const trimmed = s.trim();
      if (trimmed) origins.add(trimmed);
    });
  }

  if (req) {
    const reqOrigin = req.headers.origin as string;
    if (reqOrigin) {
      origins.add(reqOrigin);
      try {
        const u = new URL(reqOrigin);
        origins.add(`${u.protocol}//${u.host.toLowerCase()}`);
      } catch {}
    }

    const forwardedHost = req.headers['x-forwarded-host'] as string;
    if (forwardedHost) {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      origins.add(`${proto}://${forwardedHost}`);
      origins.add(`https://${forwardedHost}`);
      origins.add(`http://${forwardedHost}`);
      origins.add(`${proto}://${forwardedHost.toLowerCase()}`);
      origins.add(`https://${forwardedHost.toLowerCase()}`);
      origins.add(`http://${forwardedHost.toLowerCase()}`);
    }

    const host = req.headers.host as string;
    if (host) {
      origins.add(`https://${host}`);
      origins.add(`http://${host}`);
      origins.add(`https://${host.toLowerCase()}`);
      origins.add(`http://${host.toLowerCase()}`);
    }

    const referer = req.headers.referer as string;
    if (referer) {
      try {
        const u = new URL(referer);
        origins.add(`${u.protocol}//${u.host}`);
        origins.add(`${u.protocol}//${u.host.toLowerCase()}`);
      } catch {}
    }
  }

  return Array.from(origins);
}

/**
 * GET /api/v1/auth/webauthn/status
 * Check if the authenticated student has registered a phone/platform authenticator
 */
webauthnRouter.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const studentPrn = req.user?.prn;
    if (!studentPrn) {
      return res.status(403).json({ message: 'Only students can check phone authentication status.' });
    }

    const credentials = await prisma.webAuthnCredential.findMany({
      where: { studentPrn },
      select: {
        id: true,
        credentialId: true,
        deviceType: true,
        createdAt: true,
        lastUsedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      isRegistered: credentials.length > 0,
      credentialCount: credentials.length,
      credentials
    });
  } catch (error: any) {
    console.error('WebAuthn status check error:', error);
    res.status(500).json({ message: 'Failed to check phone authentication status.' });
  }
});

/**
 * POST /api/v1/auth/webauthn/register/options
 * Generate WebAuthn registration challenge for the student's phone
 */
webauthnRouter.post('/register/options', authenticate, async (req: Request, res: Response) => {
  try {
    const studentPrn = req.user?.prn;
    if (!studentPrn) {
      return res.status(403).json({ message: 'Only authenticated students can register phone authenticators.' });
    }

    const student = await prisma.student.findUnique({
      where: { prn: studentPrn }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // Existing credentials to exclude (prevent re-registering same authenticator)
    const existingCreds = await prisma.webAuthnCredential.findMany({
      where: { studentPrn },
      select: { credentialId: true, transports: true }
    });

    const rpID = getRpID(req);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: Buffer.from(studentPrn, 'utf-8'),
      userName: studentPrn,
      userDisplayName: student.fullName,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c: { credentialId: string; transports: string | null }) => ({
        id: c.credentialId,
        transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : undefined
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // FaceID / TouchID / Windows Hello / Android biometric
        userVerification: 'preferred',
        residentKey: 'discouraged'
      }
    });

    // Cache registration challenge with 5-minute TTL
    cacheService.setWebAuthnChallenge(`reg:${studentPrn}`, {
      challenge: options.challenge,
      studentPrn,
      type: 'registration',
      ttlSeconds: 300
    });

    res.json(options);
  } catch (error: any) {
    console.error('Error generating registration options:', error);
    res.status(500).json({ message: 'Failed to generate phone registration options.' });
  }
});

/**
 * POST /api/v1/auth/webauthn/register/verify
 * Cryptographically verify registration response and store public key in database
 */
webauthnRouter.post('/register/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const studentPrn = req.user?.prn;
    if (!studentPrn) {
      return res.status(403).json({ message: 'Only authenticated students can verify phone authenticators.' });
    }

    const challengeData = cacheService.consumeWebAuthnChallenge(`reg:${studentPrn}`);
    if (!challengeData) {
      return res.status(400).json({
        message: 'Registration challenge expired or not found. Please try again.'
      });
    }

    const { registrationResponse, deviceName } = req.body;
    if (!registrationResponse) {
      return res.status(400).json({ message: 'Registration response payload is required.' });
    }

    const rpID = getRpID(req);
    const expectedOrigins = getExpectedOrigins(req);

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: false
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        verified: false,
        message: 'Cryptographic verification of phone authenticator failed.'
      });
    }

    const { credential, aaguid } = verification.registrationInfo;
    const credentialIdB64 = credential.id;
    const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64url');
    const counter = credential.counter;

    // Transports metadata
    const transports = registrationResponse.response?.transports
      ? JSON.stringify(registrationResponse.response.transports)
      : JSON.stringify(['internal']);

    // Upsert credential record (associated strictly with student's PRN)
    const savedCredential = await prisma.webAuthnCredential.upsert({
      where: { credentialId: credentialIdB64 },
      create: {
        studentPrn,
        credentialId: credentialIdB64,
        publicKey: publicKeyB64,
        counter,
        transports,
        deviceType: deviceName || 'Platform Authenticator (Face/Touch ID/Passcode)',
        aaguid: aaguid ? aaguid.toString() : null
      },
      update: {
        publicKey: publicKeyB64,
        counter,
        transports,
        lastUsedAt: new Date()
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        entityName: 'WebAuthnCredential',
        entityId: savedCredential.id,
        action: 'WEBAUTHN_REGISTERED',
        actorId: req.user!.userId,
        actorRole: 'STUDENT',
        details: JSON.stringify({
          studentPrn,
          deviceType: savedCredential.deviceType,
          credentialId: credentialIdB64.slice(0, 16) + '...'
        }),
        ipAddress: req.ip
      }
    });

    res.json({
      verified: true,
      message: 'Phone authentication device registered successfully.',
      credentialId: credentialIdB64
    });
  } catch (error: any) {
    console.error('Registration verification error:', error);
    res.status(400).json({
      verified: false,
      message: error.message || 'Phone authenticator registration verification failed.'
    });
  }
});

/**
 * POST /api/v1/auth/webauthn/authenticate/options
 * Generate WebAuthn authentication challenge for marking attendance
 */
webauthnRouter.post('/authenticate/options', authenticate, async (req: Request, res: Response) => {
  try {
    const studentPrn = req.user?.prn;
    if (!studentPrn) {
      return res.status(403).json({ message: 'Only authenticated students can request authentication options.' });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required.' });
    }

    // Verify student has registered credentials
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { studentPrn }
    });

    if (!credentials || credentials.length === 0) {
      return res.status(403).json({
        code: 'DEVICE_NOT_REGISTERED',
        message: 'Phone authentication is not registered on this account. Please register your device first.'
      });
    }

    const rpID = getRpID(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c: { credentialId: string; transports: string | null }) => ({
        id: c.credentialId,
        transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransport[]) : undefined
      })),
      userVerification: 'preferred'
    });

    // Cache challenge linked to student and sessionId
    cacheService.setWebAuthnChallenge(`auth:${studentPrn}:${sessionId}`, {
      challenge: options.challenge,
      studentPrn,
      sessionId,
      type: 'authentication',
      ttlSeconds: 180 // 3 minutes
    });

    res.json(options);
  } catch (error: any) {
    console.error('Error generating authentication options:', error);
    res.status(500).json({ message: 'Failed to generate authentication challenge.' });
  }
});
