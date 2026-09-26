import React, { useState } from 'react';
import type { WebAuthnFailureReport, WebAuthnEnvironmentReport } from '../../utils/webauthnDiagnostics.js';
import { AlertCircle, CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface Props {
  failureReport?: WebAuthnFailureReport | null;
  envReport?: WebAuthnEnvironmentReport | null;
  onRetest?: () => void;
}

export const WebAuthnDiagnosticsCard: React.FC<Props> = ({ failureReport, envReport, onRetest }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const env = failureReport?.env || envReport;
  if (!failureReport && !env) return null;

  const handleCopy = () => {
    const data = JSON.stringify({ failureReport, env }, null, 2);
    navigator.clipboard?.writeText(data).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        marginTop: '0.85rem',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        fontSize: '0.78rem',
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div className="flex items-center gap-1.5" style={{ fontWeight: 700, color: '#1e293b' }}>
          <AlertCircle size={15} color="#ea580c" />
          <span>WebAuthn Device Diagnostics</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {onRetest && (
            <button
              type="button"
              onClick={onRetest}
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #94a3b8',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              Run Check
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #94a3b8',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem'
            }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{expanded ? 'Hide Details' : 'View Telemetry'}</span>
          </button>
        </div>
      </div>

      {failureReport?.probableRootCause && (
        <div style={{ marginBottom: '0.6rem', color: '#9a3412', fontWeight: 600, lineHeight: 1.4 }}>
          🔍 Root Cause Analysis: {failureReport.probableRootCause}
        </div>
      )}

      {failureReport && (
        <div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.6rem', backgroundColor: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#475569' }}>
            <strong>Raw Browser Error:</strong>{' '}
            <span className="mono" style={{ color: '#dc2626' }}>
              {failureReport.errorName}
            </span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.73rem', marginTop: '0.15rem', wordBreak: 'break-word' }}>
            "{failureReport.errorMessage}"
          </div>
        </div>
      )}

      {/* Pre-flight Diagnostic Checklist */}
      {env && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.35rem', marginBottom: '0.6rem' }}>
          <div className="flex items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            {env.isSecureContext ? <CheckCircle2 size={13} color="#16a34a" /> : <XCircle size={13} color="#dc2626" />}
            <span>Secure Context: <strong>{env.isSecureContext ? 'YES' : 'NO'}</strong></span>
          </div>

          <div className="flex items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            {env.hasPublicKeyCredential ? <CheckCircle2 size={13} color="#16a34a" /> : <XCircle size={13} color="#dc2626" />}
            <span>WebAuthn API: <strong>{env.hasPublicKeyCredential ? 'YES' : 'NO'}</strong></span>
          </div>

          <div className="flex items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            {env.platformAuthenticatorAvailable === true ? (
              <CheckCircle2 size={13} color="#16a34a" />
            ) : env.platformAuthenticatorAvailable === false ? (
              <XCircle size={13} color="#dc2626" />
            ) : (
              <HelpCircle size={13} color="#f59e0b" />
            )}
            <span>Platform Biometrics: <strong>{env.platformAuthenticatorAvailable === true ? 'YES' : env.platformAuthenticatorAvailable === false ? 'UNAVAILABLE' : 'UNKNOWN'}</strong></span>
          </div>

          <div className="flex items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
            {env.isBrave ? <AlertCircle size={13} color="#ea580c" /> : <CheckCircle2 size={13} color="#16a34a" />}
            <span>Browser: <strong>{env.isBrave ? 'Brave (Shields Active)' : env.isIOS ? 'iOS / Safari' : env.isAndroid ? 'Android' : 'Standard'}</strong></span>
          </div>
        </div>
      )}

      {/* Actionable Recommendations */}
      {failureReport?.recommendations && failureReport.recommendations.length > 0 && (
        <div style={{ marginTop: '0.4rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem' }}>
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>Resolution Steps:</div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#475569', lineHeight: 1.4 }}>
            {failureReport.recommendations.map((rec, i) => (
              <li key={i} style={{ marginBottom: '0.2rem' }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Collapsible Full Telemetry View */}
      {expanded && (
        <div style={{ marginTop: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600, color: '#64748b' }}>Raw Telemetry JSON</span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.4rem',
                borderRadius: '3px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              {copied ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '0.5rem',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              borderRadius: '4px',
              fontSize: '0.68rem',
              overflowX: 'auto',
              maxHeight: '180px'
            }}
          >
            {JSON.stringify({ failureReport, env }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
