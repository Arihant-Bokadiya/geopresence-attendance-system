import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import { StatCard } from '../../components/ui/StatCard.js';
import { Button } from '../../components/ui/Button.js';
import { 
  Building2, School, BookOpen, Users, GraduationCap, 
  Layers, Radio, Plus, ArrowRight 
} from 'lucide-react';
import type { AdminTab } from '../../components/layout/AdminNav.js';

interface AdminOverviewPageProps {
  onNavigate: (tab: AdminTab) => void;
}

export const AdminOverviewPage: React.FC<AdminOverviewPageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<any>('/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          GEOPRESENCE • Administration
        </div>
        <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>Institutional Control Console</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Configure institution classrooms, subjects, divisions, faculty assignments, and student registries.
        </p>
      </div>

      {/* First-Time Setup Welcome Banner (when database is empty) */}
      {!loading && stats && stats.totalStudents === 0 && stats.totalClassrooms === 0 && stats.totalTeachers === 0 && (
        <div className="card" style={{
          padding: '2rem 1.5rem',
          marginBottom: '1.75rem',
          backgroundColor: '#ffffff',
          border: '2px solid var(--brand-primary)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            WELCOME TO GEOPRESENCE
          </div>
          <h2 style={{ fontSize: '1.4rem', margin: '0.35rem 0 0.5rem', color: 'var(--text-primary)' }}>
            Your attendance system is ready to be configured.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '540px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
            No institution data has been added yet. Use the setup modules below to add your college's actual departments, classrooms, subjects, faculty, and student registries.
          </p>
          <Button variant="primary" size="lg" onClick={() => onNavigate('departments')}>
            SET UP SYSTEM
          </Button>
        </div>
      )}

      {/* KPI Metric Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <StatCard
          label="STUDENTS"
          value={loading ? '...' : (stats?.totalStudents ?? 0)}
          icon={<GraduationCap size={16} />}
          helpText={stats?.totalStudents === 0 ? 'No students added yet' : 'Total registered students'}
        />
        <StatCard
          label="TEACHERS"
          value={loading ? '...' : (stats?.totalTeachers ?? 0)}
          icon={<Users size={16} />}
          helpText={stats?.totalTeachers === 0 ? 'No teachers added yet' : 'Active academic faculty'}
        />
        <StatCard
          label="SUBJECTS"
          value={loading ? '...' : (stats?.totalSubjects ?? 0)}
          icon={<BookOpen size={16} />}
          helpText={stats?.totalSubjects === 0 ? 'No subjects created yet' : 'Taught curriculum courses'}
        />
        <StatCard
          label="CLASSROOMS"
          value={loading ? '...' : (stats?.totalClassrooms ?? 0)}
          icon={<School size={16} />}
          helpText={stats?.totalClassrooms === 0 ? 'No classrooms configured yet' : 'GPS geofenced halls'}
        />
        <StatCard
          label="ACTIVE SESSIONS"
          value={loading ? '...' : (stats?.activeSessionsCount ?? 0)}
          icon={<Radio size={16} />}
          valueColor={stats?.activeSessionsCount > 0 ? 'var(--color-success)' : undefined}
          helpText={stats?.activeSessionsCount === 0 ? 'No active attendance sessions' : 'Attendance open now'}
        />
      </div>

      {/* Quick Setup Modules */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        Institution Setup Modules
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        
        {/* Classrooms */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <School size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Classrooms & Geofences</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Coordinates & authoritative radii</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Configure room numbers, GPS coordinates (latitude/longitude), building, and allowed verification radius.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('classrooms')}>
            Manage Classrooms <ArrowRight size={14} />
          </Button>
        </div>

        {/* Classroom Devices */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Radio size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Classroom Devices</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ESP32 / BLE presence hardware</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Register and link classroom ESP32 hardware beacons used for Layer 2 physical presence verification.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('devices')}>
            Manage Devices <ArrowRight size={14} />
          </Button>
        </div>

        {/* Departments */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Departments</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Academic branches</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Create and manage college academic departments (e.g., Computer Engineering, Information Technology).
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('departments')}>
            Manage Departments <ArrowRight size={14} />
          </Button>
        </div>

        {/* Subjects */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Courses & Subjects</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Curriculum catalog</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Define course codes (e.g. CS601, CN301), subject titles, department allocations, and semester terms.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('subjects')}>
            Manage Subjects <ArrowRight size={14} />
          </Button>
        </div>

        {/* Divisions & Batches */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Divisions & Batches</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cohort structures</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Create academic divisions (e.g. Division B) and sub-batches (e.g. B1, B2) for lab and classroom tracking.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('divisions')}>
            Manage Divisions & Batches <ArrowRight size={14} />
          </Button>
        </div>

        {/* Teachers */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Teachers / Faculty</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instructor staff directory</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Add new teachers dynamically with Employee ID (e.g. EMP-T101), institutional credentials, and departments.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('teachers')}>
            Manage Teachers <ArrowRight size={14} />
          </Button>
        </div>

        {/* Students */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Student Registry</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PRN primary identity registry</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Register students with Permanent Registration Numbers (e.g. 124B1C088), assigned division, and batch.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('students')}>
            Manage Students <ArrowRight size={14} />
          </Button>
        </div>

        {/* Teacher Assignments */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Teacher Allocations</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Course & division authorization</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Assign which faculty member is authorized to conduct attendance for specific subjects and divisions/batches.
          </p>
          <Button variant="secondary" size="sm" fullWidth onClick={() => onNavigate('assignments')}>
            Manage Allocations <ArrowRight size={14} />
          </Button>
        </div>

      </div>

    </div>
  );
};
