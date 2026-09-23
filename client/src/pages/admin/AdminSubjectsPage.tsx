import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Subject, Department } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { BookOpen, Plus, Edit2, Trash2, Building2 } from 'lucide-react';

export const AdminSubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState(5);
  const [credits, setCredits] = useState(4);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subRes, deptRes] = await Promise.all([
        apiRequest<{ subjects: Subject[] }>('/admin/subjects'),
        apiRequest<{ departments: Department[] }>('/admin/departments')
      ]);
      setSubjects(subRes.subjects);
      setDepartments(deptRes.departments);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDepartmentId(departments[0]?.id || '');
    setSemester(5);
    setCredits(4);
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Subject) => {
    setEditingId(s.id);
    setCode(s.code);
    setName(s.name);
    setDepartmentId(s.departmentId);
    setSemester(s.semester || 1);
    setCredits(s.credits || 3);
    setIsActive(s.isActive !== false);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        departmentId,
        semester: Number(semester),
        credits: Number(credits),
        isActive
      };

      if (editingId) {
        await apiRequest(`/admin/subjects/${editingId}`, {
          method: 'PUT',
          body: payload
        });
        setFeedback(`Subject ${code} updated successfully.`);
      } else {
        await apiRequest('/admin/subjects', {
          method: 'POST',
          body: payload
        });
        setFeedback(`Subject ${code} created successfully.`);
      }

      setModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, subCode: string) => {
    if (!confirm(`Are you sure you want to delete subject '${subCode}'? This will fail if there are active attendance sessions.`)) return;
    try {
      await apiRequest(`/admin/subjects/${id}`, { method: 'DELETE' });
      setFeedback(`Subject ${subCode} removed successfully.`);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete subject.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Curriculum Management
          </div>
          <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>Academic Subjects & Courses</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Configure curriculum courses, subject codes, credits, and departmental allocations.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          Add Subject
        </Button>
      </div>

      {feedback && (
        <Alert type="success" style={{ marginBottom: '1.25rem' }}>
          {feedback}
        </Alert>
      )}

      {/* Subjects Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
          <h2 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} style={{ color: 'var(--brand-primary)' }} />
            <span>Configured Subjects ({subjects.length})</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 0.75rem' }} />
            Loading curriculum subjects...
          </div>
        ) : subjects.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              title="No subjects configured yet"
              description="No academic subjects have been configured. Add your course curriculum subjects to begin."
              actionLabel="Add Subject"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Subject Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Semester</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Credits</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                      {sub.code}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {sub.name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                        {sub.department?.name || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      Semester {sub.semester}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {sub.credits ?? 3} Cr
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={sub.isActive !== false ? 'success' : 'neutral'}>
                        {sub.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Edit2 size={13} />}
                          onClick={() => handleOpenEdit(sub)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Trash2 size={13} />}
                          onClick={() => handleDelete(sub.id, sub.code)}
                          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editingId ? 'Edit Subject' : 'Add New Subject'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Course Code *
              </label>
              <input
                type="text"
                placeholder="e.g. CN301"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Course Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Computer Networks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Academic Department *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Credits
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="isSubActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isSubActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
              Active (Available for faculty attendance sessions)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingId ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
