# GeoPresence Attendance System

An enterprise-grade physical presence verification platform for colleges and universities. The system eliminates proxy attendance by verifying physical student presence inside lecture halls using real device GPS geofencing and cryptographic platform authentication (Face ID, Touch ID, Windows Hello, Android Biometric).

---

## Current Architecture

The attendance system operates on a multi-stage verification pipeline:

```text
Student
  ↓
Login / Self-Registration
  ↓
Real Device GPS Geolocation
  ↓
Backend Geofence & Accuracy Verification (Haversine Formula)
  ↓
Hardware-Backed Platform Authentication (W3C WebAuthn Level 2)
  ↓
Attendance Recorded (Cryptographic Receipt Hash & Immutable Audit Log)
```

> [!NOTE]
> **Classroom Hardware (ESP32/BLE):**
> ESP32/BLE classroom beacons are currently **not** part of the active attendance flow and do not block attendance. Real device GPS geofencing combined with platform authenticator attestation serves as the authoritative verification engine. ESP32/BLE remains planned as an optional future hardware enhancement.

---

## Features

- **Three Role-Based Portals:**
  - **Super Admin:** Manage departments, divisions, lab batches, classrooms (with latitude, longitude, and allowed radius in meters), subjects, teacher assignments, and students.
  - **Teacher:** Start attendance sessions for assigned classes, monitor live attendee rosters with real-time distance and accuracy metrics, close active sessions, inspect attendance history, and export records for institutional ERP systems.
  - **Student:** Self-registration with dynamic institutional enrollment options, hardware authenticator setup, active session discovery, geofenced presence verification, and attendance history.
- **Authoritative Geofence Calculation:**
  - High-precision Haversine distance formula computed on the backend against authoritative classroom coordinates.
  - GPS accuracy thresholding rejects degraded or spoofed coordinates with accuracy radius exceeding 50 meters.
- **W3C WebAuthn Level 2 Platform Authentication:**
  - Hardware-enforced identity attestation using device security enclaves.
  - Prevents credentials-sharing, remote proxy punching, and simulated device payloads.
- **Session Isolation:**
  - Client state uses tab-isolated session storage, allowing simultaneous demonstration of Admin, Teacher, and Student roles across separate browser tabs without cross-session interference.
- **Audit Trails:**
  - Every attendance punch generates an SHA-256 receipt hash containing session ID, student PRN, timestamp, coordinates, and accuracy bounds for audit compliance.

---

## Authentication

The application enforces strict credential security:

- **Password Security:** All passwords are salted and hashed using `bcrypt` (10 rounds) before storage. Passwords are never stored in plaintext.
- **Token Authorization:** Stateless JSON Web Tokens (JWT) signed using HMAC-SHA256, verified via backend role-based access control middleware.
- **Platform Biometric Authentication (WebAuthn):**
  - **The system does NOT store fingerprint, face scan, or raw biometric data.**
  - Authentication relies on the W3C WebAuthn standard: biometric verification occurs entirely on the student's physical device inside its hardware security enclave.
  - The client transmits only a cryptographically signed assertion challenge, which the backend verifies against the student's registered public key.

---

## Setup

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AttendanceSystem_GPS
   ```

2. Install root and workspace dependencies:
   ```bash
   npm install
   ```

---

## Environment Variables

Create your local environment configuration file from the provided template:

```bash
cp .env.example .env
```

If configuring the server independently, copy the template inside the server directory:

```bash
cp server/.env.example server/.env
```

### Configuration Keys

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `development` |
| `PORT` | Backend HTTP API server port | `4050` |
| `CORS_ORIGIN` | Allowed client origin for CORS headers | `http://localhost:5180` |
| `DATABASE_URL` | Prisma database connection string | `file:./dev.db` |
| `JWT_SECRET` | Secret key for signing access tokens | *Cryptographically random string* |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | *Cryptographically random string* |
| `WEBAUTHN_RP_ID` | Relying Party ID for WebAuthn passkeys | `localhost` (or domain in production) |
| `WEBAUTHN_ORIGIN` | Comma-separated allowed origins for WebAuthn ceremonies | `http://localhost:5180,http://127.0.0.1:5180` |

---

## Database

The database layer is managed by Prisma ORM with SQLite for local development and PostgreSQL support for production deployments.

### Apply Schema

To push the database schema:

```bash
npm run prisma:push --workspace=server
npm run prisma:generate --workspace=server
```

### Clean Database Initialization

To reset the database to a zero-record baseline:

```bash
npm run seed --workspace=server
```

---

## First-Time Administrator Setup

A fresh database contains **zero** pre-configured administrators. Public self-registration for administrators is intentionally disabled.

To provision the initial System Administrator, execute the administrative CLI script on the server:

```bash
npm run create-admin --workspace=server -- --email <admin-email> --password <secure-password> --name "<Admin Name>"
```

Once provisioned, navigate to the portal and log in through the **Admin** tab using the configured credentials.

---

## Student Registration

Student self-registration is enabled on the portal login screen:

1. On the portal login page, select the **Student** tab and click **Create Account**.
2. Complete the registration form:
   - Full Legal Name
   - College Permanent Registration Number (PRN)
   - Institutional Email
   - Contact Phone (optional)
   - Department (populated dynamically from the database)
   - Division / Class Section (filtered by selected department)
   - Practical Lab Batch (filtered by selected division, if configured)
   - Password & Confirmation
3. Upon form submission, the student record is provisioned with status `AUTHENTICATION_PENDING`.
4. The system prompts the student to complete **Platform Authentication Setup**:
   - The browser invokes the native WebAuthn enrollment ceremony (Face ID, Touch ID, Windows Hello, Android Biometric).
   - The student's device generates a public-private key pair; the public key is registered with the backend.
5. Once registration is confirmed, the account status transitions to active, and the student is admitted to the Student Dashboard.

---

## Development

Run both the backend API and frontend Vite client concurrently:

```bash
# Terminal 1: Backend Server (runs on http://localhost:4050)
npm run dev --workspace=server

# Terminal 2: Frontend Client (runs on http://localhost:5180)
npm run dev --workspace=client
```

### Running Automated Acceptance Tests

Execute the comprehensive end-to-end acceptance test suite covering admin setup, multi-user session isolation, geofence boundary checks, and WebAuthn validation:

```bash
npx tsx server/tests/master-e2e.test.ts
```

---

## Production

### Building Production Bundles

Compile TypeScript for both the server and client:

```bash
npm run build --workspace=client
npm run build --workspace=server
```

### Running in Production

1. Ensure `.env` is configured with strong production secrets (`JWT_SECRET`, PostgreSQL `DATABASE_URL`, and proper `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`).
2. Run database migrations:
   ```bash
   npx prisma migrate deploy --schema=server/prisma/schema.prisma
   ```
3. Start the backend service:
   ```bash
   npm run start --workspace=server
   ```
4. Serve the client production build located in `client/dist/` using a reverse proxy (e.g., Nginx, Caddy, or Cloudflare Pages) configured with HTTPS (mandatory for WebAuthn and Geolocation APIs).
