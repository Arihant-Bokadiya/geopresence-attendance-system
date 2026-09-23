import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Shield, User, LogOut } from 'lucide-react';
import { Badge } from '../ui/Badge.js';

interface AppHeaderProps {
  onNavigateProfile: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onNavigateProfile }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div className="app-container flex items-center justify-between" style={{ padding: '0.75rem 1rem' }}>
        
        {/* Brand & Institution */}
        <div className="flex items-center gap-3">
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--brand-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <Shield size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                GeoPresence
              </span>
              <Badge variant={user.role === 'STUDENT' ? 'present' : 'info'}>
                {user.role}
              </Badge>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              College Attendance & ERP Management Portal
            </div>
          </div>
        </div>

        {/* User Identity & Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateProfile}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-subtle)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <User size={15} color="var(--text-muted)" />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user.fullName}</div>
              <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user.role === 'STUDENT' ? `PRN: ${user.prn}` : (user.teacherCode || user.email)}
              </div>
            </div>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Sign Out"
            style={{ padding: '0.45rem', color: 'var(--color-danger)' }}
          >
            <LogOut size={16} />
          </button>
        </div>

      </div>
    </header>
  );
};
