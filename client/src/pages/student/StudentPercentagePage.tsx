import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { User, StudentAttendanceHistoryResponse } from '../../types/index.js';
import { StatCard } from '../../components/ui/StatCard.js';
import { Badge } from '../../components/ui/Badge.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { PieChart, BookOpen, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface StudentPercentagePageProps {
  user: User;
}

export const StudentPercentagePage: React.FC<StudentPercentagePageProps> = ({ user }) => {
  const [data, setData] = useState<StudentAttendanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<StudentAttendanceHistoryResponse>('/attendance/history');
      setData(res);
    } catch (err) {
      console.error('Failed to load percentage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary || { totalConducted: 0, totalAttended: 0, overallPercentage: 0 };
  const subjectStats = data?.subjectStats || [];
  const meetsCriteria = summary.overallPercentage >= 75.0;

  return (
    <div className="app-container" style={{ maxWidth: '860px', padding: '1.25rem 1rem' }}>
      
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Academic Compliance & Eligibility
        </div>
        <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>Attendance Percentage</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Detailed compliance tracking against the mandatory university 75% attendance threshold.
        </p>
      </div>

      {/* University Norm Alert Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        {meetsCriteria ? (
          <Alert
            variant="success"
            title="EXAMINATION ELIGIBILITY GRANTED"
            message={`Your aggregate attendance is ${summary.overallPercentage}%, which satisfies the University Academic Ordinance requirement of 75.0% minimum attendance.`}
          />
        ) : (
          <Alert
            variant="danger"
            title="CRITICAL: ATTENDANCE SHORTAGE DETECTED"
            message={`Your current aggregate attendance (${summary.overallPercentage}%) is below the mandatory 75.0% threshold. You are at risk of detention from end-semester examinations.`}
          />
        )}
      </div>

      {/* Primary KPI Card with Large Meter */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AGGREGATE SEMESTER ATTENDANCE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: meetsCriteria ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {summary.overallPercentage}%
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                ({summary.totalAttended} of {summary.totalConducted} lectures attended)
              </span>
            </div>

            <div style={{ marginTop: '0.75rem', width: '100%', maxWidth: '400px' }}>
              <div style={{
                height: '10px',
                borderRadius: '5px',
                backgroundColor: 'var(--border-subtle)',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(summary.overallPercentage, 100)}%`,
                  backgroundColor: meetsCriteria ? 'var(--color-success)' : 'var(--color-danger)',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <div className="flex justify-between" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                <span>0%</span>
                <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>Threshold: 75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div style={{
            borderLeft: '1px solid var(--border-subtle)',
            paddingLeft: '1.5rem',
            minWidth: '220px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>STUDENT RECORD</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.fullName}</div>
            <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
              {user.prn}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Roll: {user.rollNumber} • {user.activeDivision?.name || 'Division A'}
            </div>
          </div>
        </div>
      </div>

      {/* Subject-Wise Breakdown (Part 11) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={17} color="var(--brand-primary)" />
            Subject-Wise Attendance Breakdown
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="pulse-dot" style={{ width: '16px', height: '16px', margin: '0 auto 1rem' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Computing course compliance...</div>
          </div>
        ) : subjectStats.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              title="No Subject Attendance Data"
              description="Attendance data will appear once your instructors conduct sessions for your enrolled courses."
            />
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>COURSE</th>
                  <th>CONDUCTED</th>
                  <th>ATTENDED</th>
                  <th>PERCENTAGE</th>
                  <th>COMPLIANCE STATUS</th>
                </tr>
              </thead>
              <tbody>
                {subjectStats.map((sub) => {
                  const isEligible = sub.percentage >= 75.0;
                  // Calculate lectures needed to reach 75% or lectures can miss
                  let advice = '';
                  if (!isEligible) {
                    // (attended + x) / (conducted + x) >= 0.75 => x >= (0.75*conducted - attended) / 0.25
                    const needed = Math.ceil((0.75 * sub.conducted - sub.attended) / 0.25);
                    advice = `Needs ${Math.max(needed, 1)} consecutive classes to reach 75%`;
                  } else {
                    // attended / (conducted + y) >= 0.75 => y <= (attended - 0.75*conducted) / 0.75
                    const canMiss = Math.floor((sub.attended - 0.75 * sub.conducted) / 0.75);
                    advice = canMiss > 0 ? `Can miss ${canMiss} classes and remain above 75%` : 'On boundary';
                  }

                  return (
                    <tr key={sub.code}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{sub.code}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub.name}</div>
                      </td>

                      <td className="mono" style={{ fontSize: '0.85rem' }}>
                        {sub.conducted}
                      </td>

                      <td className="mono" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {sub.attended}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="mono" style={{
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            color: isEligible ? 'var(--color-success)' : 'var(--color-danger)'
                          }}>
                            {sub.percentage}%
                          </span>
                        </div>
                        <div style={{
                          height: '5px',
                          width: '100px',
                          backgroundColor: 'var(--border-subtle)',
                          borderRadius: '3px',
                          marginTop: '0.25rem',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(sub.percentage, 100)}%`,
                            backgroundColor: isEligible ? 'var(--color-success)' : 'var(--color-danger)'
                          }} />
                        </div>
                      </td>

                      <td>
                        <div style={{ marginBottom: '0.25rem' }}>
                          <Badge variant={isEligible ? 'present' : 'danger'}>
                            {isEligible ? 'Eligible' : 'Shortage'}
                          </Badge>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {advice}
                        </div>
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
