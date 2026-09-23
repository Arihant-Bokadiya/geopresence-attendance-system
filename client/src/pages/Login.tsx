import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../utils/api.js';
import { Shield, Lock, ArrowRight, User, GraduationCap, Building2 } from 'lucide-react';

import { StudentSignupModal } from '../components/auth/StudentSignupModal.js';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<'STUDENT' | 'TEACHER' | 'ADMIN'>('STUDENT');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignupOpen, setIsSignupOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please provide your credentials.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest<{ success: boolean; token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-canvas)',
      padding: '1.5rem',
      backgroundImage: 'radial-gradient(ellipse at 50% 10%, rgba(27, 54, 93, 0.08) 0%, transparent 60%)'
    }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '0.75rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
            GeoPresence Portal
          </h1>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
            Classroom Attendance Verification System
          </p>
        </div>

        {/* Card Box */}
        <div className="card" style={{ padding: '1.75rem', boxShadow: 'var(--shadow-md)' }}>
          
          {/* 3 Role Tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.25rem',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.45rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'STUDENT' ? 'var(--brand-primary)' : 'transparent',
                color: activeTab === 'STUDENT' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                setActiveTab('STUDENT');
                setError(null);
              }}
            >
              <span className="flex items-center justify-center gap-1">
                <GraduationCap size={13} />
                Student
              </span>
            </button>

            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.45rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'TEACHER' ? 'var(--brand-primary)' : 'transparent',
                color: activeTab === 'TEACHER' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                setActiveTab('TEACHER');
                setError(null);
              }}
            >
              <span className="flex items-center justify-center gap-1">
                <User size={13} />
                Teacher
              </span>
            </button>

            <button
              type="button"
              style={{
                flex: 1,
                padding: '0.45rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'ADMIN' ? 'var(--brand-primary)' : 'transparent',
                color: activeTab === 'ADMIN' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                setActiveTab('ADMIN');
                setError(null);
              }}
            >
              <span className="flex items-center justify-center gap-1">
                <Building2 size={13} />
                Admin
              </span>
            </button>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              color: 'var(--color-danger-dark)',
              fontSize: '0.825rem',
              marginBottom: '1.25rem'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Identifier Field */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                {activeTab === 'STUDENT'
                  ? 'Permanent Registration Number (PRN)'
                  : (activeTab === 'TEACHER' ? 'Staff Email / Employee ID' : 'Administrator Email')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    activeTab === 'STUDENT'
                      ? 'Enter your PRN'
                      : (activeTab === 'TEACHER' ? 'faculty@college.edu or EMP-T101' : 'admin@college.edu')
                  }
                  required
                  autoCapitalize="characters"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.7rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In as {activeTab === 'STUDENT' ? 'Student' : (activeTab === 'TEACHER' ? 'Teacher' : 'Administrator')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Student Self-Registration Trigger (Student tab only) */}
            {activeTab === 'STUDENT' && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  New student?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSignupOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Note for Teachers and Admins */}
            {activeTab !== 'STUDENT' && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeTab === 'TEACHER'
                    ? 'Faculty accounts are provisioned by College Administration.'
                    : 'System Administrator accounts are provisioned via server CLI.'}
                </span>
              </div>
            )}

          </form>

        </div>

        {/* Footer Subtext */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Authoritative Geofence & Cryptographic Presence Engine • Production Dynamic Mode
        </div>

      </div>

      {/* Student Self-Registration Modal */}
      <StudentSignupModal
        isOpen={isSignupOpen}
        onClose={() => setIsSignupOpen(false)}
        onSuccess={(token, user) => {
          login(token, user);
        }}
      />
    </div>
  );
};
