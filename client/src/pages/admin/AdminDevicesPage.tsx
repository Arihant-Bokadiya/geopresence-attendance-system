import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { ClassroomDevice, Classroom } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { 
  Radio, Plus, Edit2, Trash2, CheckCircle2, RefreshCw, Cpu, Wifi
} from 'lucide-react';

export const AdminDevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<ClassroomDevice[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [deviceId, setDeviceId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [bleIdentifier, setBleIdentifier] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [devRes, clsRes] = await Promise.all([
        apiRequest<{ devices: ClassroomDevice[] }>('/admin/devices'),
        apiRequest<{ classrooms: Classroom[] }>('/admin/classrooms')
      ]);
      setDevices(devRes.devices || []);
      setClassrooms(clsRes.classrooms || []);
    } catch (err: any) {
      console.error('Error fetching devices data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setDeviceId('');
    setClassroomId(classrooms[0]?.id || '');
    setBleIdentifier('');
    setStatus('ACTIVE');
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (d: ClassroomDevice) => {
    setEditingId(d.id);
    setDeviceId(d.deviceId);
    setClassroomId(d.classroomId);
    setBleIdentifier(d.bleIdentifier);
    setStatus(d.status);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (editingId) {
        await apiRequest(`/admin/devices/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            deviceId,
            classroomId,
            bleIdentifier,
            status
          })
        });
        setFeedback(`Classroom device ${deviceId} updated successfully.`);
      } else {
        await apiRequest('/admin/devices', {
          method: 'POST',
          body: JSON.stringify({
            deviceId,
            classroomId,
            bleIdentifier,
            status
          })
        });
        setFeedback(`Classroom device ${deviceId} registered successfully.`);
      }

      setModalOpen(false);
      await loadData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save classroom device.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove classroom device ${name}?`)) return;

    try {
      await apiRequest(`/admin/devices/${id}`, { method: 'DELETE' });
      setFeedback(`Classroom device ${name} deleted.`);
      await loadData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete device.');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div className="flex items-center gap-2">
            <Radio size={20} color="var(--brand-primary)" />
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Classroom Presence Hardware (ESP32 / BLE)</h1>
          </div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage classroom-anchored ESP32 hardware beacons used for Layer 2 classroom physical presence verification.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={loadData}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={14} /> Register Classroom Device
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant="success" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {/* Development Mode Notice Card */}
      <div className="card" style={{
        backgroundColor: 'var(--bg-surface-subtle)',
        borderLeft: '4px solid var(--brand-primary)',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem'
      }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Cpu size={18} color="var(--brand-primary)" />
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Presence Layer Architecture:</span>{' '}
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Combines high-precision GPS geofencing with classroom-anchored ESP32 / Bluetooth Low Energy identifiers.
              </span>
            </div>
          </div>
          <Badge variant="neutral" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
            ● MODE: DEVELOPMENT SIMULATION
          </Badge>
        </div>
      </div>

      {/* Device List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>DEVICE ID</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>LINKED CLASSROOM</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>BLE ADVERTISEMENT ID</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>VERIFICATION MODE</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && devices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div className="pulse-dot" style={{ width: '14px', height: '14px', margin: '0 auto 0.75rem' }} />
                  Loading classroom devices...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem' }}>
                  <EmptyState
                    title="No classroom devices registered"
                    description="No classroom devices have been linked. Register your ESP32 presence devices and associate them with lecture halls."
                    actionLabel="Register Device"
                    onAction={handleOpenCreate}
                  />
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div className="flex items-center gap-2">
                      <Radio size={14} color="var(--brand-primary)" />
                      <span className="mono font-semibold" style={{ color: 'var(--brand-primary)', fontSize: '0.875rem' }}>
                        {d.deviceId}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {d.classroom?.roomCode || 'Unassigned'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {d.classroom?.buildingName}
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="mono" style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.78rem' }}>
                      {d.bleIdentifier}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Badge variant={d.status === 'ACTIVE' ? 'present' : 'absent'}>
                      {d.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Development Simulation
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={() => handleOpenEdit(d)}
                        title="Edit Device"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={() => handleDelete(d.id, d.deviceId)}
                        title="Delete Device"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Classroom Device' : 'Register Classroom Device'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert variant="danger" message={error} />}

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Device Identifier (e.g. ESP32-ROOM101) *
            </label>
            <input
              type="text"
              className="form-input"
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
              placeholder="e.g. ESP32-ROOM101"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Associated Lecture Hall / Classroom *
            </label>
            <select
              className="form-select"
              required
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
            >
              <option value="">Select a Classroom...</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.roomCode} — {c.buildingName} (Floor {c.floorNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              BLE Advertising Identifier / Service UUID *
            </label>
            <input
              type="text"
              className="form-input"
              required
              value={bleIdentifier}
              onChange={(e) => setBleIdentifier(e.target.value)}
              placeholder="GEO-LH401"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              The Bluetooth advertisement payload emitted by the classroom hardware beacon.
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Operating Status
            </label>
            <select
              className="form-select"
              value={status}
              onChange={(e: any) => setStatus(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
            >
              <option value="ACTIVE">ACTIVE (Ready for Attendance)</option>
              <option value="INACTIVE">INACTIVE (Offline / Disabled)</option>
              <option value="MAINTENANCE">MAINTENANCE (Diagnostics Mode)</option>
            </select>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            Note: In Development Simulation Mode, student presence verification simulates Bluetooth LE proximity to this hardware identifier without requiring physical microcontrollers during demos.
          </div>

          <div className="flex justify-end gap-2" style={{ marginTop: '0.5rem' }}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingId ? 'Update Device' : 'Register Device'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
