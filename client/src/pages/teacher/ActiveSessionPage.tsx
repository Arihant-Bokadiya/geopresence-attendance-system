import React, { useState, useEffect } from 'react';
import { apiRequest, API_BASE_URL } from '../../utils/api.js';
import type { AttendanceSession, RosterResponse } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog.js';
import { Alert } from '../../components/ui/Alert.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { 
  Square, RefreshCw, Radio, CheckCircle2, Clock, 
  MapPin, Users, ArrowLeft, Cpu, ShieldCheck
} from 'lucide-react';

interface ActiveSessionPageProps {
  sessionId?: string | null;
  onSessionClosed: () => void;
  onBack: () => void;
  onNavigateStart?: () => void;
}

export const ActiveSessionPage: React.FC<ActiveSessionPageProps> = ({
  sessionId,
  onSessionClosed,
  onBack,
  onNavigateStart
}) => {
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(sessionId || null);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [rosterData, setRosterData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Emergency OTP Fallback Toggle
  const [showOtpFallback, setShowOtpFallback] = useState(false);

  // Manual Override State
  const [overrideStudent, setOverrideStudent] = useState<{ prn: string; name: string } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [overrideReason, setOverrideReason] = useState('Physically verified in classroom seat');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  useEffect(() => {
    if (sessionId) {
      setResolvedSessionId(sessionId);
    } else {
      setLoading(true);
      apiRequest<{ sessions: AttendanceSession[] }>('/sessions?status=ACTIVE&limit=1')
        .then((res) => {
          const act = res.sessions.find(s => s.status === 'ACTIVE');
          if (act) {
            setResolvedSessionId(act.id);
          } else {
            setSession(null);
            setLoading(false);
          }
        })
        .catch(() => {
          setSession(null);
          setLoading(false);
        });
    }
  }, [sessionId]);

  useEffect(() => {
    if (resolvedSessionId) {
      fetchSession(resolvedSessionId);
      fetchRoster(resolvedSessionId);
    }
  }, [resolvedSessionId]);

  const fetchSession = async (id: string) => {
    try {
      setLoading(true);
      const data = await apiRequest<{ session: AttendanceSession }>(`/sessions/${id}`);
      setSession(data.session);
    } catch (err: any) {
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (id: string) => {
    try {
      const data = await apiRequest<RosterResponse>(`/reports/sessions/${id}/roster`);
      setRosterData(data);
    } catch (err: any) {
      console.error('Error fetching roster:', err);
    }
  };

  // Real-Time Countdown Timer
  useEffect(() => {
    if (!session || session.status !== 'ACTIVE') {
      setTimeLeftSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(session.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining === 0 && session.status === 'ACTIVE') {
        setSession(prev => prev ? { ...prev, status: 'EXPIRED' } : null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt, session?.status]);

  // Real-Time Server-Sent Events (SSE) Live Feed Subscription
  useEffect(() => {
    const targetId = resolvedSessionId || session?.id;
    if (!targetId) return;

    const token = typeof window !== 'undefined'
      ? (sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token'))
      : null;
    const eventSource = new EventSource(
      `${API_BASE_URL}/sessions/${targetId}/live?token=${token}`
    );

    eventSource.addEventListener('punch', () => {
      fetchRoster(targetId);
      fetchSession(targetId);
    });

    eventSource.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSession(prev => prev ? { ...prev, status: data.status } : null);
      } catch (err) {}
    });

    return () => {
      eventSource.close();
    };
  }, [resolvedSessionId, session?.id]);

  const handleConfirmClose = async () => {
    const targetId = session?.id || resolvedSessionId;
    if (!targetId) return;

    try {
      setClosing(true);
      await apiRequest(`/sessions/${targetId}/close`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'CLOSED' } : null);
      setIsCloseDialogOpen(false);
      setMessage('Attendance session has been finalized and closed.');
      await fetchRoster(targetId);
      await fetchSession(targetId);
      onSessionClosed();
    } catch (err: any) {
      alert(err.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  const handleRotateOtp = async () => {
    const targetId = session?.id || resolvedSessionId;
    if (!targetId) return;

    try {
      const res = await apiRequest<{ success: boolean; rawOtp: string }>(`/sessions/${targetId}/rotate-otp`, {
        method: 'POST'
      });
      setSession(prev => prev ? { ...prev, rawOtp: res.rawOtp } : null);
      setMessage('Emergency fallback OTP rotated.');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to rotate OTP');
    }
  };

  const handleManualOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = session?.id || resolvedSessionId;
    if (!overrideStudent || !targetId) return;

    try {
      setOverrideSubmitting(true);
      await apiRequest('/attendance/manual-override', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: targetId,
          studentPrn: overrideStudent.prn,
          status: overrideStatus,
          reason: overrideReason,
        }),
      });

      setOverrideStudent(null);
      setMessage(`Student ${overrideStudent.name} status updated to ${overrideStatus}.`);
      setTimeout(() => setMessage(null), 4000);
      await fetchRoster(targetId);
    } catch (err: any) {
      alert(err.message || 'Failed to override attendance');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="pulse-dot" style={{ width: '18px', height: '18px', margin: '0 auto 1.25rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading attendance session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container" style={{ padding: '2.5rem 1rem', maxWidth: '640px' }}>
        <EmptyState
          title="No Active Attendance Session"
          description="There is currently no live attendance session in progress. Start an attendance session to begin."
          actionLabel="Start Attendance Session"
          onAction={onNavigateStart || onBack}
        />
      </div>
    );
  }

  const presentCount = rosterData?.summary?.presentCount ?? (session.stats?.presentCount || 0);
  const totalEnrolled = rosterData?.summary?.totalEnrolled ?? (session.stats?.totalEnrolled || 0);
  const classroomDevice = session.classroom?.device?.deviceId || 'No registered device';

  return (
    <div className="app-container">
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: `Session ${session.sessionCode}`, active: true }
      ]} />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Active Attendance Console</h1>
            <Badge variant={session.status === 'ACTIVE' ? 'active' : 'closed'}>
              {session.status}
            </Badge>
          </div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Real-time Verification active: Physical GPS Geofence + Cryptographic Platform Authentication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {session.status === 'ACTIVE' ? (
            <Button
              variant="danger"
              size="md"
              icon={<Square size={15} />}
              onClick={() => setIsCloseDialogOpen(true)}
              style={{ fontWeight: 600 }}
            >
              CLOSE ATTENDANCE
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>
              Return to Dashboard
            </Button>
          )}
        </div>
      </div>

      {message && (
        <Alert variant="success" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {/* Session Metadata & Live Metrics Grid */}
      <div className="grid grid-cols-4 md-grid-cols-2 sm-grid-cols-1" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Course Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            SUBJECT & COHORT
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0 0.15rem' }}>
            {session.subject.code}
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            {session.subject.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '0.35rem' }}>
            Division: {session.division.name} {session.batch && `(${session.batch.name})`}
          </div>
        </div>

        {/* Classroom & Presence Device Card */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--brand-primary)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            CLASSROOM & HARDWARE
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0 0.15rem' }}>
            {session.classroom.roomCode}
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            {session.classroom.buildingName}
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: '0.78rem', color: 'var(--color-success-dark)', fontWeight: 600, marginTop: '0.35rem' }}>
            <MapPin size={13} color="var(--color-success)" />
            <span>Geofence: {session.classroom.allowedRadiusMeters}m radius</span>
          </div>
        </div>

        {/* Live Attendance Count */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            ATTENDANCE COUNT
          </div>
          <div className="mono font-semibold" style={{ fontSize: '2rem', color: 'var(--color-success)', margin: '0.2rem 0' }}>
            {presentCount} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {totalEnrolled}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {totalEnrolled > 0 ? `${Math.round((presentCount / totalEnrolled) * 100)}% verified` : 'Awaiting punches'}
          </div>
        </div>

        {/* Session Time Remaining */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            SESSION WINDOW
          </div>
          <div className="mono font-semibold" style={{ fontSize: '2rem', color: timeLeftSeconds < 60 ? 'var(--color-danger)' : 'var(--brand-primary)', margin: '0.2rem 0' }}>
            {session.status === 'ACTIVE' ? formatTimer(timeLeftSeconds) : '00:00'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {session.status === 'ACTIVE' ? 'Time remaining' : 'Session finalized'}
          </div>
        </div>

      </div>

      {/* Live Student Roster Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface-subtle)'
        }}>
          <div className="flex items-center gap-2">
            <Users size={16} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>
              Live Student Roster ({rosterData?.roster?.length || 0} Enrolled)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="pulse-dot" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-time feed active
            </span>
            <Button variant="secondary" size="sm" onClick={() => fetchRoster(session.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
              <RefreshCw size={12} />
            </Button>
          </div>
        </div>

        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ROLL NO</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PRN</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>STUDENT NAME</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>VERIFIED TIME</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>LAYERS / DISTANCE</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>OVERRIDE</th>
            </tr>
          </thead>
          <tbody>
            {!rosterData || rosterData.roster.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading enrolled students...
                </td>
              </tr>
            ) : (
              rosterData.roster.map((student) => {
                const isPresent = student.status === 'PRESENT' || student.status === 'MANUAL_OVERRIDE';
                return (
                  <tr key={student.prn} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{student.rollNumber || '—'}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="mono font-semibold" style={{ color: 'var(--brand-primary)', fontSize: '0.85rem' }}>
                        {student.prn}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{student.studentName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{student.email}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {isPresent ? (
                        <Badge variant="present" icon={<CheckCircle2 size={12} />}>
                          {student.status === 'MANUAL_OVERRIDE' ? 'OVERRIDE' : 'PRESENT'}
                        </Badge>
                      ) : student.status === 'REJECTED' ? (
                        <Badge variant="absent">
                          REJECTED
                        </Badge>
                      ) : (
                        <Badge variant="neutral">
                          WAITING
                        </Badge>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: isPresent ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {student.markedTimestamp ? new Date(student.markedTimestamp).toLocaleTimeString() : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem' }}>
                      {isPresent ? (
                        <div>
                          <div style={{ color: 'var(--color-success-dark)', fontWeight: 500 }}>
                            {student.locationDistanceMeters !== null ? `✓ ${student.locationDistanceMeters.toFixed(1)}m from center` : 'GPS Verified'}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {student.verificationMode || 'GPS + ESP32 + Biometric'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not submitted</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => {
                          setOverrideStudent({ prn: student.prn, name: student.studentName });
                          setOverrideStatus(isPresent ? 'ABSENT' : 'PRESENT');
                        }}
                      >
                        {isPresent ? 'Mark Absent' : 'Mark Present'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Override Modal */}
      <Modal
        isOpen={!!overrideStudent}
        onClose={() => setOverrideStudent(null)}
        title="Manual Attendance Override"
      >
        {overrideStudent && (
          <form onSubmit={handleManualOverrideSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem' }}>
              Override attendance for <strong>{overrideStudent.name}</strong> ({overrideStudent.prn}):
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                New Status
              </label>
              <select
                className="form-select"
                value={overrideStatus}
                onChange={(e: any) => setOverrideStatus(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
              >
                <option value="PRESENT">PRESENT (Manual Confirmation)</option>
                <option value="ABSENT">ABSENT (Mark Absent / Revoke)</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Mandatory Audit Override Reason *
              </label>
              <textarea
                className="form-input"
                required
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Student physically verified sitting in classroom 3rd row."
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
              />
            </div>

            <div className="flex justify-end gap-2" style={{ marginTop: '0.5rem' }}>
              <Button variant="secondary" type="button" onClick={() => setOverrideStudent(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={overrideSubmitting}>
                Save Override
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Close Attendance Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isCloseDialogOpen}
        title="Finalize Attendance Session"
        message={`Are you sure you want to close attendance for ${session.subject.code}? ${presentCount} students have been recorded present. After closing, no further attendance punches will be accepted.`}
        confirmLabel="Finalize & Close Attendance"
        cancelLabel="Continue Session"
        variant="danger"
        loading={closing}
        onConfirm={handleConfirmClose}
        onClose={() => setIsCloseDialogOpen(false)}
      />

    </div>
  );
};
