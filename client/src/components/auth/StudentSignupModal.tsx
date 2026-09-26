import React, { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { apiRequest } from '../../utils/api.js';
import { Button } from '../ui/Button.js';
import { Alert } from '../ui/Alert.js';
import {
  probeWebAuthnEnvironment,
  analyzeWebAuthnFailure,
  sendWebAuthnDiagnostics,
  type WebAuthnFailureReport,
  type WebAuthnEnvironmentReport
} from '../../utils/webauthnDiagnostics.js';
import { WebAuthnDiagnosticsCard } from '../common/WebAuthnDiagnosticsCard.js';
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  X,
  Fingerprint,
  Smartphone,
  AlertCircle
} from 'lucide-react';

interface AcademicBatch {
  id: string;
  name: string;
}

interface AcademicDivision {
  id: string;
  name: string;
  academicYear?: string;
  semester?: number;
  batches: AcademicBatch[];
}

interface AcademicDepartment {
  id: string;
  code: string;
  name: string;
  divisions: AcademicDivision[];
}

interface StudentSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
}

type SignupStep = 'DETAILS' | 'AUTHENTICATION' | 'COMPLETE';

export const StudentSignupModal: React.FC<StudentSignupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<SignupStep>('DETAILS');

  // Academic Configuration from DB
  const [departments, setDepartments] = useState<AcademicDepartment[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [prn, setPrn] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Created Student State for WebAuthn ceremony
  const [registeredStudent, setRegisteredStudent] = useState<{
    token: string;
    user: any;
  } | null>(null);

  // WebAuthn Registration State
  const [registeringAuth, setRegisteringAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [failureReport, setFailureReport] = useState<WebAuthnFailureReport | null>(null);
  const [envReport, setEnvReport] = useState<WebAuthnEnvironmentReport | null>(null);

  // Probe environment when transitioning to AUTHENTICATION step
  useEffect(() => {
    if (step === 'AUTHENTICATION') {
      probeWebAuthnEnvironment().then(setEnvReport);
    }
  }, [step]);

  // Load active academic options when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAcademicOptions();
    } else {
      // Reset form state on close
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep('DETAILS');
    setFullName('');
    setPrn('');
    setEmail('');
    setPhone('');
    setRollNumber('');
    setDepartmentId('');
    setDivisionId('');
    setBatchId('');
    setPassword('');
    setConfirmPassword('');
    setFormError(null);
    setAuthError(null);
    setRegisteredStudent(null);
  };

  const loadAcademicOptions = async () => {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const res = await apiRequest<{ departments: AcademicDepartment[] }>('/auth/student/academic-options');
      setDepartments(res.departments || []);
      if ((res.departments || []).length === 0) {
        setOptionsError('No active academic departments configured in the institution. Contact your administrator.');
      }
    } catch (err: any) {
      console.error('Failed to load academic options:', err);
      setOptionsError('Unable to load institutional departments. Ensure the server is online.');
    } finally {
      setLoadingOptions(false);
    }
  };

  // Filter divisions and batches based on selection
  const selectedDepartment = departments.find(d => d.id === departmentId);
  const availableDivisions = selectedDepartment ? selectedDepartment.divisions : [];
  const selectedDivision = availableDivisions.find(div => div.id === divisionId);
  const availableBatches = selectedDivision ? selectedDivision.batches : [];

  // Step 1: Handle Details Submission
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Frontend validations
    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!prn.trim()) {
      setFormError('Please enter your Permanent Registration Number (PRN).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please provide a valid institutional email address.');
      return;
    }
    if (!departmentId) {
      setFormError('Please select your academic department.');
      return;
    }
    if (!divisionId) {
      setFormError('Please select your class division.');
      return;
    }
    if (!password) {
      setFormError('Please set an account password.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-type your password.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        prn: prn.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        rollNumber: rollNumber.trim() || null,
        departmentId,
        divisionId,
        batchId: batchId || null,
        password,
        confirmPassword
      };

      const res = await apiRequest<{
        success: boolean;
        token: string;
        user: any;
        status: string;
        message: string;
      }>('/auth/student/signup', {
        method: 'POST',
        body: payload
      });

      if (res.token && res.user) {
        setRegisteredStudent({ token: res.token, user: res.user });
        setStep('AUTHENTICATION');
      } else {
        setFormError('Failed to create account. Unexpected response from server.');
      }
    } catch (err: any) {
      console.error('Student registration error:', err);
      setFormError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Handle Native WebAuthn Platform Authentication Registration
  const handleRegisterAuthenticator = async () => {
    if (!registeredStudent?.token) {
      setAuthError('Authentication session missing. Please restart registration.');
      return;
    }

    setRegisteringAuth(true);
    setAuthError(null);
    setFailureReport(null);

    const env = await probeWebAuthnEnvironment();
    setEnvReport(env);

    let options: any = null;

    try {
      // 1. Fetch registration challenge options from backend with the student's auth token
      options = await apiRequest<any>('/auth/webauthn/register/options', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${registeredStudent.token}`
        }
      });

      // 2. Invoke browser native WebAuthn platform ceremony
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify cryptographic attestation with backend
      const verifyRes = await apiRequest<{ verified: boolean; message?: string }>('/auth/webauthn/register/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${registeredStudent.token}`
        },
        body: {
          registrationResponse: regResponse,
          deviceName: navigator.userAgent.includes('Mobile')
            ? 'Mobile Phone Authenticator'
            : 'Hardware Platform Authenticator'
        }
      });

      if (verifyRes.verified) {
        setStep('COMPLETE');
      } else {
        const verifyError = new Error(verifyRes.message || 'Authenticator verification was not accepted by security server');
        const report = analyzeWebAuthnFailure(verifyError, env, 'VERIFICATION', options);
        setFailureReport(report);
        sendWebAuthnDiagnostics(report);
        setAuthError(verifyRes.message || 'Authenticator verification was not accepted by the security server.');
      }
    } catch (err: any) {
      console.error('WebAuthn ceremony error:', err);
      const stage = !options ? 'OPTIONS_FETCH' : 'CEREMONY';
      const report = analyzeWebAuthnFailure(err, env, stage, options);
      setFailureReport(report);
      sendWebAuthnDiagnostics(report);

      const errName = report.errorName;
      const errMsg = report.errorMessage;

      if (errName === 'NotAllowedError') {
        if (errMsg && errMsg.toLowerCase().includes('cancel')) {
          setAuthError('Secure authentication prompt was cancelled on your device.');
        } else if (errMsg && errMsg.length > 0 && !errMsg.includes('[object')) {
          setAuthError(`Authentication not permitted (${errName}): ${errMsg}`);
        } else {
          setAuthError('Secure authentication setup was not permitted or cancelled by your device/browser.');
        }
      } else {
        setAuthError(errMsg || 'Platform authenticator registration failed. Ensure your device supports biometrics or screen lock.');
      }
    } finally {
      setRegisteringAuth(false);
    }
  };

  // Step 3: Complete & Transition to App
  const handleFinishAndEnter = () => {
    if (!registeredStudent) return;
    const finalUser = {
      ...registeredStudent.user,
      isAuthenticationRegistered: true
    };
    onSuccess(registeredStudent.token, finalUser);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        // Only allow background click to close if still on details form
        if (e.target === e.currentTarget && step === 'DETAILS') {
          onClose();
        }
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: step === 'DETAILS' ? '540px' : '460px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-subtle)',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div className="flex items-center gap-2">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>
                {step === 'DETAILS' && 'Student Self-Registration'}
                {step === 'AUTHENTICATION' && 'Platform Authentication Setup'}
                {step === 'COMPLETE' && 'Registration Complete'}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {step === 'DETAILS' && 'Step 1 of 2: Identity & Academic Details'}
                {step === 'AUTHENTICATION' && 'Step 2 of 2: Hardware-Backed Biometric Enrollment'}
                {step === 'COMPLETE' && 'Account Active & Verification Ready'}
              </div>
            </div>
          </div>

          {step === 'DETAILS' && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step Indicator Bar */}
        <div style={{ display: 'flex', height: '3px', backgroundColor: 'var(--border-subtle)' }}>
          <div
            style={{
              flex: 1,
              backgroundColor: 'var(--brand-primary)',
              transition: 'all 0.3s ease'
            }}
          />
          <div
            style={{
              flex: 1,
              backgroundColor: step === 'AUTHENTICATION' || step === 'COMPLETE' ? 'var(--brand-primary)' : 'transparent',
              transition: 'all 0.3s ease'
            }}
          />
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* STEP 1: DETAILS FORM */}
          {step === 'DETAILS' && (
            <div>
              {optionsError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert variant="danger">{optionsError}</Alert>
                </div>
              )}

              {formError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert variant="danger">{formError}</Alert>
                </div>
              )}

              <form onSubmit={handleDetailsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Full Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Full Legal Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* PRN & Roll Number Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      College PRN <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={prn}
                      onChange={(e) => setPrn(e.target.value.toUpperCase())}
                      placeholder="e.g. 124B1C088"
                      className="mono"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Roll Number
                    </label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. 24"
                      className="mono"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Email & Phone Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Institutional Email <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@college.edu"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Department Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Department <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setDivisionId('');
                      setBatchId('');
                    }}
                    disabled={loadingOptions || departments.length === 0}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      outline: 'none',
                      backgroundColor: 'var(--bg-surface)'
                    }}
                  >
                    <option value="">-- Select Your Department --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Division & Batch Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Division / Section <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <select
                      required
                      value={divisionId}
                      onChange={(e) => {
                        setDivisionId(e.target.value);
                        setBatchId('');
                      }}
                      disabled={!departmentId || availableDivisions.length === 0}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    >
                      <option value="">
                        {!departmentId ? 'Select Department First' : availableDivisions.length === 0 ? 'No Divisions Found' : '-- Select Division --'}
                      </option>
                      {availableDivisions.map((div) => (
                        <option key={div.id} value={div.id}>
                          {div.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Lab Batch (Optional)
                    </label>
                    <select
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      disabled={!divisionId || availableBatches.length === 0}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    >
                      <option value="">
                        {availableBatches.length === 0 ? 'No Batches in Division' : '-- General (No Batch) --'}
                      </option>
                      {availableBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Password Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Password <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Confirm Password <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    style={{ flex: 1 }}
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                    style={{ flex: 2 }}
                  >
                    <span>Create Account & Continue</span>
                    <ArrowRight size={15} />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: MANDATORY WEBAUTHN PLATFORM AUTHENTICATION */}
          {step === 'AUTHENTICATION' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--brand-primary-light)',
                  color: 'var(--brand-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Fingerprint size={36} />
              </div>

              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
                Setup Platform Authentication
              </h4>

              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
                This college attendance system uses hardware-backed platform authentication (Face ID, Touch ID,
                Windows Hello, or Android Biometric) to verify your identity when marking attendance. Raw biometrics
                are never transmitted or stored on college servers.
              </p>

              {/* Student Context Card */}
              {registeredStudent && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Registered Identity
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {registeredStudent.user.fullName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      PRN
                    </div>
                    <div className="mono font-semibold" style={{ fontSize: '0.875rem', color: 'var(--brand-primary)' }}>
                      {registeredStudent.user.prn}
                    </div>
                  </div>
                </div>
              )}

              {authError && (
                <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                  <Alert variant="danger">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>Authentication Notice</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>{authError}</div>
                      </div>
                    </div>
                  </Alert>

                  <WebAuthnDiagnosticsCard
                    failureReport={failureReport}
                    envReport={envReport}
                    onRetest={() => probeWebAuthnEnvironment().then(setEnvReport)}
                  />
                </div>
              )}

              {!authError && envReport && (envReport.platformAuthenticatorAvailable === false || !envReport.isSecureContext) && (
                <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                  <WebAuthnDiagnosticsCard
                    envReport={envReport}
                    onRetest={() => probeWebAuthnEnvironment().then(setEnvReport)}
                  />
                </div>
              )}

              <Button
                variant="primary"
                fullWidth
                loading={registeringAuth}
                onClick={handleRegisterAuthenticator}
                style={{ padding: '0.75rem', fontSize: '0.9rem' }}
              >
                <Smartphone size={16} />
                <span>Register Attendance Authenticator</span>
              </Button>

              <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Hardware security enclave cryptographic public-key exchange via W3C WebAuthn Level 2
              </div>
            </div>
          )}

          {/* STEP 3: REGISTRATION COMPLETE */}
          {step === 'COMPLETE' && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  border: '2px solid var(--color-success-border)'
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
                Registration Complete
              </h4>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
                Your device is now registered for secure attendance verification. You can now participate in active
                classroom attendance sessions using physical GPS presence and platform biometric credentials.
              </p>

              {registeredStudent && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.875rem 1rem',
                    textAlign: 'left',
                    marginBottom: '1.5rem',
                    fontSize: '0.8rem',
                    lineHeight: 1.6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Account Name:</span>
                    <span style={{ fontWeight: 600 }}>{registeredStudent.user.fullName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>College PRN:</span>
                    <span className="mono font-semibold" style={{ color: 'var(--brand-primary)' }}>{registeredStudent.user.prn}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                    <span>{registeredStudent.user.department}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Division / Batch:</span>
                    <span>{registeredStudent.user.activeDivision?.name || 'Assigned'} {registeredStudent.user.activeBatch ? `(${registeredStudent.user.activeBatch.name})` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Platform Security:</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} /> Registered & Active
                    </span>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                fullWidth
                onClick={handleFinishAndEnter}
                style={{ padding: '0.75rem', fontSize: '0.9rem' }}
              >
                <span>Proceed to Student Dashboard</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
