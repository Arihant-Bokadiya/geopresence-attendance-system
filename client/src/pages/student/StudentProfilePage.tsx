import React, { useState } from 'react';
import type { User } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { startRegistration } from '@simplewebauthn/browser';
import { apiRequest } from '../../utils/api.js';
import {
  User as UserIcon,
  Shield,
  LogOut,
  GraduationCap,
  Mail,
  Phone,
  Hash,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Layers
} from 'lucide-react';

interface StudentProfilePageProps {
  user: User;
}

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ user }) => {
  const { logout, updateUser } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const handleRegisterAuthenticator = async () => {
    setRegistering(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const options = await apiRequest<any>('/auth/webauthn/register/options', { method: 'POST' });
      const regResponse = await startRegistration({ optionsJSON: options });

      const verifyRes = await apiRequest<{ verified: boolean; message?: string }>('/auth/webauthn/register/verify', {
        method: 'POST',
        body: {
          registrationResponse: regResponse,
          deviceName: navigator.userAgent.includes('Mobile')
            ? 'Mobile Phone Authenticator'
            : 'Platform Authenticator'
        }
      });

      if (verifyRes.verified) {
        setAuthSuccess('Platform authenticator registered successfully! Your attendance punches are now secured.');
        updateUser({ isAuthenticationRegistered: true });
      } else {
        setAuthError(verifyRes.message || 'Authenticator verification failed.');
      }
    } catch (err: any) {
      console.error('Authenticator registration error:', err);
      if (err.name === 'NotAllowedError') {
        setAuthError('Authentication registration ceremony was cancelled on your device.');
      } else {
        setAuthError(err.message || 'Failed to complete platform authenticator registration.');
      }
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '640px', padding: '1.5rem 1rem' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Identity & College Credentials
        </div>
        <h1 style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>Student Profile</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Authoritative academic registry identity synchronized with the College ERP database.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="flex items-center gap-4" style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--brand-primary-light)',
            color: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.25rem'
          }}>
            {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{user.fullName}</h2>
              <Badge variant="present">STUDENT</Badge>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Department of {user.department || 'General Engineering'}
            </div>
          </div>
        </div>

        {/* Credentials Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Permanent Reg. Number (PRN)
            </div>
            <div className="mono font-semibold" style={{ fontSize: '1rem', color: 'var(--brand-primary)' }}>
              {user.prn}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Institutional ERP Identity</div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Class Roll Number
            </div>
            <div className="mono font-semibold" style={{ fontSize: '1rem' }}>
              {user.rollNumber || 'N/A'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Assigned Class Roll</div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Academic Division
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {user.activeDivision?.name || 'Unassigned'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Class Section</div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Lab Batch
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {user.activeBatch?.name || 'General / None'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Practical Cohort</div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Institutional Email
            </div>
            <div className="mono" style={{ fontSize: '0.85rem' }}>
              {user.email}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Contact Phone
            </div>
            <div className="mono" style={{ fontSize: '0.85rem' }}>
              {user.phone || 'Not recorded'}
            </div>
          </div>
        </div>
      </div>

      {/* Security & Verification Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-surface-subtle)' }}>
        <div style={{ fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2">
            <Shield size={16} color="var(--brand-primary)" />
            <span>Platform Attendance Authentication</span>
          </div>
          {user.isAuthenticationRegistered ? (
            <Badge variant="present">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} /> Registered & Active
              </span>
            </Badge>
          ) : (
            <Badge variant="absent">
              <span className="flex items-center gap-1">
                <AlertCircle size={12} /> Pending Enrollment
              </span>
            </Badge>
          )}
        </div>

        {authSuccess && (
          <div style={{ marginBottom: '0.75rem' }}>
            <Alert variant="success">{authSuccess}</Alert>
          </div>
        )}

        {authError && (
          <div style={{ marginBottom: '0.75rem' }}>
            <Alert variant="danger">{authError}</Alert>
          </div>
        )}

        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
          Your attendance punches require physical presence inside the classroom geofence via real device GPS,
          combined with a cryptographic assertion signed by your hardware platform authenticator (Face ID, Touch ID,
          Windows Hello, or Android Biometric).
        </p>

        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!user.isAuthenticationRegistered ? (
            <Button
              variant="primary"
              size="sm"
              loading={registering}
              onClick={handleRegisterAuthenticator}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Smartphone size={14} /> Register Platform Authenticator Now
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={registering}
              onClick={handleRegisterAuthenticator}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Smartphone size={14} /> Register / Add Current Phone Authenticator
            </Button>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Authoritative Geofence & Cryptographic Attendance • Zero fake credentials or simulated biometrics
        </div>
      </div>

      {/* Sign Out Action */}
      <Button
        variant="danger"
        fullWidth
        onClick={logout}
      >
        <LogOut size={16} /> Sign Out of Portal
      </Button>

    </div>
  );
};
