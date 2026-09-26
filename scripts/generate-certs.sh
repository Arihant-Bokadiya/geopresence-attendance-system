#!/usr/bin/env bash
# ==============================================================================
# GeoPresence Attendance System — Local HTTPS Certificate Generator
# ==============================================================================
# This script automatically detects your Mac hostname and local network IP(s),
# creates a local CA via mkcert, and generates trusted SSL certificates for
# multi-device local development testing (including WebAuthn on iOS Safari).
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERTS_DIR="${ROOT_DIR}/certs"
CLIENT_PUBLIC_DIR="${ROOT_DIR}/client/public"

mkdir -p "${CERTS_DIR}"
mkdir -p "${CLIENT_PUBLIC_DIR}"

# 1. Verify mkcert is installed
if ! command -v mkcert >/dev/null 2>&1; then
  echo "❌ Error: 'mkcert' is not installed."
  echo "👉 Please install it using Homebrew: brew install mkcert"
  exit 1
fi

# 2. Detect Mac Local Hostname (used by mDNS / Bonjour)
LOCAL_HOST=""
if command -v scutil >/dev/null 2>&1; then
  LOCAL_HOST="$(scutil --get LocalHostName 2>/dev/null || true)"
fi
if [ -z "${LOCAL_HOST}" ]; then
  LOCAL_HOST="$(hostname -s 2>/dev/null || echo "macbook")"
fi

MDNS_DOMAIN="${LOCAL_HOST}.local"

# 3. Detect Active LAN IPv4 Addresses
IP_LIST=()

# Allow manual override via DEV_HOST_IP environment variable
if [ -n "${DEV_HOST_IP}" ]; then
  IP_LIST+=("${DEV_HOST_IP}")
fi

while IFS= read -r ip; do
  if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ]; then
    # Avoid duplicate IPs
    if [[ ! " ${IP_LIST[*]} " =~ " ${ip} " ]]; then
      IP_LIST+=("$ip")
    fi
  fi
done < <(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2}')

# Fallback check via ipconfig
if [ ${#IP_LIST[@]} -eq 0 ]; then
  for iface in en0 en1 en2; do
    ip="$(ipconfig getifaddr $iface 2>/dev/null || true)"
    if [ -n "$ip" ] && [[ ! " ${IP_LIST[*]} " =~ " ${ip} " ]]; then
      IP_LIST+=("$ip")
    fi
  done
fi

PRIMARY_IP="${IP_LIST[0]:-127.0.0.1}"

echo "============================================================"
echo "🔐 GeoPresence Local HTTPS Certificate Generator"
echo "============================================================"
echo " Detected Mac Hostname : ${LOCAL_HOST}"
echo " Local Domain (mDNS)   : ${MDNS_DOMAIN}"
echo " Detected LAN IP(s)    : ${IP_LIST[*]:-None detected}"
echo " Primary IP            : ${PRIMARY_IP}"
echo "============================================================"

# 4. Prepare Subject Alternative Names (SANs) for the certificate
# Android WebAuthn strictly requires a valid registrable domain under the
# Public Suffix List (e.g. .io via sslip.io or nip.io) and rejects .local mDNS.
# iOS natively supports both .local and sslip.io.
DOMAINS=(
  "localhost"
  "127.0.0.1"
  "::1"
  "${MDNS_DOMAIN}"
  "*.local"
  "*.sslip.io"
  "*.nip.io"
)

for ip in "${IP_LIST[@]}"; do
  DOMAINS+=("${ip}")
  DOMAINS+=("${ip}.sslip.io")
  DOMAINS+=("${ip//./-}.sslip.io")
  DOMAINS+=("${ip}.nip.io")
  DOMAINS+=("${ip//./-}.nip.io")
done

# De-duplicate domain list
UNIQUE_DOMAINS=($(printf "%s\n" "${DOMAINS[@]}" | sort -u))

echo " Generating TLS certificate for:"
for d in "${UNIQUE_DOMAINS[@]}"; do
  echo "   - ${d}"
done

# 5. Generate Certificate and Private Key via mkcert
mkcert -cert-file "${CERTS_DIR}/dev-cert.pem" \
       -key-file "${CERTS_DIR}/dev-key.pem" \
       "${UNIQUE_DOMAINS[@]}"

# 6. Copy Root CA to certs/ and client/public/ in PEM, CRT, and DER formats
CAROOT="$(mkcert -CAROOT)"
if [ -f "${CAROOT}/rootCA.pem" ]; then
  # Standard PEM
  cp "${CAROOT}/rootCA.pem" "${CERTS_DIR}/rootCA.pem"
  cp "${CAROOT}/rootCA.pem" "${CLIENT_PUBLIC_DIR}/ca.pem"

  # Standard CRT extension (Required by Android Certificate Installer)
  cp "${CAROOT}/rootCA.pem" "${CERTS_DIR}/rootCA.crt"
  cp "${CAROOT}/rootCA.pem" "${CLIENT_PUBLIC_DIR}/ca.crt"

  # Binary DER format (Fallback for strict mobile key stores)
  if command -v openssl >/dev/null 2>&1; then
    openssl x509 -in "${CAROOT}/rootCA.pem" -outform DER -out "${CERTS_DIR}/rootCA.der" 2>/dev/null || true
    if [ -f "${CERTS_DIR}/rootCA.der" ]; then
      cp "${CERTS_DIR}/rootCA.der" "${CLIENT_PUBLIC_DIR}/ca.der"
    fi
  fi

  echo " Root CA certificate exported to:"
  echo "   - ${CERTS_DIR}/rootCA.pem (accessible at /ca.pem)"
  echo "   - ${CERTS_DIR}/rootCA.crt (accessible at /ca.crt for Android)"
fi

echo "============================================================"
echo "✅ Development SSL certificates generated successfully!"
echo "   Cert: ${CERTS_DIR}/dev-cert.pem"
echo "   Key : ${CERTS_DIR}/dev-key.pem"
echo ""
echo "🤖 Android Testing URL (FIDO2 & WebAuthn Compatible):"
echo "   https://${PRIMARY_IP}.sslip.io:5180"
echo "   (Root CA download link for Android: https://${PRIMARY_IP}.sslip.io:5180/ca.crt)"
echo ""
echo "📱 iPhone Testing URL (Safari / Bonjour mDNS):"
echo "   https://${MDNS_DOMAIN}:5180"
echo "   OR https://${PRIMARY_IP}.sslip.io:5180"
echo ""
echo "💻 Mac Localhost URL:"
echo "   https://localhost:5180"
echo "============================================================"
