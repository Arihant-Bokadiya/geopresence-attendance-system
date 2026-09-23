import React, { useState, useEffect } from 'react';
import { apiRequest, API_BASE_URL } from '../../utils/api.js';
import type { AttendanceSession } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Alert } from '../../components/ui/Alert.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { Database, Download, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface ErpExportPageProps {
  onBack: () => void;
}

export const ErpExportPage: React.FC<ErpExportPageProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ sessions: AttendanceSession[] }>('/sessions?limit=50');
      setSessions(data.sessions);
    } catch (err) {
      console.error('Error loading sessions for ERP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToErp = async (sessionId: string) => {
    try {
      setSyncingId(sessionId);
      const res = await apiRequest<{ success: boolean; batch: any; message: string }>(
        `/erp/sync/session/${sessionId}`,
        { method: 'POST' }
      );

      setSyncFeedback({
        id: sessionId,
        success: true,
        msg: `Batch ${res.batch.batchCode} acknowledged: ${res.batch.presentCount} present, ${res.batch.absentCount} absent committed to staging ledger.`
      });

      await fetchSessions();
    } catch (err: any) {
      setSyncFeedback({
        id: sessionId,
        success: false,
        msg: `ERP Sync failed: ${err.message || 'Network error transmitting to ERP gateway.'}`
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="app-container">
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: 'ERP Synchronization & Exports', active: true }
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1>College ERP Integration & Ledger Synchronization</h1>
          <p>Export authoritative student presence rosters keyed to student PRNs for academic credit recording.</p>
        </div>
      </div>

      {/* Institutional ERP Staging Notice */}
      <div className="card" style={{
        backgroundColor: 'var(--brand-primary-light)',
        border: '1px solid var(--brand-primary-border)',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem'
      }}>
        <div className="flex items-start gap-3">
          <Database size={20} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--brand-primary)', marginBottom: '0.2rem' }}>
              Institutional ERP Connector Status: Development Integration Gateway (Simulated Adapter)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Attendance sessions synchronize using immutable <strong>student PRNs</strong> as the primary identity key. 
              The backend ledger sync pipeline formats full reconciliation batches (including both verified present students and computed absent peers) and writes to the ERP staging queue.
            </div>
          </div>
        </div>
      </div>

      {syncFeedback && (
        <Alert
          variant={syncFeedback.success ? 'success' : 'danger'}
          onClose={() => setSyncFeedback(null)}
        >
          {syncFeedback.msg}
        </Alert>
      )}

      {/* Finalized Sessions Table */}
      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Session Code</th>
                <th>Subject</th>
                <th>Lecture Date</th>
                <th>Division</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Sync Status</th>
                <th>Export Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const isSynced = s.isErpSynced;

                return (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                      {s.sessionCode}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <div>{s.subject.code}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.subject.name}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(s.startedAt).toLocaleDateString()}
                    </td>
                    <td>{s.division.name}</td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                      {s.stats?.presentCount || 0}
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                      {s.stats?.absentCount || 0}
                    </td>
                    <td>
                      {isSynced ? (
                        <Badge variant="present" icon={<CheckCircle2 size={12} />}>
                          ERP SYNCED
                        </Badge>
                      ) : (
                        <Badge variant="override" icon={<AlertCircle size={12} />}>
                          PENDING SYNC
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <a
                          href={`${API_BASE_URL}/reports/sessions/${s.id}/export-csv`}
                          className="btn btn-secondary btn-sm"
                          download
                          title="Download standardized CSV with PRNs and timestamps"
                        >
                          <Download size={13} />
                          <span>CSV</span>
                        </a>

                        <Button
                          variant={isSynced ? 'secondary' : 'primary'}
                          size="sm"
                          icon={<RefreshCw size={13} className={syncingId === s.id ? 'spin' : ''} />}
                          loading={syncingId === s.id}
                          onClick={() => handleSyncToErp(s.id)}
                        >
                          {isSynced ? 'Re-Sync' : 'Push to ERP'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
