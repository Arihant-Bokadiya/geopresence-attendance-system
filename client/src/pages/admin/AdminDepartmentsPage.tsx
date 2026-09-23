import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Department } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { Building2, Plus, Edit2, Trash2, Users, GraduationCap, BookOpen, Layers } from 'lucide-react';

export const AdminDepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ departments: Department[] }>('/admin/departments');
      setDepartments(data.departments);
    } catch (err: any) {
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Department) => {
    setEditingId(d.id);
    setCode(d.code);
    setName(d.name);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = { code, name };
      if (editingId) {
        await apiRequest(`/admin/departments/${editingId}`, {
          method: 'PUT',
          body: payload
        });
        setFeedback(`Department ${code} updated successfully.`);
      } else {
        await apiRequest('/admin/departments', {
          method: 'POST',
          body: payload
        });
        setFeedback(`Department ${code} created successfully.`);
      }

      setModalOpen(false);
      await loadDepartments();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, deptCode: string) => {
    if (!confirm(`Are you sure you want to delete department '${deptCode}'? This will fail if there are linked teachers, students, or courses.`)) return;
    try {
      await apiRequest(`/admin/departments/${id}`, { method: 'DELETE' });
      setFeedback(`Department ${deptCode} deleted successfully.`);
      await loadDepartments();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete department.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Academic Structure
          </div>
          <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>Academic Departments</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Manage academic departments and branches across the institution.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          Add Department
        </Button>
      </div>

      {feedback && (
        <Alert type="success" style={{ marginBottom: '1.25rem' }}>
          {feedback}
        </Alert>
      )}

      {/* Departments Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
          <h2 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={16} style={{ color: 'var(--brand-primary)' }} />
            <span>Configured Departments ({departments.length})</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 0.75rem' }} />
            Loading academic departments...
          </div>
        ) : departments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building2 size={36} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
            <div>No departments found. Click "Add Department" to get started.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Teachers</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Students</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Subjects</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Divisions</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                      {dept.code}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                      {dept.name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={14} style={{ color: 'var(--text-muted)' }} />
                        {dept._count?.teachers ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <GraduationCap size={14} style={{ color: 'var(--text-muted)' }} />
                        {dept._count?.students ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <BookOpen size={14} style={{ color: 'var(--text-muted)' }} />
                        {dept._count?.subjects ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Layers size={14} style={{ color: 'var(--text-muted)' }} />
                        {dept._count?.divisions ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Edit2 size={13} />}
                          onClick={() => handleOpenEdit(dept)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Trash2 size={13} />}
                          onClick={() => handleDelete(dept.id, dept.code)}
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editingId ? 'Edit Department' : 'Add New Department'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Department Code *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. COMP, IT, MECH, ENTC"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', textTransform: 'uppercase' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unique institutional short code</span>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Department Name *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Computer Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingId ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
