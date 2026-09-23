import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, MapPin, LogOut, UserCircle, School, BookOpen } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="container flex items-center justify-between" style={{ padding: '0.85rem 1rem' }}>
        
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 12px rgba(79, 70, 229, 0.4)'
          }}>
            <MapPin size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                GeoPresence
              </span>
              <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                GPS + OTP Enterprise
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              College of Engineering & Technology (ERP Connected)
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          {user.role === 'TEACHER' || user.role === 'ADMIN' ? (
            <>
              <button
                className={`btn btn-sm ${currentView === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentView('teacher')}
              >
                <BookOpen size={15} />
                Live Session & Roster
              </button>
              <button
                className={`btn btn-sm ${currentView === 'classrooms' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCurrentView('classrooms')}
              >
                <School size={15} />
                Classrooms & Geofence
              </button>
            </>
          ) : (
            <button
              className={`btn btn-sm ${currentView === 'student' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentView('student')}
            >
              <ShieldCheck size={15} />
              Mark Attendance
            </button>
          )}
        </div>

        {/* User Badge & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2" style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            <UserCircle size={18} color="var(--text-muted)" />
            <div className="flex flex-col" style={{ lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.fullName}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user.role === 'STUDENT' ? (
                  <span className="mono" style={{ color: '#38bdf8' }}>PRN: {user.prn} (Roll {user.rollNumber})</span>
                ) : (
                  <span>Staff: {user.teacherCode || user.role}</span>
                )}
              </span>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Sign Out"
            style={{ padding: '0.45rem' }}
          >
            <LogOut size={16} color="var(--color-error)" />
          </button>
        </div>

      </div>
    </header>
  );
};
