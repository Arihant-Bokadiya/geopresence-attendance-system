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
while IFS= read -r ip; do
  if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ]; then
    IP_LIST+=("$ip")
  fi
done < <(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2}')

# Fallback check via ipconfig
if [ ${#IP_LIST[@]} -eq 0 ]; then
  for iface in en0 en1 en2; do
    ip="$(ipconfig getifaddr $iface 2>/dev/null || true)"
    if [ -n "$ip" ]; then
      IP_LIST+=("$ip")
    fi
  done
fi

echo "============================================================"
echo "🔐 GeoPresence Local HTTPS Certificate Generator"
echo "============================================================"
echo " Detected Mac Hostname : ${LOCAL_HOST}"
echo " Local Domain (mDNS)   : ${MDNS_DOMAIN}"
echo " Detected LAN IP(s)    : ${IP_LIST[*]:-None detected}"
echo "============================================================"

# 4. Prepare Subject Alternative Names (SANs) for the certificate
DOMAINS=(
  "localhost"
  "127.0.0.1"
  "::1"
  "${MDNS_DOMAIN}"
  "*.local"
)

for ip in "${IP_LIST[@]}"; do
  DOMAINS+=("${ip}")
  DOMAINS+=("${ip}.nip.io")
done

echo " Generating TLS certificate for:"
for d in "${DOMAINS[@]}"; do
  echo "   - ${d}"
done

# 5. Generate Certificate and Private Key via mkcert
mkcert -cert-file "${CERTS_DIR}/dev-cert.pem" \
       -key-file "${CERTS_DIR}/dev-key.pem" \
       "${DOMAINS[@]}"

# 6. Copy Root CA to certs/ and client/public/ca.pem for easy download
CAROOT="$(mkcert -CAROOT)"
if [ -f "${CAROOT}/rootCA.pem" ]; then
  cp "${CAROOT}/rootCA.pem" "${CERTS_DIR}/rootCA.pem"
  cp "${CAROOT}/rootCA.pem" "${CLIENT_PUBLIC_DIR}/ca.pem"
  echo " Root CA certificate copied to:"
  echo "   - ${CERTS_DIR}/rootCA.pem"
  echo "   - ${CLIENT_PUBLIC_DIR}/ca.pem (accessible at /ca.pem)"
fi

echo "============================================================"
echo "✅ Development SSL certificates generated successfully!"
echo "   Cert: ${CERTS_DIR}/dev-cert.pem"
echo "   Key : ${CERTS_DIR}/dev-key.pem"
echo ""
echo "📱 iPhone Access URL (Recommended for WebAuthn/Passkeys):"
echo "   https://${MDNS_DOMAIN}:5180"
echo "============================================================"
