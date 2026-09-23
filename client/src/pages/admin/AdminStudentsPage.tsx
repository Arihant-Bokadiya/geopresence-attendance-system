import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Department, Division } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { GraduationCap, Plus, Edit2, Trash2, Search, Filter, Mail, Layers, Building2 } from 'lucide-react';

interface StudentDirectoryItem {
  prn: string;
  fullName: string;
  rollNumber: string;
  email: string;
  department: string;
  departmentId: string;
  divisionName: string;
  divisionId: string | null;
  batchName: string;
  batchId: string | null;
  academicYear: string;
  isActive: boolean;
}

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentDirectoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivFilter, setSelectedDivFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentDirectoryItem | null>(null);

  // Form
  const [prn, setPrn] = useState('');
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [selectedDivFilter]);

  const loadMeta = async () => {
    try {
      const [deptRes, divRes] = await Promise.all([
        apiRequest<{ departments: Department[] }>('/admin/departments'),
        apiRequest<{ divisions: Division[] }>('/admin/divisions')
      ]);
      setDepartments(deptRes.departments);
      setDivisions(divRes.divisions);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDivFilter) params.append('divisionId', selectedDivFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const data = await apiRequest<{ students: StudentDirectoryItem[] }>(`/admin/students?${params.toString()}`);
      setStudents(data.students);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents();
  };

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setPrn('');
    setFullName('');
    setRollNumber('');
    setEmail('');
    setDepartmentId(departments[0]?.id || '');
    const firstDiv = divisions[0];
    setDivisionId(firstDiv?.id || '');
    setBatchId(firstDiv?.batches?.[0]?.id || '');
    setAcademicYear('');
    setPassword('');
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: StudentDirectoryItem) => {
    setEditingStudent(s);
    setPrn(s.prn);
    setFullName(s.fullName);
    setRollNumber(s.rollNumber);
    setEmail(s.email);
    setDepartmentId(s.departmentId);
    setDivisionId(s.divisionId || '');
    setBatchId(s.batchId || '');
    setAcademicYear(s.academicYear);
    setPassword('');
    setIsActive(s.isActive);
    setError(null);
    setModalOpen(true);
  };

  const handleDivisionChange = (divId: string) => {
    setDivisionId(divId);
    const chosenDiv = divisions.find(d => d.id === divId);
    setBatchId(chosenDiv?.batches?.[0]?.id || '');
  };

  const currentDivBatches = divisions.find(d => d.id === divisionId)?.batches || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (editingStudent) {
        await apiRequest(`/admin/students/${editingStudent.prn}`, {
          method: 'PUT',
          body: {
            fullName: fullName.trim(),
            rollNumber: rollNumber.trim(),
            departmentId,
            divisionId: divisionId || undefined,
            batchId: batchId || undefined,
            academicYear: academicYear.trim(),
            isActive,
            newPassword: password ? password.trim() : undefined
          }
        });
        setFeedback(`Student ${fullName} (${editingStudent.prn}) updated.`);
      } else {
        await apiRequest('/admin/students', {
          method: 'POST',
          body: {
            prn: prn.trim().toUpperCase(),
            fullName: fullName.trim(),
            rollNumber: rollNumber.trim(),
            departmentId,
            divisionId: divisionId || undefined,
            batchId: batchId || undefined,
            academicYear: academicYear.trim(),
            email: email.trim().toLowerCase(),
            password: password.trim()
          }
        });
        setFeedback(`Student ${fullName} registered with PRN ${prn.toUpperCase()}.`);
      }

      setModalOpen(false);
      await loadStudents();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (targetPrn: string, name: string) => {
    if (!confirm(`Are you sure you want to delete student ${name} (${targetPrn})?`)) return;
    try {
      await apiRequest(`/admin/students/${targetPrn}`, { method: 'DELETE' });
      setFeedback(`Student ${targetPrn} removed successfully.`);
      await loadStudents();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete student. Deactivate instead if attendance history exists.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Student Registry & Admissions
          </div>
          <h1 style={{ fontSize: '1.4rem', margin: '0.2rem 0' }}>Students Registry</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Authoritative student enrollment records with unique PRN identities, division assignments, and lab batch groups.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          Register Student
        </Button>
      </div>

      {feedback && (
        <Alert type="success" style={{ marginBottom: '1.25rem' }}>
          {feedback}
        </Alert>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by PRN (e.g. 124B1C088), Name, or Roll No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedDivFilter}
              onChange={(e) => setSelectedDivFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff', fontSize: '0.85rem' }}
            >
              <option value="">All Divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" size="sm" type="submit">
            Apply Filters
          </Button>

          {(searchQuery || selectedDivFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDivFilter('');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Students Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
          <h2 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GraduationCap size={16} style={{ color: 'var(--brand-primary)' }} />
            <span>Enrolled Students ({students.length})</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 0.75rem' }} />
            Loading student records...
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              title="No students registered yet"
              description="No student accounts have been created. Add your institution's students to enable attendance tracking."
              actionLabel="Add Student"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PRN</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Roll No</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Student Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Division & Batch</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.prn} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                      {s.prn}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {s.rollNumber}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {s.fullName}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Layers size={13} style={{ color: 'var(--text-muted)' }} />
                        <strong>{s.divisionName}</strong>
                        {s.batchName && s.batchName !== 'All Batches' && (
                          <span style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--bg-canvas)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            border: '1px solid var(--border-subtle)',
                            fontWeight: 600
                          }}>
                            {s.batchName}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {s.department}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Mail size={12} />
                        {s.email}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={s.isActive ? 'success' : 'neutral'}>
                        {s.isActive ? 'Enrolled' : 'Disabled'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Edit2 size={13} />}
                          onClick={() => handleOpenEdit(s)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          icon={<Trash2 size={13} />}
                          onClick={() => handleDelete(s.prn, s.fullName)}
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

      {/* Create / Edit Student Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editingStudent ? `Edit Student: ${editingStudent.fullName}` : 'Register New Student'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error">{error}</Alert>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                PRN (Permanent Reg No) *
              </label>
              <input
                type="text"
                placeholder="e.g. 124B1C088"
                value={prn}
                onChange={(e) => setPrn(e.target.value)}
                required
                disabled={!!editingStudent}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', textTransform: 'uppercase', fontFamily: 'monospace' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Must be 6-16 alphanumeric characters</span>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Roll Number *
              </label>
              <input
                type="text"
                placeholder="e.g. 23B101"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Amit Patil"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
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
                Division Allocation *
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
                Batch Allocation (Lab / Practical)
              </label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)', backgroundColor: '#fff' }}
              >
                <option value="">None / Entire Division</option>
                {currentDivBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                College Email *
              </label>
              <input
                type="email"
                placeholder="e.g. amit.patil@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!editingStudent}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                {editingStudent ? 'Reset Password (optional)' : 'Account Password *'}
              </label>
              <input
                type="password"
                placeholder={editingStudent ? 'Leave blank to retain' : 'Temporary password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingStudent}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
              />
            </div>
          </div>

          {editingStudent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="isStudentActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isStudentActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Enrollment Active (Can attend lecture sessions and mark attendance)
              </label>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingStudent ? 'Save Student' : 'Register Student'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
