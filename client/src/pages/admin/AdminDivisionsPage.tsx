import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Division, Department } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { Layers, Plus, Edit2, Trash2, Users, Building2, Tag, X } from 'lucide-react';

export const AdminDivisionsPage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [divModalOpen, setDivModalOpen] = useState(false);
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedDivForBatch, setSelectedDivForBatch] = useState<Division | null>(null);

  // Division Form State
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [academicYear, setAcademicYear] = useState('2024-2028');
  const [semester, setSemester] = useState(5);
  const [initialBatches, setInitialBatches] = useState('B1, B2');

  // Batch Form State
  const [newBatchName, setNewBatchName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [divRes, deptRes] = await Promise.all([
        apiRequest<{ divisions: Division[] }>('/admin/divisions'),
        apiRequest<{ departments: Department[] }>('/admin/departments')
      ]);
      setDivisions(divRes.divisions);
      setDepartments(deptRes.departments);
    } catch (err) {
      console.error('Failed to load divisions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDiv = () => {
    setEditingDivId(null);
    setName('');
    setDepartmentId(departments[0]?.id || '');
    setAcademicYear('2024-2028');
    setSemester(5);
    setInitialBatches('B1, B2');
    setError(null);
    setDivModalOpen(true);
  };

  const handleOpenEditDiv = (div: Division) => {
    setEditingDivId(div.id);
    setName(div.name);
    setDepartmentId(div.departmentId || '');
    setAcademicYear(div.academicYear);
    setSemester(div.semester || 1);
    setInitialBatches('');
    setError(null);
    setDivModalOpen(true);
  };

  const handleOpenAddBatch = (div: Division) => {
    setSelectedDivForBatch(div);
    setNewBatchName('');
    setError(null);
    setBatchModalOpen(true);
  };

  const handleSubmitDiv = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (editingDivId) {
        await apiRequest(`/admin/divisions/${editingDivId}`, {
          method: 'PUT',
          body: {
            name: name.trim(),
            departmentId,
            academicYear: academicYear.trim(),
            semester: Number(semester)
          }
        });
        setFeedback(`Division '${name}' updated successfully.`);
      } else {
        const batchNames = initialBatches
          .split(',')
          .map(b => b.trim().toUpperCase())
          .filter(Boolean);

        await apiRequest('/admin/divisions', {
          method: 'POST',
          body: {
            name: name.trim(),
            departmentId,
            academicYear: academicYear.trim(),
            semester: Number(semester),
            batchNames
          }
        });
        setFeedback(`Division '${name}' with ${batchNames.length} batch(es) created.`);
      }

      setDivModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save division.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDiv = async (div: Division) => {
    if (!confirm(`Are you sure you want to delete ${div.name}? This will remove associated batches if no students are enrolled.`)) return;
    try {
      await apiRequest(`/admin/divisions/${div.id}`, { method: 'DELETE' });
      setFeedback(`Division ${div.name} deleted.`);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete division.');
    }
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivForBatch || !newBatchName.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/admin/batches', {
        method: 'POST',
        body: {
          divisionId: selectedDivForBatch.id,
          name: newBatchName.trim().toUpperCase()
        }
      });
      setFeedback(`Batch ${newBatchName.toUpperCase()} added to ${selectedDivForBatch.name}.`);
      setBatchModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add batch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (batchId: string, batchName: string, divName: string) => {
    if (!confirm(`Remove batch ${batchName} from ${divName}?`)) return;
    try {
      await apiRequest(`/admin/batches/${batchId}`, { method: 'DELETE' });
      setFeedback(`Batch ${batchName} deleted.`);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete batch.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Cohort & Section Management
          </div>
          <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>Divisions & Practical Batches</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Configure classroom divisions (e.g. Division A, B) and practical lab batches (e.g. B1, B2, B3).
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreateDiv}>
          Add Division
        </Button>
      </div>

      {feedback && (
        <Alert type="success" style={{ marginBottom: '1.25rem' }}>
          {feedback}
        </Alert>
      )}

      {/* Divisions List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="pulse-dot" style={{ margin: '0 auto 0.75rem' }} />
          Loading divisions and batches...
        </div>
      ) : divisions.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Layers size={36} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
          <div>No divisions configured yet. Click "Add Division" to create your first class section.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {divisions.map((div) => (
            <div key={div.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                      {div.name}
                    </h3>
                    <Badge variant="neutral">Sem {div.semester}</Badge>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span>AY {div.academicYear}</span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Building2 size={12} />
                      {div.department?.code || 'GEN'}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={12} />
                      {div._count?.enrollments ?? 0} Students
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <Button variant="outline" size="sm" icon={<Edit2 size={13} />} onClick={() => handleOpenEditDiv(div)} />
                  <Button variant="outline" size="sm" icon={<Trash2 size={13} />} onClick={() => handleDeleteDiv(div)} style={{ color: 'var(--color-danger)' }} />
                </div>
              </div>

              {/* Batches Section */}
              <div style={{
                backgroundColor: 'var(--bg-canvas)',
                padding: '0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                marginTop: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Practical Batches ({div.batches?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenAddBatch(div)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Plus size={12} /> Add Batch
                  </button>
                </div>

                {div.batches && div.batches.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {div.batches.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          backgroundColor: '#ffffff',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        <Tag size={12} style={{ color: 'var(--brand-primary)' }} />
                        <span>Batch {b.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBatch(b.id, b.name, div.name)}
                          title={`Delete batch ${b.name}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    No specific batches. Division operates as single lecture unit.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Division Modal */}
      <Modal
        isOpen={divModalOpen}
        onClose={() => !submitting && setDivModalOpen(false)}
        title={editingDivId ? 'Edit Division' : 'Add New Division'}
      >
        <form onSubmit={handleSubmitDiv} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Division Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Division A, Division B, TY-CSE-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Department *
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
                Academic Year *
              </label>
              <input
                type="text"
                placeholder="e.g. 2024-2028"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
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
          </div>

          {!editingDivId && (
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Initial Batches (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. B1, B2, B3"
                value={initialBatches}
                onChange={(e) => setInitialBatches(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Batches will automatically be created under this division
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setDivModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingDivId ? 'Save Changes' : 'Create Division'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Single Batch Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => !submitting && setBatchModalOpen(false)}
        title={`Add Batch to ${selectedDivForBatch?.name}`}
      >
        <form onSubmit={handleSubmitBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Batch Identifier / Name *
            </label>
            <input
              type="text"
              placeholder="e.g. B3, B4, C1"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', textTransform: 'uppercase' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setBatchModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Batch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
