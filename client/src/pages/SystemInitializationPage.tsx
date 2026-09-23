import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../utils/api.js';
import { ShieldCheck, Lock, User, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SystemInitializationPageProps {
  onSetupComplete?: () => void;
}

export const SystemInitializationPage: React.FC<SystemInitializationPageProps> = ({
  onSetupComplete
}) => {
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        token: string;
        user: any;
      }>('/auth/initialize-admin', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password
        })
      });

      if (res.token && res.user) {
        login(res.token, res.user);
        if (onSetupComplete) onSetupComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize administrator account.');
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
      <div style={{ maxWidth: '480px', width: '100%' }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '0.75rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SYSTEM INITIALIZATION
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.25rem 0', color: 'var(--text-primary)' }}>
            Welcome to GeoPresence
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            No administrator exists yet. Create your primary institutional administrator account to begin.
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2rem', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              Create Administrator
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              This account will have full access to configure departments, courses, and users.
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              color: 'var(--color-danger-dark)',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Administrator Full Name *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar (Principal)"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                    fontSize: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Email / Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Email Address / Username *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@college.edu"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                    fontSize: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Used to log into the administrative control panel.
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Secure Password *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                    fontSize: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Confirm Password *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                    fontSize: '0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <span>Initializing System...</span>
              ) : (
                <>
                  <span>CREATE ADMINISTRATOR</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          GeoPresence System Initialization • Zero Seed Business Data Mode
        </div>

      </div>
    </div>
  );
};
