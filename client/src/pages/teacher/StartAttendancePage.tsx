import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Classroom, Subject, Division } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { PlayCircle, MapPin, ShieldCheck, Clock, Layers, ArrowLeft } from 'lucide-react';

interface StartAttendancePageProps {
  onSessionCreated: (sessionId: string) => void;
  onCancel: () => void;
}

export const StartAttendancePage: React.FC<StartAttendancePageProps> = ({
  onSessionCreated,
  onCancel
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('5');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [subRes, divRes, clsRes] = await Promise.all([
          apiRequest<{ subjects: Subject[] }>('/academic/subjects'),
          apiRequest<{ divisions: Division[] }>('/academic/divisions'),
          apiRequest<{ classrooms: Classroom[] }>('/classrooms'),
        ]);

        setSubjects(subRes.subjects);
        setDivisions(divRes.divisions);
        setClassrooms(clsRes.classrooms);

        if (subRes.subjects.length > 0) setSelectedSubjectId(subRes.subjects[0].id);
        if (divRes.divisions.length > 0) setSelectedDivisionId(divRes.divisions[0].id);
        if (clsRes.classrooms.length > 0) setSelectedClassroomId(clsRes.classrooms[0].id);
      } catch (err: any) {
        setError(err.message || 'Failed to load curriculum and classroom metadata.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedClassroom = classrooms.find(c => c.id === selectedClassroomId);
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedDivision = divisions.find(d => d.id === selectedDivisionId);
  const availableBatches = selectedDivision?.batches || [];

  const handleDivisionChange = (divId: string) => {
    setSelectedDivisionId(divId);
    setSelectedBatchId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ success: boolean; session: any }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          divisionId: selectedDivisionId,
          batchId: selectedBatchId || null,
          classroomId: selectedClassroomId,
          durationSeconds: parseInt(durationMinutes, 10) * 60,
        }),
      });

      onSessionCreated(res.session.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start attendance session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '800px' }}>
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onCancel },
        { label: 'Start Attendance Session', active: true }
      ]} />

      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1>Initiate Lecture Attendance Session</h1>
          <p>Select academic subject, cohort division, and physical classroom geofence.</p>
        </div>
        <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={onCancel}>
          Back to Dashboard
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Configuration Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {subjects.length === 0 && (
        <Alert variant="danger" title="No Subjects Configured">
          Attendance cannot be started because there are no subjects configured or assigned to you. Please ask your administrator to configure subjects and assignments.
        </Alert>
      )}

      {divisions.length === 0 && (
        <Alert variant="danger" title="No Divisions Configured">
          Attendance cannot be started because there are no academic divisions configured. Please ask your administrator to create divisions.
        </Alert>
      )}

      {classrooms.length === 0 && (
        <Alert variant="danger" title="No Classrooms Configured">
          Attendance cannot be started because no classroom locations have been configured. Please ask your administrator to register classrooms with GPS geofences.
        </Alert>
      )}

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} color="var(--brand-primary)" />
            <span>Attendance Session Parameters</span>
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Authoritative Dual-Factor Verification
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card-body">
            
            <div className="grid grid-cols-2 md-grid-cols-1" style={{ gap: '1.25rem' }}>
              
              {/* Subject Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="subject-select">Academic Subject *</label>
                <select
                  id="subject-select"
                  className="form-select"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  disabled={loading || submitting || subjects.length === 0}
                  required
                >
                  {subjects.length === 0 ? (
                    <option value="">No subjects assigned</option>
                  ) : (
                    subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name} ({s.credits || 4} Credits)
                      </option>
                    ))
                  )}
                </select>
                <span className="form-helper">Official course code and title registered in ERP</span>
              </div>

              {/* Division Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="division-select">Academic Division *</label>
                <select
                  id="division-select"
                  className="form-select"
                  value={selectedDivisionId}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  disabled={loading || submitting || divisions.length === 0}
                  required
                >
                  {divisions.length === 0 ? (
                    <option value="">No divisions available</option>
                  ) : (
                    divisions.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.academicYear} • Sem {d.semester})
                      </option>
                    ))
                  )}
                </select>
                <span className="form-helper">Target student cohort for roster reconciliation</span>
              </div>

              {/* Batch Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="batch-select">Batch Allocation</label>
                <select
                  id="batch-select"
                  className="form-select"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  disabled={loading || submitting}
                >
                  <option value="">Entire Division (All Batches / Theory Class)</option>
                  {availableBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      Batch {b.name} (Practical / Tutorial)
                    </option>
                  ))}
                </select>
                <span className="form-helper">Select practical lab batch or full division lecture</span>
              </div>

              {/* Classroom Geofence Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="classroom-select">Assigned Classroom *</label>
                <select
                  id="classroom-select"
                  className="form-select"
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  disabled={loading || submitting || classrooms.length === 0}
                  required
                >
                  {classrooms.length === 0 ? (
                    <option value="">No classrooms available</option>
                  ) : (
                    classrooms.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.roomCode} — {c.buildingName} (Floor {c.floorNumber})
                      </option>
                    ))
                  )}
                </select>
                <span className="form-helper">Physical room where lecture is being conducted</span>
              </div>

            </div>

            {/* Authoritative Classroom Geofence Display */}
            {selectedClassroom && (
              <div style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                margin: '1rem 0'
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                  <div className="flex items-center gap-2" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--brand-primary)' }}>
                    <MapPin size={16} />
                    <span>Classroom Geofence Configuration</span>
                  </div>
                  <span className="badge badge-present" style={{ fontSize: '0.725rem' }}>
                    Active Geofence
                  </span>
                </div>

                <div className="grid grid-cols-2 md-grid-cols-1" style={{ gap: '0.75rem', fontSize: '0.825rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Classroom:</span>{' '}
                    <strong>{selectedClassroom.roomCode}</strong> ({selectedClassroom.buildingName})
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>GPS Geofence:</span>{' '}
                    <strong style={{ color: 'var(--color-success)' }}>
                      {selectedClassroom.allowedRadiusMeters} meters
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: '0.735rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem' }}>
                  * Physical presence is verified inside the <strong>{selectedClassroom.allowedRadiusMeters}m</strong> zone using student device GPS coordinates.
                </div>
              </div>
            )}

            {/* Session Duration Selector */}
            <div className="form-group" style={{ maxWidth: '360px', marginTop: '0.5rem' }}>
              <label className="form-label" htmlFor="duration-select">Attendance Window Duration</label>
              <select
                id="duration-select"
                className="form-select"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={submitting}
              >
                <option value="2">2 Minutes (Fast attendance punch)</option>
                <option value="3">3 Minutes (Standard lecture)</option>
                <option value="5">5 Minutes (Recommended for large halls)</option>
                <option value="10">10 Minutes (Extended window)</option>
              </select>
              <span className="form-helper">Session window closes automatically when time expires</span>
            </div>

          </div>

          <div className="card-footer flex justify-between items-center">
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={<PlayCircle size={18} />}
              loading={submitting}
              disabled={submitting || subjects.length === 0 || divisions.length === 0 || classrooms.length === 0}
            >
              START ATTENDANCE
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
};
