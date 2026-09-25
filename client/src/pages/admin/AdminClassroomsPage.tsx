import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Classroom } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Alert } from '../../components/ui/Alert.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { 
  School, Plus, Edit2, Trash2, MapPin, Navigation, CheckCircle2, RefreshCw 
} from 'lucide-react';

export const AdminClassroomsPage: React.FC = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [roomCode, setRoomCode] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [floorNumber, setFloorNumber] = useState(1);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState(25);
  const [hardwareBeaconId, setHardwareBeaconId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsAcquiring, setGpsAcquiring] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsTimestamp, setGpsTimestamp] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadClassrooms();
  }, []);

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ classrooms: Classroom[] }>('/admin/classrooms');
      setClassrooms(data.classrooms);
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setRoomCode('');
    setBuildingName('');
    setFloorNumber(1);
    setLatitude('');
    setLongitude('');
    setAllowedRadiusMeters(25);
    setHardwareBeaconId('');
    setIsActive(true);
    setGpsAccuracy(null);
    setGpsTimestamp(null);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Classroom) => {
    setEditingId(c.id);
    setRoomCode(c.roomCode);
    setBuildingName(c.buildingName);
    setFloorNumber(c.floorNumber);
    setLatitude(c.latitude.toString());
    setLongitude(c.longitude.toString());
    setAllowedRadiusMeters(c.allowedRadiusMeters);
    setHardwareBeaconId(c.hardwareBeaconId || '');
    setIsActive(c.isActive);
    setGpsAccuracy(null);
    setGpsTimestamp(null);
    setError(null);
    setModalOpen(true);
  };

  const handleCaptureCurrentGps = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError(null);
    setGpsAcquiring(true);

    // Request fresh location every time by setting maximumAge: 0
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const freshLat = pos.coords.latitude;
        const freshLon = pos.coords.longitude;
        const freshAcc = pos.coords.accuracy;

        setLatitude(freshLat.toFixed(7));
        setLongitude(freshLon.toFixed(7));
        setGpsAccuracy(freshAcc);
        setGpsTimestamp(new Date().toLocaleTimeString());
        setGpsAcquiring(false);
      },
      (err) => {
        setGpsAcquiring(false);
        if (err.code === 1) { // PERMISSION_DENIED
          setError('Location permission denied. Please allow location access in your browser settings.');
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setError('GPS location unavailable. Please ensure location services are enabled on your device.');
        } else if (err.code === 3) { // TIMEOUT
          setError('Location request timed out. Please click "Use Current Location" again to retry.');
        } else {
          setError(`Failed to acquire GPS: ${err.message}.`);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        roomCode,
        buildingName,
        floorNumber,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        allowedRadiusMeters: parseFloat(allowedRadiusMeters.toString()),
        hardwareBeaconId: hardwareBeaconId || null,
        isActive
      };

      if (editingId) {
        await apiRequest(`/admin/classrooms/${editingId}`, {
          method: 'PUT',
          body: payload
        });
        setFeedback(`Classroom ${roomCode} updated successfully.`);
      } else {
        await apiRequest('/admin/classrooms', {
          method: 'POST',
          body: payload
        });
        setFeedback(`Classroom ${roomCode} registered successfully.`);
      }

      setModalOpen(false);
      await loadClassrooms();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save classroom.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to remove classroom ${code}?`)) return;
    try {
      await apiRequest(`/admin/classrooms/${id}`, { method: 'DELETE' });
      setFeedback(`Classroom ${code} removed.`);
      await loadClassrooms();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete classroom');
    }
  };

  return (
    <div className="app-container">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.2rem' }}>Classroom & Geofence Management</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Authoritative physical GPS geofences and verification boundaries.
          </p>
        </div>

        <Button variant="primary" icon={<Plus size={15} />} onClick={handleOpenCreate}>
          Add Classroom
        </Button>
      </div>

      {feedback && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert variant="success" message={feedback} />
        </div>
      )}

      {/* Classrooms Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="pulse-dot" style={{ width: '16px', height: '16px', margin: '0 auto 1rem' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading classrooms...</div>
          </div>
        ) : classrooms.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState
              title="No classrooms configured yet"
              description="No physical classrooms have been registered. Add your lecture halls with real GPS coordinates."
              actionLabel="Add Classroom"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>CLASSROOM</th>
                  <th>BUILDING / FLOOR</th>
                  <th>COORDINATES (LAT, LON)</th>
                  <th>AUTHORITATIVE RADIUS</th>
                  <th>BEACON ID</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="mono font-semibold" style={{ fontSize: '0.9rem', color: 'var(--brand-primary)' }}>
                        {c.roomCode}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.buildingName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Floor {c.floorNumber}</div>
                    </td>
                    <td className="mono" style={{ fontSize: '0.8rem' }}>
                      {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}
                    </td>
                    <td>
                      <Badge variant="neutral">
                        {c.allowedRadiusMeters} meters
                      </Badge>
                    </td>
                    <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {c.hardwareBeaconId || 'None'}
                    </td>
                    <td>
                      <Badge variant={c.isActive ? 'active' : 'closed'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.3rem 0.5rem' }}
                          onClick={() => handleOpenEdit(c)}
                          title="Edit Classroom"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.3rem 0.5rem', color: 'var(--color-danger)' }}
                          onClick={() => handleDelete(c.id, c.roomCode)}
                          title="Delete Classroom"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Classroom */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit Classroom: ${roomCode}` : 'Create Classroom & Geofence'}
      >
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert variant="danger" message={error} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Room Code *
              </label>
              <input
                type="text"
                className="input mono font-semibold"
                placeholder="e.g. A-204"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Building Name *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Main Academic Complex"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Floor Number
              </label>
              <input
                type="number"
                className="input"
                value={floorNumber}
                onChange={(e) => setFloorNumber(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Allowed Geofence Radius (meters) *
              </label>
              <input
                type="number"
                step="1"
                min="5"
                max="200"
                className="input mono font-semibold"
                value={allowedRadiusMeters}
                onChange={(e) => setAllowedRadiusMeters(parseFloat(e.target.value) || 25)}
                required
              />
            </div>
          </div>

          {/* Coordinates section with Quick GPS capture */}
          <div style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem',
            marginBottom: '1rem'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Authoritative Geofence Center (WGS84 Coordinates)
                </div>
                {gpsAccuracy !== null && gpsTimestamp && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} color="var(--color-success)" />
                    <span>Fresh GPS: ±{Math.round(gpsAccuracy)}m accuracy (Acquired at {gpsTimestamp})</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={handleCaptureCurrentGps}
                disabled={gpsAcquiring}
              >
                <Navigation size={12} />
                <span>{gpsAcquiring ? 'Acquiring GPS...' : 'Use Current Location'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Latitude
                </label>
                <input
                  type="text"
                  className="input mono font-semibold"
                  placeholder="e.g. 12.9715987"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Longitude
                </label>
                <input
                  type="text"
                  className="input mono font-semibold"
                  placeholder="e.g. 77.5945627"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Hardware Beacon UUID (Optional)
            </label>
            <input
              type="text"
              className="input mono"
              placeholder="e.g. BEACON-ESP32-A204"
              value={hardwareBeaconId}
              onChange={(e) => setHardwareBeaconId(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Enable Classroom for Attendance Sessions</span>
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editingId ? 'Save Changes' : 'Create Classroom'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
