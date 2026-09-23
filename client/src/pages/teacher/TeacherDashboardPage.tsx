import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { AttendanceSession, User } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { 
  PlayCircle, Radio, Clock, ArrowRight, History, CheckCircle2, Users
} from 'lucide-react';

interface TeacherDashboardPageProps {
  user: User;
  onNavigateStart: () => void;
  onNavigateActive: (sessionId: string) => void;
  onNavigateRoster: (sessionId: string) => void;
  onNavigateHistory: () => void;
}

export const TeacherDashboardPage: React.FC<TeacherDashboardPageProps> = ({
  user,
  onNavigateStart,
  onNavigateActive,
  onNavigateRoster,
  onNavigateHistory
}) => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ sessions: AttendanceSession[] }>('/sessions?limit=10');
      setSessions(data.sessions || []);

      const active = data.sessions?.find(s => s.status === 'ACTIVE');
      setActiveSession(active || null);
    } catch (err) {
      console.error('Failed to load teacher dashboard data:', err);
      setSessions([]);
      setActiveSession(null);
    } finally {
      setLoading(false);
    }
  };

  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="app-container" style={{ maxWidth: '900px' }}>
      
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.75rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            GeoPresence • Faculty Portal
          </div>
          <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Instructor Console</span>
            {activeSession && <span className="pulse-dot" title="Active Lecture Live" />}
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Welcome, {user.fullName} {user.teacherCode && <>• <span className="mono">{user.teacherCode}</span></>} {user.department && <>• {user.department}</>}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex gap-2">
          {activeSession ? (
            <Button variant="primary" icon={<Radio size={16} />} onClick={() => onNavigateActive(activeSession.id)}>
              ACTIVE SESSION
            </Button>
          ) : (
            <Button variant="primary" icon={<PlayCircle size={16} />} onClick={onNavigateStart}>
              START ATTENDANCE
            </Button>
          )}

          <Button variant="secondary" icon={<History size={16} />} onClick={onNavigateHistory}>
            HISTORY
          </Button>
        </div>
      </div>

      {/* Prominent Active Session Card (if currently running) */}
      {activeSession && (
        <div className="card" style={{
          marginBottom: '1.75rem',
          borderLeft: '4px solid var(--color-success)',
          backgroundColor: '#ffffff',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
            <div className="flex items-center gap-2">
              <span className="pulse-dot" />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-success)' }}>
                ATTENDANCE ACTIVE
              </span>
              <Badge variant="active">LIVE</Badge>
            </div>
            <Badge variant="neutral">
              {activeSession.classroom?.roomCode}
            </Badge>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
                {activeSession.subject?.code} — {activeSession.subject?.name}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem' }}>
                Cohort: <strong>{activeSession.division?.name}</strong> {activeSession.batch && `(${activeSession.batch.name})`} • Classroom: <strong>{activeSession.classroom?.roomCode}</strong>
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                GPS Geofence: <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{activeSession.classroom?.allowedRadiusMeters || 25}m radius</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Recorded</div>
                <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-success)' }}>
                  {activeSession.stats?.presentCount ?? 0}
                </div>
              </div>

              <Button variant="primary" size="lg" onClick={() => onNavigateActive(activeSession.id)}>
                <span>Open Active Console</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State / Start Attendance Prompt (if no session currently active) */}
      {!activeSession && !loading && (
        <div className="card" style={{
          padding: '2.25rem 1.5rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          marginBottom: '1.75rem',
          border: '1px solid var(--border-default)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--brand-primary-light)',
            color: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <PlayCircle size={24} />
          </div>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
            Today's Attendance
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.25rem' }}>
            Ready to conduct attendance? Select your assigned curriculum course, student division/batch, and classroom geofence to open the attendance window.
          </p>
          <Button variant="primary" size="md" icon={<PlayCircle size={16} />} onClick={onNavigateStart}>
            START ATTENDANCE
          </Button>
        </div>
      )}

      {/* Recent Sessions Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface-subtle)'
        }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>
            Recent Attendance Sessions
          </h3>
          <button
            type="button"
            onClick={onNavigateHistory}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            View All History →
          </button>
        </div>

        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>DATE & TIME</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SUBJECT</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>COHORT</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CLASSROOM</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PRESENT</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div className="pulse-dot" style={{ width: '14px', height: '14px', margin: '0 auto 0.75rem' }} />
                  Loading sessions...
                </td>
              </tr>
            ) : recentSessions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No attendance sessions conducted yet. Click "START ATTENDANCE" above to conduct your first lecture attendance.
                </td>
              </tr>
            ) : (
              recentSessions.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem' }}>
                    <div>{new Date(s.startedAt).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.subject?.code}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.subject?.name}</div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem' }}>
                    {s.division?.name} {s.batch && `(${s.batch.name})`}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="mono font-semibold" style={{ fontSize: '0.85rem' }}>
                      {s.classroom?.roomCode}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                      {s.stats?.presentCount ?? 0}
                    </span>
                    {s.stats?.totalEnrolled !== undefined && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> / {s.stats.totalEnrolled}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                      onClick={() => onNavigateRoster(s.id)}
                    >
                      View Roster
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
