import React, { useState, useEffect } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { apiRequest } from '../../utils/api.js';
import type { User } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import {
  MapPin, CheckCircle2, XCircle, RefreshCw,
  ArrowLeft, Radio, Fingerprint, Smartphone, ShieldCheck, AlertCircle
} from 'lucide-react';

interface MarkAttendancePageProps {
  user: User;
  sessionId?: string | null;
  onNavigateBack: () => void;
  onNavigateHistory: () => void;
}

type AttendanceFlowStatus =
  | 'IDLE'                   // Waiting for user to click [ MARK ATTENDANCE ]
  | 'ACQUIRING_GPS'          // Getting browser GPS coordinates
  | 'CHECKING_GEOFENCE'      // Backend is computing distance and verifying geofence
  | 'LOCATION_VERIFIED'      // Read-only result: Location verified
  | 'AUTHENTICATING_PHONE'   // Prompting WebAuthn platform authentication
  | 'OUTSIDE_GEOFENCE'       // Read-only result: outside classroom area
  | 'LOCATION_ERROR'         // Read-only result: GPS permission or accuracy error
  | 'AUTH_ERROR'             // Read-only result: WebAuthn cancelled or failed
  | 'NEEDS_PHONE_SETUP';     // Device not yet registered

export const MarkAttendancePage: React.FC<MarkAttendancePageProps> = ({
  user,
  sessionId,
  onNavigateBack,
  onNavigateHistory
}) => {
  // Session State
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [alreadyMarkedRecord, setAlreadyMarkedRecord] = useState<any | null>(null);

  // Attendance Pipeline State
  const [flowStatus, setFlowStatus] = useState<AttendanceFlowStatus>('IDLE');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [presenceDetails, setPresenceDetails] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Phone Biometric Authentication State
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(false);
  const [registeringPhone, setRegisteringPhone] = useState(false);

  // Final Confirmation State
  const [attendanceSuccess, setAttendanceSuccess] = useState<any | null>(null);

  useEffect(() => {
    fetchActiveSession();
    checkPhoneAuthStatus();
  }, [sessionId]);

  const checkPhoneAuthStatus = async () => {
    try {
      const res = await apiRequest<{ isRegistered: boolean }>('/auth/webauthn/status');
      setIsPhoneRegistered(Boolean(res.isRegistered));
    } catch (err) {
      console.error('Failed to query phone auth status:', err);
    }
  };

  const fetchActiveSession = async () => {
    setSessionLoading(true);
    try {
      const res = await apiRequest<any>('/sessions/active/for-student');
      if (res && res.hasActiveSession) {
        let matchingSession = null;
        if (sessionId && Array.isArray(res.activeSessions)) {
          matchingSession = res.activeSessions.find((s: any) => s.id === sessionId);
        }
        if (!matchingSession) {
          matchingSession = res.session || (Array.isArray(res.activeSessions) ? res.activeSessions[0] : null);
        }

        if (matchingSession) {
          setActiveSession(matchingSession);
          if (res.alreadyMarked) {
            setAlreadyMarkedRecord(res.existingRecord || { status: 'PRESENT' });
          } else {
            setAlreadyMarkedRecord(null);
          }
        } else {
          setActiveSession(null);
        }
      } else {
        setActiveSession(null);
        setAlreadyMarkedRecord(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch active session:', err);
    } finally {
      setSessionLoading(false);
    }
  };

  // Register Phone Platform Authenticator
  const handleRegisterPhone = async () => {
    try {
      setRegisteringPhone(true);
      setErrorMessage('');

      const options = await apiRequest<any>('/auth/webauthn/register/options', { method: 'POST' });
      const regResponse = await startRegistration({ optionsJSON: options });

      const verifyRes = await apiRequest<any>('/auth/webauthn/register/verify', {
        method: 'POST',
        body: {
          registrationResponse: regResponse,
          deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Phone Authenticator' : 'Platform Authenticator'
        }
      });

      if (verifyRes.verified) {
        setIsPhoneRegistered(true);
        // If coords already exist, continue to mark attendance immediately
        if (coords) {
          await executeBiometricAuthentication(coords);
        } else {
          setFlowStatus('IDLE');
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Phone registration was cancelled on your device.');
      } else {
        setErrorMessage(err.message || 'Failed to register phone authenticator.');
      }
      setFlowStatus('AUTH_ERROR');
    } finally {
      setRegisteringPhone(false);
    }
  };

  // Execute WebAuthn Platform Authentication & Submit
  const executeBiometricAuthentication = async (currentCoords: { latitude: number; longitude: number; accuracy: number }) => {
    setFlowStatus('AUTHENTICATING_PHONE');
    setErrorMessage('');

    try {
      // 1. Get Cryptographic Challenge from Backend
      const options = await apiRequest<any>('/auth/webauthn/authenticate/options', {
        method: 'POST',
        body: { sessionId: activeSession.id }
      });

      // 2. Invoke Real Platform Authenticator Ceremony (Face ID / Touch ID / Screen Lock)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Submit Cryptographically Signed Assertion to Server
      const res = await apiRequest<any>('/attendance/submit', {
        method: 'POST',
        body: {
          sessionId: activeSession.id,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          accuracy: currentCoords.accuracy,
          webauthnResponse: authResponse
        }
      });

      if (res.status === 'PRESENT' && res.data) {
        setAttendanceSuccess(res.data);
      } else {
        setErrorMessage(res.message || 'Attendance verification could not be recorded.');
        setFlowStatus('AUTH_ERROR');
      }
    } catch (err: any) {
      console.error('Phone authentication error:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Authentication was cancelled on your device. Attendance has not been recorded.');
      } else if (err.status === 409 || err.code === 'ALREADY_MARKED') {
        setErrorMessage('Your attendance has already been recorded for this session.');
      } else if (err.code === 'OUTSIDE_GEOFENCE' || err.status === 422) {
        setErrorMessage(`Geofence rejection: ${err.message}`);
        setFlowStatus('OUTSIDE_GEOFENCE');
        return;
      } else if (err.status === 410 || err.code === 'SESSION_EXPIRED') {
        setErrorMessage('This attendance session has ended or expired.');
      } else {
        setErrorMessage(err.message || 'Phone authentication failed. Your attendance has not been recorded.');
      }
      setFlowStatus('AUTH_ERROR');
    }
  };

  /**
   * PRIMARY ACTION: [ MARK ATTENDANCE ]
   * Unified pipeline:
   * 1. Get real GPS location from device
   * 2. Backend calculates actual distance from classroom coordinates & verifies geofence
   * 3. If valid ("Location verified"), immediately continues to WebAuthn platform authentication
   * 4. If all checks pass, marks PRESENT
   *
   * Note: The student never selects or manipulates presence/location choices.
   * All results are read-only and produced authoritatively by the backend.
   */
  const handleMarkAttendance = async () => {
    setFlowStatus('ACQUIRING_GPS');
    setErrorMessage('');
    setPresenceDetails(null);

    // 1. Device Location Check
    if (!('geolocation' in navigator)) {
      setFlowStatus('LOCATION_ERROR');
      setErrorMessage('Geolocation is not supported by your device browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const accuracy = pos.coords.accuracy || 10.0;
        if (accuracy > 50) {
          setFlowStatus('LOCATION_ERROR');
          setErrorMessage(`Location accuracy is too low (${Math.round(accuracy)}m). Please enable high-accuracy GPS and try again.`);
          return;
        }

        const devCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy
        };
        setCoords(devCoords);

        // 2. Backend Calculates Actual Distance & Geofence
        setFlowStatus('CHECKING_GEOFENCE');
        try {
          const res = await apiRequest<any>('/attendance/verify-presence', {
            method: 'POST',
            body: {
              sessionId: activeSession.id,
              latitude: devCoords.latitude,
              longitude: devCoords.longitude,
              accuracy: devCoords.accuracy
            }
          });

          if (res.verified) {
            setPresenceDetails(res);
            setFlowStatus('LOCATION_VERIFIED');

            // 3. Location verified! If phone not registered, ask to register; otherwise authenticate
            if (!isPhoneRegistered) {
              setFlowStatus('NEEDS_PHONE_SETUP');
            } else {
              await executeBiometricAuthentication(devCoords);
            }
          } else {
            setPresenceDetails(res);
            setFlowStatus('OUTSIDE_GEOFENCE');
          }
        } catch (err: any) {
          if (err.status === 422 || err.code === 'OUTSIDE_GEOFENCE' || err.status === 'OUTSIDE_GEOFENCE') {
            setPresenceDetails({
              verified: false,
              distanceMeters: err.distanceMeters,
              allowedRadiusMeters: err.allowedRadiusMeters,
              message: err.message || "You're outside the classroom attendance area."
            });
            setFlowStatus('OUTSIDE_GEOFENCE');
          } else if (err.code === 'ACCURACY_TOO_LOW') {
            setFlowStatus('LOCATION_ERROR');
            setErrorMessage(err.message || 'Location accuracy is too low. Please enable high-accuracy GPS and try again.');
          } else {
            setFlowStatus('LOCATION_ERROR');
            setErrorMessage(err.message || 'Server communication error during presence check.');
          }
        }
      },
      (err) => {
        setFlowStatus('LOCATION_ERROR');
        if (err.code === 1) { // PERMISSION_DENIED
          setErrorMessage('Location permission denied. Please allow location access in your browser settings to mark attendance.');
        } else if (err.code === 2) {
          setErrorMessage('GPS position unavailable. Please ensure location services are enabled on your device.');
        } else if (err.code === 3) {
          setErrorMessage('GPS request timed out. Please try again with clear location reception.');
        } else {
          setErrorMessage(`Location error: ${err.message}. Please try again.`);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Loading State
  if (sessionLoading) {
    return (
      <div className="app-container" style={{ maxWidth: '580px', padding: '2rem 1rem', textAlign: 'center' }}>
        <div className="pulse-dot" style={{ width: '16px', height: '16px', margin: '0 auto 1rem' }} />
        <div style={{ color: 'var(--text-muted)' }}>Resolving lecture attendance session...</div>
      </div>
    );
  }

  // Already Marked View
  if (alreadyMarkedRecord) {
    return (
      <div className="app-container" style={{ maxWidth: '580px', padding: '1rem' }}>
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            Attendance Already Recorded!
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            Your attendance for <strong>{activeSession?.subject?.name || 'this course'}</strong> in room <strong>{activeSession?.classroom?.roomCode}</strong> was confirmed.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={onNavigateBack}>
              <ArrowLeft size={16} /> Back to Dashboard
            </Button>
            <Button variant="outline" onClick={onNavigateHistory}>
              View History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No Active Session View
  if (!activeSession) {
    return (
      <div className="app-container" style={{ maxWidth: '580px', padding: '1rem' }}>
        <EmptyState
          icon={<Radio size={36} />}
          title="No Active Attendance Window"
          description="There is currently no open attendance session for your enrolled courses."
          actionLabel="Back to Dashboard"
          onAction={onNavigateBack}
        />
      </div>
    );
  }

  // Attendance Success View
  if (attendanceSuccess) {
    return (
      <div className="app-container" style={{ maxWidth: '580px', padding: '1rem' }}>
        <div className="card" style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          border: '2px solid var(--color-success)'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <CheckCircle2 size={42} />
          </div>

          <Badge variant="present" style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem', marginBottom: '0.75rem' }}>
            STATUS: PRESENT
          </Badge>

          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            Attendance Verified & Recorded!
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            Congratulations, {user.fullName}! Your physical presence in <strong>{activeSession.classroom?.roomCode}</strong> was confirmed via GPS Geofence and Platform Authenticator.
          </p>

          <div style={{
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
            fontSize: '0.8rem',
            lineHeight: 1.6
          }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Student PRN:</span>
              <strong className="mono">{user.prn}</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Subject:</span>
              <strong>{activeSession.subject?.name} ({activeSession.subject?.code})</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Classroom:</span>
              <strong>{activeSession.classroom?.roomCode}</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Recorded Distance:</span>
              <strong>{presenceDetails?.distanceMeters?.toFixed(1) || '0.0'} meters</strong>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Verification Mode:</span>
              <span style={{ color: 'var(--color-success-dark)', fontWeight: 600 }}>Real GPS Geofence + Hardware Authenticator</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Button variant="primary" onClick={onNavigateBack}>
              Return to Dashboard
            </Button>
            <Button variant="outline" onClick={onNavigateHistory}>
              My Attendance History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBusy = flowStatus === 'ACQUIRING_GPS' || flowStatus === 'CHECKING_GEOFENCE' || flowStatus === 'AUTHENTICATING_PHONE';

  return (
    <div className="app-container" style={{ maxWidth: '580px', padding: '1rem' }}>
      
      {/* Navigation Top Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={onNavigateBack}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.825rem'
          }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>

      {/* Session Overview Card */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
          <div className="flex items-center gap-2">
            <span className="pulse-dot" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)' }}>
              ATTENDANCE SESSION ACTIVE
            </span>
          </div>
          <Badge variant="neutral">{activeSession.classroom?.roomCode}</Badge>
        </div>

        <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.25rem' }}>
          {activeSession.subject?.code} — {activeSession.subject?.name}
        </h1>
        <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
          Instructor: {activeSession.teacher?.fullName} • Classroom: <strong>{activeSession.classroom?.roomCode}</strong> ({activeSession.classroom?.allowedRadiusMeters || 25}m geofence)
        </p>
      </div>

      {/* Student Identity Card */}
      <div className="card" style={{
        padding: '1rem 1.25rem',
        borderLeft: '4px solid var(--brand-primary)',
        backgroundColor: '#ffffff',
        marginBottom: '1.25rem'
      }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Student Identity
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.15rem' }}>
              {user.fullName}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              PRN: <span className="mono font-semibold" style={{ color: 'var(--brand-primary)' }}>{user.prn}</span>
              {user.rollNumber && <> • Roll: <span className="mono">{user.rollNumber}</span></>}
            </div>
          </div>
          <Badge variant="present" icon={<CheckCircle2 size={12} />}>
            CONFIRMED
          </Badge>
        </div>
      </div>

      {/* MAIN ATTENDANCE ACTION CARD */}
      <div className="card" style={{
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        boxShadow: 'var(--shadow-md)'
      }}>

        {/* Read-Only Status Banners Generated by Backend */}

        {/* 1. Location Verified Result (Read-Only) */}
        {(flowStatus === 'LOCATION_VERIFIED' || flowStatus === 'AUTHENTICATING_PHONE') && (
          <div style={{
            backgroundColor: 'var(--color-success-bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-success-border)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem'
          }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--color-success-dark)', fontWeight: 600, fontSize: '0.875rem' }}>
              <CheckCircle2 size={18} color="var(--color-success)" />
              <span>Location verified</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-success-dark)', marginTop: '0.3rem', lineHeight: 1.5 }}>
              • Classroom presence confirmed inside {activeSession.classroom?.roomCode} geofence ({presenceDetails?.distanceMeters?.toFixed(1) || '0.0'}m from center).
            </div>
          </div>
        )}

        {/* 2. Outside Geofence Result (Read-Only) */}
        {flowStatus === 'OUTSIDE_GEOFENCE' && (
          <div style={{
            backgroundColor: 'var(--color-danger-bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-danger-border)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem'
          }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--color-danger-dark)', fontWeight: 600, fontSize: '0.875rem' }}>
              <XCircle size={18} color="var(--color-danger)" />
              <span>You're outside the classroom attendance area.</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-danger-dark)', marginTop: '0.3rem', lineHeight: 1.5 }}>
              Attendance rejected: You are <strong>{presenceDetails?.distanceMeters?.toFixed(1) || '—'}m</strong> away from {activeSession.classroom?.roomCode}. The allowed radius is {presenceDetails?.allowedRadiusMeters || 25}m.
            </div>
          </div>
        )}

        {/* 3. Location / GPS Error (Read-Only) */}
        {flowStatus === 'LOCATION_ERROR' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Alert variant="danger" message={errorMessage} />
          </div>
        )}

        {/* 4. Authentication Error (Read-Only) */}
        {flowStatus === 'AUTH_ERROR' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Alert variant="danger" message={errorMessage} />
          </div>
        )}

        {/* In-Progress Telemetry Spinner */}
        {isBusy && (
          <div style={{ textAlign: 'center', padding: '1rem 0 1.25rem' }}>
            <div className="pulse-dot" style={{ width: '18px', height: '18px', margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {flowStatus === 'ACQUIRING_GPS' && 'Acquiring real device GPS location...'}
              {flowStatus === 'CHECKING_GEOFENCE' && 'Calculating distance & verifying classroom geofence...'}
              {flowStatus === 'AUTHENTICATING_PHONE' && 'Authenticating with device platform authenticator...'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {flowStatus === 'ACQUIRING_GPS' && 'Reading high-accuracy physical device coordinates.'}
              {flowStatus === 'CHECKING_GEOFENCE' && 'Backend computing authoritative Haversine distance.'}
              {flowStatus === 'AUTHENTICATING_PHONE' && 'Please confirm with Face ID, Touch ID, or screen lock.'}
            </div>
          </div>
        )}

        {/* Needs Phone Setup State */}
        {flowStatus === 'NEEDS_PHONE_SETUP' ? (
          <div>
            <div style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div className="flex items-center gap-2" style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                <Smartphone size={16} color="var(--brand-primary)" />
                <span>Device Registration Required</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Your location was verified. To complete attendance, please register this device's platform authenticator (Face ID, Touch ID, or screen lock).
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={registeringPhone}
              onClick={handleRegisterPhone}
              style={{ fontWeight: 700 }}
            >
              <Fingerprint size={18} /> REGISTER DEVICE & CONFIRM ATTENDANCE
            </Button>
          </div>
        ) : (
          /* PRIMARY ACTION BUTTON: [ MARK ATTENDANCE ] */
          <div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textAlign: 'center', lineHeight: 1.5 }}>
              Clicking below will verify your physical GPS presence in <strong>{activeSession.classroom?.roomCode}</strong> and authenticate via your device's security enclave.
            </p>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isBusy}
              disabled={isBusy}
              onClick={handleMarkAttendance}
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                padding: '0.85rem'
              }}
            >
              {isBusy ? (
                <span>VERIFYING ATTENDANCE...</span>
              ) : flowStatus === 'OUTSIDE_GEOFENCE' || flowStatus === 'LOCATION_ERROR' || flowStatus === 'AUTH_ERROR' ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw size={17} /> RETRY ATTENDANCE
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck size={18} /> MARK ATTENDANCE
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Security & Verification Subtext */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Authoritative Geofence & Cryptographic Attendance • Zero fake credentials or simulated biometrics
        </div>

      </div>

    </div>
  );
};
