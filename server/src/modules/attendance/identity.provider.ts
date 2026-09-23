import { verifyAuthenticationResponse, type AuthenticatorTransport } from '@simplewebauthn/server';
import { prisma } from '../../db.js';
import { cacheService } from '../../utils/cache.js';

export interface IdentityAuthVerificationRequest {
  studentPrn: string;
  userId: string;
  sessionId: string;
  authPayload?: {
    type?: 'WEBAUTHN' | 'SIMULATED_BIOMETRIC';
    biometricType?: 'FACE' | 'FINGERPRINT' | 'PASSKEY';
    credentialId?: string;
    webauthnResponse?: any; // Full AuthenticationResponseJSON from @simplewebauthn/browser
    isSimulated?: boolean;
    confirmedByDeveloper?: boolean;
    authenticatorConfirmed?: boolean;
    simulatedFailure?: boolean;
    verificationTimestamp?: string;
  };
}

export interface IdentityAuthResult {
  verified: boolean;
  authMode: 'WEBAUTHN' | 'DEVELOPMENT_SIMULATION';
  biometricType: 'FACE' | 'FINGERPRINT' | 'PASSKEY';
  message: string;
}

/**
 * IdentityAuthenticationProvider
 * Cryptographically verifies student phone/platform authentication
 * 
 * Strict Privacy & Security Guarantees:
 * - NEVER stores raw fingerprints, facial recognition scans, or biometric templates.
 * - Authenticates using WebAuthn / Passkeys / FIDO2 platform authenticators.
 * - Cryptographically verifies challenge signatures against registered public keys.
 * - Enforces replay protection and sign counters.
 * - In development mode: allows clearly labeled, explicit simulation only when permitted.
 */
export class IdentityAuthenticationProvider {
  public static async verifyIdentity(
    request: IdentityAuthVerificationRequest
  ): Promise<IdentityAuthResult> {
    const { studentPrn, sessionId, authPayload } = request;

    if (!authPayload) {
      return {
        verified: false,
        authMode: 'WEBAUTHN',
        biometricType: 'PASSKEY',
        message: 'Phone authentication payload is missing. Identity verification required.'
      };
    }

    // Explicit failure or cancellation
    if (Boolean(authPayload.authenticatorConfirmed === false) || Boolean(authPayload.simulatedFailure)) {
      return {
        verified: false,
        authMode: 'WEBAUTHN',
        biometricType: authPayload.biometricType || 'PASSKEY',
        message: 'Phone authentication was cancelled or rejected by the user.'
      };
    }

    // -------------------------------------------------------------
    // 1. REAL WEBAUTHN / PASSKEY CRYPTOGRAPHIC VERIFICATION
    // -------------------------------------------------------------
    if (authPayload.type === 'WEBAUTHN' || authPayload.webauthnResponse) {
      const response = authPayload.webauthnResponse;
      const credentialId = authPayload.credentialId || response?.id;

      if (!response || !credentialId) {
        return {
          verified: false,
          authMode: 'WEBAUTHN',
          biometricType: 'PASSKEY',
          message: 'Invalid WebAuthn response structure.'
        };
      }

      // Check registered credential in database for this student
      const credential = await prisma.webAuthnCredential.findUnique({
        where: { credentialId }
      });

      if (!credential || credential.studentPrn !== studentPrn) {
        return {
          verified: false,
          authMode: 'WEBAUTHN',
          biometricType: 'PASSKEY',
          message: 'Unrecognized credential. Please use your registered phone authentication.'
        };
      }

      // Retrieve and consume the active authentication challenge
      const challengeKey = `auth:${studentPrn}:${sessionId}`;
      const challengeData = cacheService.consumeWebAuthnChallenge(challengeKey);

      if (!challengeData || challengeData.type !== 'authentication') {
        return {
          verified: false,
          authMode: 'WEBAUTHN',
          biometricType: 'PASSKEY',
          message: 'Authentication challenge expired or invalid. Please re-authenticate.'
        };
      }

      try {
        const expectedOrigins = process.env.WEBAUTHN_ORIGIN 
          ? process.env.WEBAUTHN_ORIGIN.split(',').map(s => s.trim())
          : [
              'http://localhost:5180',
              'http://127.0.0.1:5180',
              'http://localhost:4050',
              'http://127.0.0.1:4050'
            ];

        const expectedRPID = process.env.WEBAUTHN_RP_ID || 'localhost';

        const verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challengeData.challenge,
          expectedOrigin: expectedOrigins,
          expectedRPID,
          credential: {
            id: credential.credentialId,
            publicKey: Buffer.from(credential.publicKey, 'base64url'),
            counter: credential.counter,
            transports: credential.transports ? (JSON.parse(credential.transports) as AuthenticatorTransport[]) : undefined
          },
          requireUserVerification: false
        });

        if (!verification.verified || !verification.authenticationInfo) {
          return {
            verified: false,
            authMode: 'WEBAUTHN',
            biometricType: 'PASSKEY',
            message: 'Cryptographic signature verification failed. Authentication rejected.'
          };
        }

        // Update sign counter and last used timestamp to prevent replay/cloning
        await prisma.webAuthnCredential.update({
          where: { id: credential.id },
          data: {
            counter: verification.authenticationInfo.newCounter,
            lastUsedAt: new Date()
          }
        });

        return {
          verified: true,
          authMode: 'WEBAUTHN',
          biometricType: 'PASSKEY',
          message: 'Phone platform biometric authentication verified successfully.'
        };
      } catch (err: any) {
        console.error('WebAuthn verification error:', err);
        return {
          verified: false,
          authMode: 'WEBAUTHN',
          biometricType: 'PASSKEY',
          message: err.message || 'Phone authentication signature check failed.'
        };
      }
    }

    // -------------------------------------------------------------
    // 2. ISOLATED DEVELOPMENT SIMULATION (Only in dev environment)
    // -------------------------------------------------------------
    if (authPayload.type === 'SIMULATED_BIOMETRIC' || authPayload.isSimulated) {
      if (process.env.NODE_ENV === 'production') {
        return {
          verified: false,
          authMode: 'DEVELOPMENT_SIMULATION',
          biometricType: 'FINGERPRINT',
          message: 'Simulated authentication is strictly prohibited in production mode.'
        };
      }

      if (authPayload.authenticatorConfirmed === false) {
        return {
          verified: false,
          authMode: 'DEVELOPMENT_SIMULATION',
          biometricType: 'FINGERPRINT',
          message: 'Simulated authentication was cancelled.'
        };
      }

      return {
        verified: true,
        authMode: 'DEVELOPMENT_SIMULATION',
        biometricType: authPayload.biometricType || 'FINGERPRINT',
        message: 'DEVELOPMENT MODE: Identity verified via Biometric Simulator.'
      };
    }

    // Default: Reject anything else. Never allow silent fallback to true!
    return {
      verified: false,
      authMode: 'WEBAUTHN',
      biometricType: 'PASSKEY',
      message: 'Authentication failed. Valid registered phone authentication is required.'
    };
  }
}
