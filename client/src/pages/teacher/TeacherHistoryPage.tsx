import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { AttendanceSession } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { Calendar, Users, CheckCircle2, ArrowRight } from 'lucide-react';

interface TeacherHistoryPageProps {
  onSelectSession: (sessionId: string) => void;
  onBack: () => void;
}

export const TeacherHistoryPage: React.FC<TeacherHistoryPageProps> = ({
  onSelectSession,
  onBack
}) => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ sessions: AttendanceSession[] }>('/sessions?limit=50');
      setSessions(data.sessions);
    } catch (err) {
      console.error('Error fetching session history:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: 'Attendance History', active: true }
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1>Faculty Lecture Attendance History</h1>
          <p>Chronological record of all conducted physical presence sessions with attendance metrics.</p>
        </div>
      </div>

      <div className="card">
        {sessions.length === 0 ? (
          <EmptyState
            title="No attendance sessions yet"
            description="No previous attendance sessions have been logged for this faculty account."
          />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Session Date</th>
                  <th>Session Code</th>
                  <th>Subject</th>
                  <th>Division / Cohort</th>
                  <th>Classroom</th>
                  <th>Total Enrolled</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {new Date(s.startedAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                      {s.sessionCode}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <div>{s.subject.code}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.subject.name}</div>
                    </td>
                    <td>{s.division.name}</td>
                    <td>
                      <span className="mono" style={{ fontSize: '0.8rem' }}>{s.classroom.roomCode}</span>
                    </td>
                    <td className="mono">{s.stats?.totalEnrolled || 0}</td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                      {s.stats?.presentCount || 0}
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                      {s.stats?.absentCount || 0}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {s.stats?.attendancePercentage || 0}%
                    </td>
                    <td>
                      <Badge variant={s.status === 'ACTIVE' ? 'active' : 'closed'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ArrowRight size={13} />}
                        onClick={() => onSelectSession(s.id)}
                      >
                        Inspect Roster
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
