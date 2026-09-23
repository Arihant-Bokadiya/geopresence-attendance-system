import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { User, StudentAttendanceHistoryResponse } from '../../types/index.js';
import { StatCard } from '../../components/ui/StatCard.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { 
  Calendar, CheckCircle2, XCircle, Clock, 
  Search, Filter, ShieldCheck, ArrowUpDown
} from 'lucide-react';

interface StudentHistoryPageProps {
  user: User;
  onNavigateAttendance: () => void;
}

export const StudentHistoryPage: React.FC<StudentHistoryPageProps> = ({
  user,
  onNavigateAttendance
}) => {
  const [historyData, setHistoryData] = useState<StudentAttendanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<StudentAttendanceHistoryResponse>('/attendance/history');
      setHistoryData(res);
    } catch (err) {
      console.error('Failed to load student history:', err);
    } finally {
      setLoading(false);
    }
  };

  const records = historyData?.history || [];
  const subjectStats = historyData?.subjectStats || [];
  const summary = historyData?.summary || { totalConducted: 0, totalAttended: 0, overallPercentage: 0 };

  // Filter records
  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.classroom.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSubject = filterSubject === 'ALL' || r.subjectCode === filterSubject;
    const matchesStatus = filterStatus === 'ALL' || 
      (filterStatus === 'PRESENT' && (r.status === 'PRESENT' || r.status === 'MANUAL_OVERRIDE')) ||
      (filterStatus === 'ABSENT' && r.status === 'ABSENT') ||
      (filterStatus === 'REJECTED' && r.status === 'REJECTED');

    return matchesSearch && matchesSubject && matchesStatus;
  });

  return (
    <div className="app-container" style={{ maxWidth: '960px', padding: '1.25rem 1rem' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Personal Academic Ledger
        </div>
        <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>Attendance History</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Authoritative attendance records verified by classroom GPS and faculty OTP for PRN {user.prn}.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <StatCard
          label="OVERALL ATTENDANCE"
          value={`${summary.overallPercentage}%`}
          indicator={summary.overallPercentage >= 75 ? 'up' : 'down'}
          helpText={summary.overallPercentage >= 75 ? 'Meets 75% college norm' : 'Below 75% minimum threshold'}
        />
        <StatCard
          label="LECTURES CONDUCTED"
          value={summary.totalConducted}
          helpText="Total semester sessions"
        />
        <StatCard
          label="LECTURES ATTENDED"
          value={summary.totalAttended}
          helpText="Verified present"
        />
        <StatCard
          label="MISSED / ABSENT"
          value={summary.totalConducted - summary.totalAttended}
          helpText="Unattended sessions"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by subject, faculty, or classroom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '2.25rem', fontSize: '0.825rem', height: '36px' }}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="select"
              style={{ fontSize: '0.825rem', height: '36px' }}
            >
              <option value="ALL">All Subjects</option>
              {subjectStats.map(s => (
                <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '130px' }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select"
              style={{ fontSize: '0.825rem', height: '36px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="pulse-dot" style={{ width: '16px', height: '16px', margin: '0 auto 1rem' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading verified attendance history...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              title="No attendance sessions yet"
              description={records.length === 0 
                ? "No attendance sessions have been conducted for your division yet." 
                : "No records match your selected filters."}
            />
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>DATE & TIME</th>
                  <th>SUBJECT</th>
                  <th>CLASSROOM</th>
                  <th>TEACHER</th>
                  <th>STATUS</th>
                  <th>VERIFICATION DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item, idx) => {
                  const isPresent = item.status === 'PRESENT' || item.status === 'MANUAL_OVERRIDE';
                  const isRejected = item.status === 'REJECTED';

                  return (
                    <tr key={`${item.sessionId}-${idx}`}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{item.date}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.time}</div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{item.subjectCode}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.subjectName}</div>
                      </td>

                      <td className="mono" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                        {item.classroom}
                      </td>

                      <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {item.teacherName}
                      </td>

                      <td>
                        {isPresent && (
                          <Badge variant="present">
                            {item.status === 'MANUAL_OVERRIDE' ? 'Manual Override' : 'Present'}
                          </Badge>
                        )}
                        {isRejected && (
                          <Badge variant="danger">
                            Rejected
                          </Badge>
                        )}
                        {item.status === 'ABSENT' && (
                          <Badge variant="absent">
                            Absent
                          </Badge>
                        )}
                      </td>

                      <td style={{ fontSize: '0.75rem' }}>
                        {isPresent && item.distanceMeters !== null && (
                          <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                            ✓ Geofence Verified ({item.distanceMeters.toFixed(2)}m)
                          </span>
                        )}
                        {isRejected && (
                          <span style={{ color: 'var(--color-danger)' }}>
                            ✗ {item.failureReason || 'Verification Failed'}
                          </span>
                        )}
                        {item.status === 'ABSENT' && (
                          <span style={{ color: 'var(--text-muted)' }}>
                            No submission recorded
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
