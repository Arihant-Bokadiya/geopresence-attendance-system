/**
 * WebAuthn Diagnostics & Telemetry Utility
 * 
 * Provides deep client-side diagnostics to identify exact device, browser,
 * TLS certificate, domain, and platform authenticator failure modes.
 */

export interface WebAuthnEnvironmentReport {
  timestamp: string;
  isSecureContext: boolean;
  protocol: string;
  origin: string;
  hostname: string;
  userAgent: string;
  isBrave: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isMac: boolean;
  hasCredentialsAPI: boolean;
  hasPublicKeyCredential: boolean;
  platformAuthenticatorAvailable: boolean | null;
  conditionalMediationAvailable: boolean | null;
}

export interface WebAuthnFailureReport {
  stage: 'PRE_CHECK' | 'OPTIONS_FETCH' | 'CEREMONY' | 'VERIFICATION';
  errorName?: string;
  errorMessage?: string;
  errorCode?: string | number;
  errorCause?: any;
  rpIdExpected?: string;
  hostname?: string;
  rpIdMatchesHostname?: boolean;
  env: WebAuthnEnvironmentReport;
  probableRootCause?: string;
  recommendations: string[];
}

/**
 * Perform pre-flight probe of browser WebAuthn and security enclave capabilities
 */
export async function probeWebAuthnEnvironment(): Promise<WebAuthnEnvironmentReport> {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMac = /Macintosh/i.test(ua) && !isIOS;

  let isBrave = false;
  try {
    if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
      isBrave = await (navigator as any).brave.isBrave();
    } else if (/brave/i.test(ua)) {
      isBrave = true;
    }
  } catch {}

  const isSecureContext = window.isSecureContext === true;
  const hasCredentialsAPI = typeof navigator !== 'undefined' && typeof navigator.credentials !== 'undefined';
  const hasPublicKeyCredential = typeof window !== 'undefined' && typeof (window as any).PublicKeyCredential !== 'undefined';

  let platformAuthenticatorAvailable: boolean | null = null;
  let conditionalMediationAvailable: boolean | null = null;

  if (hasPublicKeyCredential) {
    const PK = (window as any).PublicKeyCredential;
    if (typeof PK.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        platformAuthenticatorAvailable = await PK.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (e) {
        platformAuthenticatorAvailable = false;
      }
    }

    if (typeof PK.isConditionalMediationAvailable === 'function') {
      try {
        conditionalMediationAvailable = await PK.isConditionalMediationAvailable();
      } catch {}
    }
  }

  return {
    timestamp: new Date().toISOString(),
    isSecureContext,
    protocol: window.location.protocol,
    origin: window.location.origin,
    hostname: window.location.hostname,
    userAgent: ua,
    isBrave,
    isAndroid,
    isIOS,
    isMac,
    hasCredentialsAPI,
    hasPublicKeyCredential,
    platformAuthenticatorAvailable,
    conditionalMediationAvailable
  };
}

/**
 * Analyze caught error and categorize the exact underlying failure
 */
