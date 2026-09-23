import { EventEmitter } from 'events';

export interface ActiveSessionData {
  sessionId: string;
  sessionCode: string;
  teacherId: string;
  classroomId: string;
  divisionId: string;
  subjectId: string;
  rawOtp: string; // Plain OTP for teacher display
  otpHash: string;
  expiresAt: Date;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

export class InMemoryCacheService {
  private static instance: InMemoryCacheService;
  private sessions = new Map<string, ActiveSessionData>();
  private rateLimitBuckets = new Map<string, { count: number; expiresAt: number }>();
  public readonly eventEmitter = new EventEmitter();

  private constructor() {
    // Periodic garbage collection for expired entries every 30 seconds
    setInterval(() => this.cleanupExpired(), 30000);
  }

  public static getInstance(): InMemoryCacheService {
    if (!InMemoryCacheService.instance) {
      InMemoryCacheService.instance = new InMemoryCacheService();
    }
    return InMemoryCacheService.instance;
  }

  // --- Session Caching & Lifecycle ---

  public setSession(sessionId: string, data: ActiveSessionData): void {
    this.sessions.set(sessionId, data);
  }

  public getSession(sessionId: string): ActiveSessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Check if expired
    if (new Date() > session.expiresAt && session.status === 'ACTIVE') {
      session.status = 'EXPIRED';
      this.notifySessionStatusChanged(sessionId, 'EXPIRED');
    }
    return session;
  }

  public closeSession(sessionId: string): ActiveSessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'CLOSED';
      this.notifySessionStatusChanged(sessionId, 'CLOSED');
    }
    return session;
  }

  public removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // --- Rate Limiting (Sliding Window per PRN/IP) ---

  public checkRateLimit(key: string, maxAttempts: number = 5, windowSeconds: number = 60): RateLimitResult {
    const now = Date.now();
    const entry = this.rateLimitBuckets.get(key);

    if (!entry || now > entry.expiresAt) {
      this.rateLimitBuckets.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return { allowed: true, remainingAttempts: maxAttempts - 1 };
    }

    if (entry.count >= maxAttempts) {
      const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    entry.count += 1;
    return { allowed: true, remainingAttempts: maxAttempts - entry.count };
  }

  public resetRateLimit(key: string): void {
    this.rateLimitBuckets.delete(key);
  }

  // --- Real-Time Pub/Sub Events (SSE Bridge) ---

  public publishAttendancePunch(sessionId: string, eventData: {
    prn: string;
    studentName: string;
    rollNumber: string;
    markedAt: string;
    distanceMeters: number;
    status: 'PRESENT' | 'REJECTED';
    failureReason?: string;
  }): void {
    this.eventEmitter.emit(`session:${sessionId}:punch`, eventData);
  }

  public notifySessionStatusChanged(sessionId: string, status: 'ACTIVE' | 'CLOSED' | 'EXPIRED'): void {
    this.eventEmitter.emit(`session:${sessionId}:status`, { status });
  }

  // --- WebAuthn Challenge Storage (Replay Protection) ---
  private webauthnChallenges = new Map<string, {
    challenge: string;
    studentPrn: string;
    sessionId?: string;
    type: 'registration' | 'authentication';
    expiresAt: number;
  }>();

  public setWebAuthnChallenge(key: string, data: {
    challenge: string;
    studentPrn: string;
    sessionId?: string;
    type: 'registration' | 'authentication';
    ttlSeconds?: number;
  }): void {
    const ttl = data.ttlSeconds || 300; // 5 minutes default
    this.webauthnChallenges.set(key, {
      ...data,
      expiresAt: Date.now() + ttl * 1000
    });
  }

  public getWebAuthnChallenge(key: string): {
    challenge: string;
    studentPrn: string;
    sessionId?: string;
    type: 'registration' | 'authentication';
  } | undefined {
    const entry = this.webauthnChallenges.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.webauthnChallenges.delete(key);
      return undefined;
    }
    return entry;
  }

  public consumeWebAuthnChallenge(key: string): {
    challenge: string;
    studentPrn: string;
    sessionId?: string;
    type: 'registration' | 'authentication';
  } | undefined {
    const entry = this.getWebAuthnChallenge(key);
    if (entry) {
      this.webauthnChallenges.delete(key);
    }
    return entry;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    // Clean expired rate limits
    for (const [key, val] of this.rateLimitBuckets.entries()) {
      if (now > val.expiresAt) {
        this.rateLimitBuckets.delete(key);
      }
    }
    // Clean expired WebAuthn challenges
    for (const [key, val] of this.webauthnChallenges.entries()) {
      if (now > val.expiresAt) {
        this.webauthnChallenges.delete(key);
      }
    }
  }
}

export const cacheService = InMemoryCacheService.getInstance();
