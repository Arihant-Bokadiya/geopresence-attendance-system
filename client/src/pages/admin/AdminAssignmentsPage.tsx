import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Division, Subject } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { UserCheck, Plus, Trash2, BookOpen, Layers, Users, Calendar } from 'lucide-react';

interface AssignmentItem {
  id: string;
  teacherId: string;
  subjectId: string;
  divisionId: string;
  batchId: string | null;
  createdAt: string;
  teacher: {
    id: string;
    fullName: string;
    teacherCode: string;
  };
  subject: {
    id: string;
    code: string;
    name: string;
  };
  division: {
    id: string;
    name: string;
  };
  batch: {
    id: string;
    name: string;
  } | null;
}

interface TeacherSimple {
  id: string;
  fullName: string;
  employeeId: string;
}

export const AdminAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherSimple[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [batchId, setBatchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignRes, teachRes, subRes, divRes] = await Promise.all([
        apiRequest<{ assignments: AssignmentItem[] }>('/admin/assignments'),
        apiRequest<{ teachers: any[] }>('/admin/teachers'),
        apiRequest<{ subjects: Subject[] }>('/admin/subjects'),
        apiRequest<{ divisions: Division[] }>('/admin/divisions')
      ]);

      setAssignments(assignRes.assignments);
      setTeachers(teachRes.teachers.map((t: any) => ({
        id: t.id,
        fullName: t.fullName,
        employeeId: t.employeeId
      })));
      setSubjects(subRes.subjects.filter(s => s.isActive !== false));
      setDivisions(divRes.divisions);
    } catch (err) {
      console.error('Failed to load assignments data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setTeacherId(teachers[0]?.id || '');
    setSubjectId(subjects[0]?.id || '');
    const firstDiv = divisions[0];
    setDivisionId(firstDiv?.id || '');
    setBatchId('');
    setError(null);
    setModalOpen(true);
  };

  const handleDivisionChange = (divId: string) => {
    setDivisionId(divId);
    setBatchId('');
  };

  const currentDivBatches = divisions.find(d => d.id === divisionId)?.batches || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/admin/assignments', {
        method: 'POST',
        body: {
          teacherId,
          subjectId,
          divisionId,
          batchId: batchId || null
        }
      });

      setFeedback('Teacher allocated to subject and class successfully.');
      setModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment. Ensure teacher is not already assigned.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, teacherName: string, subjectCode: string) => {
    if (!confirm(`Remove teaching allocation of ${subjectCode} for ${teacherName}?`)) return;
    try {
      await apiRequest(`/admin/assignments/${id}`, { method: 'DELETE' });
      setFeedback('Teaching allocation removed.');
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to remove assignment.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Academic Allocation
          </div>
          <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>Teacher Course Allocations</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Assign teachers to curriculum subjects, divisions, and practical batches for attendance authorization.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          Allocate Teacher
        </Button>
      </div>

      {feedback && (
        <Alert type="success" style={{ marginBottom: '1.25rem' }}>
          {feedback}
        </Alert>
      )}

      {/* Allocations Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
          <h2 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck size={16} style={{ color: 'var(--brand-primary)' }} />
            <span>Active Allocations ({assignments.length})</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 0.75rem' }} />
            Loading allocations...
          </div>
        ) : assignments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <UserCheck size={36} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
            <div>No teacher allocations found. Allocate faculty to courses so they can conduct attendance sessions.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Faculty Teacher</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocated Subject</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Division</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Batch Scope</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Date</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ fontWeight: 600 }}>{a.teacher.fullName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {a.teacher.teacherCode}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                          {a.subject.code}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          — {a.subject.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Layers size={13} style={{ color: 'var(--text-muted)' }} />
                        {a.division.name}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {a.batch ? (
                        <Badge variant="neutral">Batch {a.batch.name}</Badge>
                      ) : (
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Entire Division (All Batches)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={12} />
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        icon={<Trash2 size={13} />}
                        onClick={() => handleDelete(a.id, a.teacher.fullName, a.subject.code)}
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Allocate Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title="Allocate Teacher to Subject & Class"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Faculty Teacher *
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
            >
              <option value="">Select Faculty</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Curriculum Subject *
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Class Division *
              </label>
              <select
                value={divisionId}
                onChange={(e) => handleDivisionChange(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
              >
                <option value="">Select Division</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (Sem {d.semester})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Batch Scope (Optional)
              </label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
              >
                <option value="">All Batches (Division-wide)</option>
                {currentDivBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Once assigned, this subject and division/batch will appear in the teacher's "Start Attendance" options.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Confirm Allocation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