export function analyzeWebAuthnFailure(
  err: any,
  env: WebAuthnEnvironmentReport,
  stage: 'PRE_CHECK' | 'OPTIONS_FETCH' | 'CEREMONY' | 'VERIFICATION',
  options?: any
): WebAuthnFailureReport {
  const errorName = err?.name || err?.cause?.name || 'Error';
  const rawMessage = err?.message || err?.cause?.message || String(err || 'Unknown error');
  const errorCode = err?.code || err?.cause?.code;
  const errorCause = err?.cause ? { name: err.cause.name, message: err.cause.message } : undefined;

  const rpIdExpected = options?.rp?.id || options?.rpId;
  const hostname = env.hostname.toLowerCase();
  const rpIdMatchesHostname = rpIdExpected ? rpIdExpected.toLowerCase() === hostname : undefined;

  const recommendations: string[] = [];
  let probableRootCause = 'Unknown WebAuthn exception';

  // 1. Insecure Context Check
  if (!env.isSecureContext) {
    probableRootCause = 'Insecure Context: The application origin is not recognized as a secure HTTPS context.';
    recommendations.push('Access the site strictly using HTTPS (e.g. https://...:5180).');
  }
  // 2. PublicKeyCredential Missing
  else if (!env.hasPublicKeyCredential) {
    probableRootCause = 'WebAuthn API Unavailable: The browser does not expose window.PublicKeyCredential.';
    recommendations.push('Ensure you are using a modern browser (Safari, Chrome, Firefox, Edge, Brave).');
    if (env.isBrave) {
      recommendations.push('In Brave: Disable Brave Shields for this domain (click the lion icon ➔ toggle Shields OFF).');
    }
  }
  // 3. Network or Fetch Error (e.g. "Failed to fetch")
  else if (errorName === 'TypeError' || rawMessage.toLowerCase().includes('failed to fetch')) {
    probableRootCause = 'Network Connection / CORS Error: The browser failed to reach the server API endpoints.';
    recommendations.push('Ensure you are accessing the application through the active HTTPS development URL.');
    recommendations.push('Verify your internet or Wi-Fi connection is active.');
  }
  // 4. Explicit TLS Certificate Error (e.g. "WebAuthn is not supported on sites with TLS certificate errors.")
  else if (
    rawMessage.toLowerCase().includes('tls certificate error') ||
    rawMessage.toLowerCase().includes('certificate error') ||
    rawMessage.toLowerCase().includes('cert_authority_invalid')
  ) {
    probableRootCause = 'Untrusted TLS Certificate: WebAuthn is strictly blocked by Chromium/Brave when the site has TLS certificate errors or when an SSL warning was bypassed.';
    recommendations.push('Access the application via the trusted HTTPS development tunnel (e.g. trycloudflare.com), which has a publicly trusted certificate.');
  }
  // 5. Android / Chromium .local domain rejection
  else if (env.isAndroid && hostname.endsWith('.local') && errorName === 'NotAllowedError') {
    probableRootCause = 'Android FIDO2 Domain Validation Restriction: Google Play Services FIDO2 Client on Android requires a registrable domain under the Public Suffix List and rejects mDNS ".local" domain strings.';
    recommendations.push(`Access the application via the trusted HTTPS development tunnel instead of ${hostname}.`);
  }
  // 6. Platform Authenticator Missing (e.g. No device PIN/fingerprint set)
  else if (env.platformAuthenticatorAvailable === false) {
    probableRootCause = 'Platform Authenticator Not Configured: No biometric sensor, Face ID, Touch ID, or device screen lock (PIN/Passcode) is active on this device.';
    recommendations.push('Set up a device screen lock (PIN, Pattern, Fingerprint, or Face Unlock) in your phone settings.');
    if (env.isAndroid) {
      recommendations.push('On Android: Ensure Google Play Services has screen lock credentials enabled.');
    }
  }
  // 7. RP ID mismatch
  else if (rpIdExpected && rpIdMatchesHostname === false) {
    probableRootCause = `RP ID Mismatch: Server requested RP ID "${rpIdExpected}" but current hostname is "${hostname}".`;
    recommendations.push(`Access the application using the expected hostname: "${rpIdExpected}".`);
  }
  // 8. Brave Shields / Fingerprinting Protection
  else if (env.isBrave && errorName === 'NotAllowedError' && !rawMessage.toLowerCase().includes('cancel')) {
    probableRootCause = 'Brave Shield / Fingerprinting Block: Brave Browser has built-in privacy shields that block WebAuthn platform ceremonies on local networks.';
    recommendations.push('Click the Brave Shields icon (orange lion in URL bar) and toggle "Shields DOWN" for this site, then try again.');
  }
  // 9. Explicit User Cancellation
  else if (errorName === 'NotAllowedError') {
    probableRootCause = 'User or OS Cancelled: The authentication modal was dismissed, timed out, or cancelled.';
    recommendations.push('Tap the register button again and complete the biometric prompt.');
  }

  return {
    stage,
    errorName,
    errorMessage: rawMessage,
    errorCode,
    errorCause,
    rpIdExpected,
    hostname,
    rpIdMatchesHostname,
    env,
    probableRootCause,
    recommendations
  };
}

/**
 * Asynchronously send diagnostic telemetry report to backend server for analysis
 */
export async function sendWebAuthnDiagnostics(report: WebAuthnFailureReport): Promise<void> {
  try {
    const payload = {
      timestamp: report.env.timestamp,
      stage: report.stage,
      errorName: report.errorName,
      errorMessage: report.errorMessage,
      errorCode: report.errorCode,
      errorCause: report.errorCause,
      probableRootCause: report.probableRootCause,
      isSecureContext: report.env.isSecureContext,
      protocol: report.env.protocol,
      origin: report.env.origin,
      hostname: report.env.hostname,
      rpIdExpected: report.rpIdExpected,
      rpIdMatchesHostname: report.rpIdMatchesHostname,
      isBrave: report.env.isBrave,
      hasPublicKeyCredential: report.env.hasPublicKeyCredential,
      platformAuthenticatorAvailable: report.env.platformAuthenticatorAvailable,
      conditionalMediationAvailable: report.env.conditionalMediationAvailable,
      userAgent: report.env.userAgent
    };

    await fetch('/api/v1/auth/webauthn/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}
