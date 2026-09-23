import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Department } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Users, Plus, Edit2, Trash2, Building2, Mail, Phone, BookOpen, Key } from 'lucide-react';

interface TeacherItem {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  department: string;
  departmentId: string;
  phone: string | null;
  isActive: boolean;
  assignments: Array<{
    id: string;
    subjectCode: string;
    subjectName: string;
    divisionName: string;
    batchName: string;
  }>;
}

export const AdminTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);

  // Form
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
      const [teaRes, deptRes] = await Promise.all([
        apiRequest<{ teachers: TeacherItem[] }>('/admin/teachers'),
        apiRequest<{ departments: Department[] }>('/admin/departments')
      ]);
      setTeachers(teaRes.teachers);
      setDepartments(deptRes.departments);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setEmployeeId('');
    setFullName('');
    setEmail('');
    setDepartmentId(departments[0]?.id || '');
    setPhone('');
    setPassword('');
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (t: TeacherItem) => {
    setEditingTeacher(t);
    setEmployeeId(t.employeeId);
    setFullName(t.fullName);
    setEmail(t.email);
    setDepartmentId(t.departmentId);
    setPhone(t.phone || '');
    setPassword('');
    setIsActive(t.isActive);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (editingTeacher) {
        await apiRequest(`/admin/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          body: {
            fullName: fullName.trim(),
            departmentId,
            phone: phone.trim() || null,
            isActive,
            newPassword: password ? password.trim() : undefined
          }
        });
        setFeedback(`Teacher ${fullName} updated successfully.`);
      } else {
        await apiRequest('/admin/teachers', {
          method: 'POST',
          body: {
            employeeId: employeeId.trim().toUpperCase(),
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            departmentId,
            phone: phone.trim() || null,
            password: password.trim()
          }
        });
        setFeedback(`Teacher ${fullName} registered with ID ${employeeId.toUpperCase()}.`);
      }

      setModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save teacher.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove teacher '${name}'? Deactivate instead if attendance history exists.`)) return;
    try {
      await apiRequest(`/admin/teachers/${id}`, { method: 'DELETE' });
      setFeedback(`Teacher ${name} deleted successfully.`);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete teacher. Deactivate the faculty member instead.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Faculty Directory
          </div>
          <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>Faculty & Teachers</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Register instructors, manage departmental faculty accounts, and inspect active course allocations.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          Register Teacher
        </Button>
      </div>

      {feedback && (
        <Alert type="success" style={{ marginBottom: '1.25rem' }}>
          {feedback}
        </Alert>
      )}

      {/* Teachers Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
          <h2 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} style={{ color: 'var(--brand-primary)' }} />
            <span>Faculty Members ({teachers.length})</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 0.75rem' }} />
            Loading faculty records...
          </div>
        ) : teachers.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              title="No teachers registered yet"
              description="No faculty members have been registered. Add your institution's teachers to assign them to subjects and classrooms."
              actionLabel="Add Teacher"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Employee ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Faculty Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocated Subjects</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                      {t.employeeId}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {t.fullName}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                          {t.email}
                        </span>
                        {t.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                            <Phone size={12} />
                            {t.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                        {t.department}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {t.assignments && t.assignments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {t.assignments.map((a) => (
                            <span
                              key={a.id}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.45rem',
                                backgroundColor: 'var(--bg-canvas)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <BookOpen size={10} style={{ color: 'var(--brand-primary)' }} />
                              <strong>{a.subjectCode}</strong>: {a.divisionName} ({a.batchName})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No classes assigned</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={t.isActive ? 'success' : 'neutral'}>
                        {t.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Edit2 size={13} />}
                          onClick={() => handleOpenEdit(t)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Trash2 size={13} />}
                          onClick={() => handleDelete(t.id, t.fullName)}
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
        title={editingTeacher ? `Edit Faculty: ${editingTeacher.fullName}` : 'Register New Faculty Member'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Employee ID *
              </label>
              <input
                type="text"
                placeholder="e.g. EMP-T103"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                disabled={!!editingTeacher}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Rajesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Institutional Email *
              </label>
              <input
                type="email"
                placeholder="e.g. rajesh.kumar@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!editingTeacher}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              {editingTeacher ? 'Reset Account Password (leave empty to keep unchanged)' : 'Login Password *'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder={editingTeacher ? 'Enter new password to reset...' : 'Set temporary password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingTeacher}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
          </div>

          {editingTeacher && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="isTeacherActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isTeacherActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Account Active (Can log in and conduct attendance sessions)
              </label>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingTeacher ? 'Save Changes' : 'Register Faculty'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
