import crypto from 'crypto';

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateSecureOtp(): string {
  // Generates integer in range [100000, 999999]
  const otpNumber = crypto.randomInt(100000, 1000000);
  return otpNumber.toString();
}

/**
 * Hash an OTP using SHA-256 with a salt or session secret
 */
export function hashOtp(otp: string, salt: string = ''): string {
  return crypto
    .createHash('sha256')
    .update(`${otp}:${salt}`)
    .digest('hex');
}

/**
 * Perform a constant-time comparison of two OTP hashes to prevent timing attacks
 */
export function timingSafeCompare(candidateHash: string, storedHash: string): boolean {
  if (candidateHash.length !== storedHash.length) {
    return false;
  }
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (candidateBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}

/**
 * Generate an immutable digital receipt hash for a verified attendance record
 */
export function generateAttendanceReceiptHash(payload: {
  studentPrn: string;
  sessionId: string;
  timestamp: string;
  distanceMeters: number;
}): string {
  const content = `${payload.studentPrn}|${payload.sessionId}|${payload.timestamp}|${payload.distanceMeters}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a human-readable session code (e.g. SESS-8F2K)
 */
export function generateSessionCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}
