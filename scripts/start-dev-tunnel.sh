#!/usr/bin/env bash
# ==============================================================================
# GeoPresence Attendance System — Publicly Trusted HTTPS Development Tunnel
# ==============================================================================
# Provides a real, publicly trusted HTTPS origin via Cloudflare Tunnel
# Enables full cross-platform WebAuthn/FIDO2 biometrics on Android & iPhone
# without requiring private CA certificate installation.
# ==============================================================================

set -e

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ Error: 'cloudflared' is not installed."
  echo "👉 Please install it using Homebrew: brew install cloudflared"
  exit 1
fi

echo "============================================================"
echo "🚀 Starting Publicly Trusted HTTPS Development Tunnel"
echo "============================================================"
echo " Protocol  : HTTP/2 (TCP - reliable on mobile hotspots)"
echo " Target    : https://localhost:5180"
echo " Audience  : Android (Chrome/Brave) & iPhone (Safari)"
echo " Security  : Real WebAuthn + Google Trust Services TLS"
echo "============================================================"

exec cloudflared tunnel --edge-ip-version 4 --protocol http2 --url https://localhost:5180 --no-tls-verify
