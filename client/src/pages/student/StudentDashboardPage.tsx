import React, { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { apiRequest } from '../../utils/api.js';
import type { User } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { 
  ShieldCheck, Radio, RefreshCw, CheckCircle2, Smartphone, AlertCircle
} from 'lucide-react';
import {
  probeWebAuthnEnvironment,
  analyzeWebAuthnFailure,
  sendWebAuthnDiagnostics,
  type WebAuthnFailureReport,
  type WebAuthnEnvironmentReport
} from '../../utils/webauthnDiagnostics.js';
import { WebAuthnDiagnosticsCard } from '../../components/common/WebAuthnDiagnosticsCard.js';

interface StudentDashboardPageProps {
  user: User;
  onNavigateAttendance: (sessionId?: string) => void;
}

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = ({
  user,
  onNavigateAttendance
}) => {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // WebAuthn Phone Authenticator Status & Diagnostics
  const [isPhoneRegistered, setIsPhoneRegistered] = useState<boolean>(false);
  const [checkingPhoneAuth, setCheckingPhoneAuth] = useState<boolean>(true);
  const [failureReport, setFailureReport] = useState<WebAuthnFailureReport | null>(null);
  const [envReport, setEnvReport] = useState<WebAuthnEnvironmentReport | null>(null);
  const [registeringPhone, setRegisteringPhone] = useState<boolean>(false);
  const [regFeedback, setRegFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadActiveSessions();
    loadPhoneAuthStatus();
    const interval = setInterval(loadActiveSessions, 6000);
    return () => clearInterval(interval);
  }, []);

  const loadPhoneAuthStatus = async () => {
    try {
      setCheckingPhoneAuth(true);
      const res = await apiRequest<{ isRegistered: boolean }>('/auth/webauthn/status');
      setIsPhoneRegistered(Boolean(res.isRegistered));
    } catch (err) {
      console.error('Failed to load phone authentication status:', err);
    } finally {
      setCheckingPhoneAuth(false);
    }
  };

  const handleRegisterPhone = async () => {
    setRegisteringPhone(true);
    setRegFeedback(null);
    setFailureReport(null);

    const env = await probeWebAuthnEnvironment();
    setEnvReport(env);

    let options: any = null;

    try {
      // Step 1: Request Registration Options from Backend
      options = await apiRequest<any>('/auth/webauthn/register/options', {
        method: 'POST'
      });

      // Step 2: Invoke Browser/Platform Biometric Ceremony (Face ID / Touch ID / Device Passcode)
      const registrationResponse = await startRegistration({ optionsJSON: options });

      // Step 3: Verify and Persist Credential on Backend
      const verifyRes = await apiRequest<any>('/auth/webauthn/register/verify', {
        method: 'POST',
        body: {
          registrationResponse,
          deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Phone Authenticator' : 'Platform Authenticator'
        }
      });

      if (verifyRes.verified) {
        setIsPhoneRegistered(true);
        setRegFeedback({
          type: 'success',
          message: '✓ Phone platform authentication registered successfully! Your device is now authorized.'
        });
      } else {
        const verifyError = new Error(verifyRes.message || 'Server rejected registration response');
        const report = analyzeWebAuthnFailure(verifyError, env, 'VERIFICATION', options);
        setFailureReport(report);
        sendWebAuthnDiagnostics(report);
        setRegFeedback({
          type: 'error',
          message: verifyRes.message || 'Server rejected phone authentication registration.'
        });
      }
    } catch (err: any) {
      console.error('Phone registration error:', err);
      const stage = !options ? 'OPTIONS_FETCH' : 'CEREMONY';
      const report = analyzeWebAuthnFailure(err, env, stage, options);
      setFailureReport(report);
      sendWebAuthnDiagnostics(report);

      const errName = report.errorName;
      const errMsg = report.errorMessage;

      if (errName === 'NotAllowedError') {
        if (errMsg && errMsg.toLowerCase().includes('cancel')) {
          setRegFeedback({
            type: 'error',
            message: 'Registration was cancelled on your device.'
          });
        } else if (errMsg && errMsg.length > 0 && !errMsg.includes('[object')) {
          setRegFeedback({
            type: 'error',
            message: `Registration not permitted (${errName}): ${errMsg}`
          });
        } else {
          setRegFeedback({
            type: 'error',
            message: 'Registration was not permitted or cancelled by your device/browser.'
          });
        }
      } else {
        setRegFeedback({
          type: 'error',
          message: errMsg || 'Failed to complete phone registration.'
        });
      }
    } finally {
      setRegisteringPhone(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const res = await apiRequest<any>('/sessions/active/for-student').catch(() => null);
      if (res && res.hasActiveSession) {
        if (Array.isArray(res.activeSessions)) {
          setActiveSessions(res.activeSessions);
        } else if (res.session) {
          setActiveSessions([res.session]);
        } else {
          setActiveSessions([]);
        }
      } else {
        setActiveSessions([]);
      }
    } catch (err) {
      console.error('Error loading active sessions:', err);
      setActiveSessions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '640px', padding: '1rem' }}>
      
      {/* Student Identity Card */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.5rem' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              GeoPresence • Student Portal
            </div>
            <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>
              Welcome, {user.fullName}
            </h1>
            {user.department && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {user.department}
              </p>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Permanent Reg. Number
            </div>
            <div className="mono" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--brand-primary)' }}>
              {user.prn}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              {user.activeDivision?.name ? (
                <>Division: <strong>{user.activeDivision.name}</strong></>
              ) : (
                <span>Enrolled Student</span>
              )}
              {user.activeBatch?.name && (
                <> • Batch: <strong>{user.activeBatch.name}</strong></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* First-Time Secure Attendance Setup Onboarding */}
      {!checkingPhoneAuth && !isPhoneRegistered && (
        <div className="card" style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
          borderLeft: '4px solid var(--brand-primary)',
          backgroundColor: '#ffffff',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--brand-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary)'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                Secure Attendance Setup
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                One-time device platform authentication registration
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
            Before marking attendance, register your device using your phone or computer's native platform authenticator (Face ID, Touch ID, Windows Hello, or Device Screen Lock).
          </p>

          <div style={{
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)'
          }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
              🔒 Institutional Privacy Guarantee:
            </strong>
            This application <strong>NEVER</strong> stores, collects, or receives your fingerprint, facial scans, or raw biometric data. Biometric verification is performed entirely within your device's native hardware security enclave. The college server only stores a cryptographic public-key credential.
          </div>

          {regFeedback && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              backgroundColor: regFeedback.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
              color: regFeedback.type === 'error' ? 'var(--color-danger-dark)' : 'var(--color-success-dark)',
              border: `1px solid ${regFeedback.type === 'error' ? 'var(--color-danger-border)' : 'var(--color-success-border)'}`
            }}>
              {regFeedback.message}

              <WebAuthnDiagnosticsCard
                failureReport={failureReport}
                envReport={envReport}
                onRetest={() => probeWebAuthnEnvironment().then(setEnvReport)}
              />
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={registeringPhone}
            onClick={handleRegisterPhone}
          >
            <ShieldCheck size={18} /> Set Up Secure Authentication
          </Button>
        </div>
      )}

      {/* Authenticator Active Status Badge (When Registered) */}
      {!checkingPhoneAuth && isPhoneRegistered && (
        <div className="card" style={{
          marginBottom: '1.5rem',
          padding: '0.85rem 1.25rem',
          borderLeft: '4px solid var(--color-success)',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} color="var(--color-success)" />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Platform Authenticator Ready
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Your device is authorized for biometric attendance verification.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="sm"
              loading={registeringPhone}
              onClick={handleRegisterPhone}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            >
              Add / Re-register Phone
            </Button>
            <Badge variant="present" icon={<CheckCircle2 size={12} />}>
              AUTHORIZED
            </Badge>
          </div>
        </div>
      )}

      {/* Section Title */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={18} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Active Attendance
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadActiveSessions();
          }}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
          title="Refresh active sessions"
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Active Sessions List */}
      {loading && activeSessions.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div className="pulse-dot" style={{ width: '16px', height: '16px', margin: '0 auto 1rem' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Checking for open classroom sessions...
          </div>
        </div>
      ) : activeSessions.length === 0 ? (
        /* Empty State */
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-subtle)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Radio size={24} />
          </div>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
            No active attendance session right now.
          </h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
            When your instructor opens an attendance window for your course, it will appear here automatically.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadActiveSessions}
          >
            <RefreshCw size={14} /> Check for Session
          </Button>
        </div>
      ) : (
        /* Active Session Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activeSessions.map((sess) => {
            const alreadyMarked = sess.alreadyMarked;

            return (
              <div
                key={sess.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  border: alreadyMarked ? '1px solid var(--color-success)' : '2px solid var(--brand-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
                  <div className="flex items-center gap-2">
                    {alreadyMarked ? (
                      <Badge variant="present" icon={<CheckCircle2 size={13} />}>
                        ATTENDANCE RECORDED
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1.5" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-success)' }}>
                        <span className="pulse-dot" />
                        SESSION ACTIVE
                      </span>
                    )}
                  </div>
                  <Badge variant="neutral">
                    {sess.classroom?.roomCode}
                  </Badge>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
                    {sess.subject?.code} — {sess.subject?.name}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <div>Teacher: <strong>{sess.teacher?.fullName}</strong></div>
                    <div>Classroom: <strong>{sess.classroom?.roomCode}</strong> ({sess.classroom?.buildingName})</div>
                    {sess.batch && (
                      <div>Batch: <strong>{sess.batch.name}</strong></div>
                    )}
                  </div>
                </div>

                {alreadyMarked ? (
                  <div style={{
                    backgroundColor: 'var(--color-success-bg)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.825rem',
                    color: 'var(--color-success-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>✓ Marked Present for this lecture</span>
                    {sess.existingRecord?.markedAt && (
                      <span className="mono" style={{ fontSize: '0.75rem' }}>
                        {new Date(sess.existingRecord.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => onNavigateAttendance(sess.id)}
                    style={{ fontWeight: 600 }}
                  >
                    <ShieldCheck size={18} /> MARK ATTENDANCE
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
