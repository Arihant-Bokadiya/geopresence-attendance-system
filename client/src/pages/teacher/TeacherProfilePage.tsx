import React, { useState } from 'react';
import type { User } from '../../types/index.js';
import { apiRequest } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { UserCheck, Shield, Lock, Phone, Mail, User as UserIcon, KeyRound, CheckCircle2 } from 'lucide-react';

interface TeacherProfilePageProps {
  user: User;
  onBack: () => void;
}

export const TeacherProfilePage: React.FC<TeacherProfilePageProps> = ({ user, onBack }) => {
  const { updateUser } = useAuth?.() || { updateUser: () => {} };

  // Personal Info Form State
  const [fullName, setFullName] = useState(user.fullName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!fullName.trim()) {
      setProfileError('Full Name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setProfileError('A valid institutional email is required.');
      return;
    }

    try {
      setProfileSaving(true);
      const res = await apiRequest<{ success: boolean; message: string; user: any }>('/auth/teacher/profile', {
        method: 'PUT',
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null
        }
      });

      setProfileSuccess(res.message || 'Profile updated successfully.');
      if (res.user && updateUser) {
        updateUser(res.user);
      }
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update personal profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    try {
      setPasswordSaving(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword,
          newPassword
        }
      });

      setPasswordSuccess(res.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '820px', paddingBottom: '3rem' }}>
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: 'Faculty Profile', active: true }
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Faculty Profile & Credentials</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage your personal profile details and account security.
          </p>
        </div>
        <Badge variant="present">ACTIVE FACULTY</Badge>
      </div>

      <div className="grid grid-cols-1" style={{ gap: '1.5rem' }}>

        {/* 1. EDITABLE PERSONAL INFORMATION */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#ffffff' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <UserCheck size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Personal Information</h3>
          </div>

          {profileSuccess && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert variant="success">{profileSuccess}</Alert>
            </div>
          )}
          {profileError && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert variant="danger">{profileError}</Alert>
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="grid grid-cols-2 md-grid-cols-1" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label" htmlFor="teacher-fullname">
                  Full Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="teacher-fullname"
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Sharma"
                    required
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="teacher-email">
                  Institutional Email *
                </label>
                <input
                  id="teacher-email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. prof.sharma@institute.edu"
                  required
                  disabled={profileSaving}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="teacher-phone">
                  Contact Phone Number
                </label>
                <input
                  id="teacher-phone"
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  disabled={profileSaving}
                />
                <span className="form-helper">Optional personal phone number</span>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button type="submit" variant="primary" loading={profileSaving}>
                Save Profile Changes
              </Button>
            </div>
          </form>
        </div>

        {/* 2. READ-ONLY INSTITUTIONAL CONTROLS */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fcfcfd', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <div className="flex items-center gap-2">
              <Shield size={18} color="var(--brand-primary)" />
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Institutional Identity & Allocations</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Lock size={12} /> Managed by College Administrator
            </span>
          </div>

          <div className="grid grid-cols-3 md-grid-cols-1" style={{ gap: '1rem' }}>
            <div>
              <div className="stat-label">STAFF EMPLOYEE CODE</div>
              <div className="mono font-semibold" style={{ fontSize: '1rem', color: 'var(--brand-primary)', marginTop: '0.2rem' }}>
                {user.teacherCode || 'EMP-T101'}
              </div>
            </div>

            <div>
              <div className="stat-label">DEPARTMENT ASSIGNMENT</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem', color: 'var(--text-primary)' }}>
                {user.department || 'Not Assigned'}
              </div>
            </div>

            <div>
              <div className="stat-label">SYSTEM ROLE & PRIVILEGES</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                {user.role} (Geofence Authorized)
              </div>
            </div>
          </div>
        </div>

        {/* 3. CHANGE PASSWORD FORM */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#ffffff' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <KeyRound size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Change Account Password</h3>
          </div>

          {passwordSuccess && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert variant="success">{passwordSuccess}</Alert>
            </div>
          )}
          {passwordError && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert variant="danger">{passwordError}</Alert>
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div className="grid grid-cols-3 md-grid-cols-1" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label" htmlFor="current-password">
                  Current Password *
                </label>
                <input
                  id="current-password"
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  disabled={passwordSaving}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="new-password">
                  New Password *
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  disabled={passwordSaving}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="confirm-password">
                  Confirm New Password *
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  disabled={passwordSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button type="submit" variant="secondary" loading={passwordSaving}>
                Update Password
              </Button>
            </div>
          </form>
        </div>

      </div>

    </div>
  );
};
