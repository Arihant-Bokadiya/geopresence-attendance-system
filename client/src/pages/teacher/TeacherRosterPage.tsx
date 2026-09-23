import React, { useState, useEffect } from 'react';
import { apiRequest, API_BASE_URL } from '../../utils/api.js';
import type { AttendanceSession, RosterResponse, RosterStudent } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { 
  Users, CheckCircle2, XCircle, Search, Download, 
  RefreshCw, Filter, ArrowLeft
} from 'lucide-react';

interface TeacherRosterPageProps {
  initialSessionId?: string;
  onBack: () => void;
}

export const TeacherRosterPage: React.FC<TeacherRosterPageProps> = ({
  initialSessionId,
  onBack
}) => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [rosterData, setRosterData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'REJECTED'>('ALL');

  // Override State
  const [overrideStudent, setOverrideStudent] = useState<{ prn: string; name: string } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [overrideReason, setOverrideReason] = useState('Physically verified in lecture');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const data = await apiRequest<{ sessions: AttendanceSession[] }>('/sessions?limit=30');
        setSessions(data.sessions);
        if (!selectedSessionId && data.sessions.length > 0) {
          setSelectedSessionId(data.sessions[0].id);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchRoster(selectedSessionId);
    }
  }, [selectedSessionId]);

  const fetchRoster = async (sessionId: string) => {
    try {
      const data = await apiRequest<RosterResponse>(`/reports/sessions/${sessionId}/roster`);
      setRosterData(data);
    } catch (err) {
      console.error('Failed to load roster:', err);
    }
  };

  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideStudent || !selectedSessionId) return;

    try {
      setOverrideSubmitting(true);
      await apiRequest('/attendance/manual-override', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: selectedSessionId,
          studentPrn: overrideStudent.prn,
          status: overrideStatus,
          reason: overrideReason
        })
      });

      setOverrideStudent(null);
      setAlertMsg(`Updated ${overrideStudent.name} (${overrideStudent.prn}) to ${overrideStatus}.`);
      setTimeout(() => setAlertMsg(null), 4000);
      await fetchRoster(selectedSessionId);
    } catch (err: any) {
      alert(err.message || 'Failed to update attendance');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const filteredRoster = (rosterData?.roster || []).filter((s) => {
    const matchesSearch = 
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.prn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNumber.includes(searchQuery);

    if (!matchesSearch) return false;

    if (statusFilter === 'PRESENT') {
      return s.status === 'PRESENT' || s.status === 'MANUAL_OVERRIDE';
    }
    if (statusFilter === 'ABSENT') {
      return s.status === 'ABSENT';
    }
    if (statusFilter === 'REJECTED') {
      return s.status.includes('REJECTED');
    }
    return true;
  });

  return (
    <div className="app-container">
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: 'Attendance Roster', active: true }
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1>Class Attendance Roster</h1>
          <p>Authoritative class roster reconciling verified present students and absent peers.</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedSessionId && (
            <a
              href={`${API_BASE_URL}/reports/sessions/${selectedSessionId}/export-csv`}
              className="btn btn-secondary btn-sm"
              download
            >
              <Download size={14} /> Export ERP CSV
            </a>
          )}
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>
            Back
          </Button>
        </div>
      </div>

      {alertMsg && (
        <Alert variant="success" onClose={() => setAlertMsg(null)}>
          {alertMsg}
        </Alert>
      )}

      {/* Session Selector Card */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div className="grid grid-cols-2 md-grid-cols-1" style={{ gap: '1rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Select Attendance Session</label>
            <select
              className="form-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.sessionCode} • {s.subject.code} — {new Date(s.startedAt).toLocaleDateString()} ({s.classroom.roomCode}) [{s.status}]
                </option>
              ))}
            </select>
          </div>

          {rosterData && (
            <div className="flex items-center gap-4 justify-end md-grid-cols-1">
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PRESENT / TOTAL</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>
                  {rosterData.summary.presentCount} / {rosterData.summary.totalEnrolled}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RATE</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                  {rosterData.summary.attendancePercentage}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          
          <div className="flex items-center gap-2 flex-1" style={{ minWidth: '240px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.2rem' }}
                placeholder="Search student name, PRN, or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter:</span>
            <div className="flex gap-1">
              {(['ALL', 'PRESENT', 'ABSENT', 'REJECTED'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Roster Table */}
      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>Permanent Reg. No (PRN)</th>
                <th>Student Name</th>
                <th>Status</th>
                <th>Distance</th>
                <th>Marked Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((student) => {
                const isPresent = student.status === 'PRESENT';
                const isOverride = student.status === 'MANUAL_OVERRIDE';
                const isRejected = student.status.includes('REJECTED');

                return (
                  <tr key={student.prn}>
                    <td className="mono" style={{ fontWeight: 600 }}>{student.rollNumber}</td>
                    <td className="mono" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                      {student.prn}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{student.studentName}</td>
                    <td>
                      {isPresent ? (
                        <Badge variant="present" icon={<CheckCircle2 size={12} />}>PRESENT</Badge>
                      ) : isOverride ? (
                        <Badge variant="override" icon={<CheckCircle2 size={12} />}>OVERRIDE</Badge>
                      ) : isRejected ? (
                        <Badge variant="absent" icon={<XCircle size={12} />} title={student.failureReason || ''}>REJECTED</Badge>
                      ) : (
                        <Badge variant="neutral" icon={<XCircle size={12} />}>ABSENT</Badge>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: '0.825rem' }}>
                      {student.locationDistanceMeters !== null
                        ? `${student.locationDistanceMeters}m`
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {student.markedTimestamp
                        ? new Date(student.markedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '—'}
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setOverrideStudent({ prn: student.prn, name: student.studentName });
                          setOverrideStatus(isPresent ? 'ABSENT' : 'PRESENT');
                        }}
                      >
                        Override
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override Modal */}
      {overrideStudent && (
        <Modal
          isOpen={true}
          onClose={() => setOverrideStudent(null)}
          title="Manual Attendance Override"
          subtitle={`Student: ${overrideStudent.name} (${overrideStudent.prn})`}
        >
          <form onSubmit={handleManualOverride}>
            <div className="form-group">
              <label className="form-label">Set Attendance Status *</label>
              <select
                className="form-select"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as any)}
              >
                <option value="PRESENT">Mark as PRESENT</option>
                <option value="ABSENT">Mark as ABSENT</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Audit Log Reason *</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for modifying attendance (e.g. verified physically in seat)"
                required
              />
            </div>

            <div className="flex justify-end gap-2" style={{ marginTop: '1rem' }}>
              <Button variant="secondary" onClick={() => setOverrideStudent(null)} disabled={overrideSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={overrideSubmitting}>
                Save Override
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
