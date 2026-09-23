import { calculateHaversineDistanceMeters, evaluateGeofence } from '../src/utils/haversine.js';
import { generateSecureOtp, hashOtp, timingSafeCompare, generateAttendanceReceiptHash } from '../src/utils/crypto.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Automated Unit Tests...\n');

  // --- 1. Haversine Geodesic Math Tests ---
  console.log('--- 1. Haversine Geodesic Mathematics ---');
  
  // Identical points
  const p1 = { latitude: 18.5204303, longitude: 73.8567437 };
  const d0 = calculateHaversineDistanceMeters(p1, p1);
  assert(d0 === 0, 'Distance between identical points must be 0 meters');

  // Point ~15 meters away (Latitude +0.000135 approx 15m)
  const pInside = { latitude: 18.5204303 + 0.00010, longitude: 73.8567437 };
  const dInside = calculateHaversineDistanceMeters(p1, pInside);
  assert(dInside > 5 && dInside < 20, `Calculated distance (~11m) inside classroom: got ${dInside}m`);

  const geofenceInside = evaluateGeofence(pInside, p1, 25.0);
  assert(geofenceInside.isInside === true, 'Student at ~11m should be INSIDE 25m classroom radius');

  // Point ~100 meters away (Latitude +0.0009)
  const pOutside = { latitude: 18.5204303 + 0.00090, longitude: 73.8567437 };
  const dOutside = calculateHaversineDistanceMeters(p1, pOutside);
  assert(dOutside > 80, `Calculated distance outside campus: got ${dOutside}m`);

  const geofenceOutside = evaluateGeofence(pOutside, p1, 25.0);
  assert(geofenceOutside.isInside === false, 'Student at ~100m should be REJECTED (OUTSIDE 25m radius)');
  assert(geofenceOutside.marginMeters < 0, 'Margin should be negative when outside radius');

  // Single Source of Truth & Authoritative Boundary Consistency Test
  // Latitude +0.000238 is approx 26.5m from classroom (Outside 25m, but inside old 30m buffer)
  const pBoundaryViolator = { latitude: 18.5204303 + 0.000238, longitude: 73.8567437 };
  const dBoundary = calculateHaversineDistanceMeters(p1, pBoundaryViolator);
  const authoritativeClassroomRadius = 25.0; // Stored in Classroom DB
  const boundaryCheck = evaluateGeofence(pBoundaryViolator, p1, authoritativeClassroomRadius);

  assert(
    dBoundary > 25.0 && dBoundary < 30.0,
    `Calculated distance (${dBoundary}m) must be between 25m and 30m for boundary test`
  );
  assert(
    boundaryCheck.isInside === false,
    `CRITICAL: Student at ${dBoundary}m MUST be REJECTED because authoritative classroom radius is strictly ${authoritativeClassroomRadius}m (No silent buffer allowed)`
  );
  assert(
    boundaryCheck.allowedRadiusMeters === authoritativeClassroomRadius,
    `CRITICAL: Evaluated allowedRadiusMeters (${boundaryCheck.allowedRadiusMeters}m) MUST strictly equal authoritative classroom radius (${authoritativeClassroomRadius}m)`
  );

  // --- 2. Cryptographic OTP & Security Tests ---
  console.log('\n--- 2. Cryptographic OTP & Constant-Time Comparison ---');
  
  const otp1 = generateSecureOtp();
  assert(/^\d{6}$/.test(otp1), `Generated OTP must be strictly 6 digits: got ${otp1}`);
  
  const otpNum = parseInt(otp1, 10);
  assert(otpNum >= 100000 && otpNum <= 999999, 'OTP must fall within range [100000, 999999]');

  const hash1 = hashOtp(otp1);
  const hash1Clone = hashOtp(otp1);
  const wrongHash = hashOtp('000000');

  assert(timingSafeCompare(hash1, hash1Clone) === true, 'Matching OTP hashes must evaluate to true');
  assert(timingSafeCompare(hash1, wrongHash) === false, 'Mismatched OTP hashes must evaluate to false');

  // Digital Receipt Hash
  const receipt = generateAttendanceReceiptHash({
    studentPrn: 'PRN20241001',
    sessionId: 'test-session-uuid',
    timestamp: '2026-09-17T17:00:00.000Z',
    distanceMeters: 12.4
  });
  assert(/^[a-f0-9]{64}$/.test(receipt), 'Receipt hash must be a valid 64-character SHA-256 hex string');

  console.log(`\n========================================`);
  console.log(`📊 Test Summary: ${passed} passed, ${failed} failed.`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
