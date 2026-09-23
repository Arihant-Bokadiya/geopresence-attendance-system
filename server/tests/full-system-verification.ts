/**
 * Full Production UI & API Integration Verification Script
 * Validates complete end-to-end flows matching the 18 steps from the user prompt:
 * 1. Vite frontend serving & asset validation
 * 2. Backend API health
 * 3. Teacher authentication & dashboard metrics
 * 4. Start attendance with authoritative classroom geofence
 * 5. Dynamic 6-digit OTP generation
 * 6. Student authentication (PRN20241002)
 * 7. Active session discovery for student division
 * 8. Authoritative location check: Outside classroom rejection (422)
 * 9. Authoritative location check: Inside classroom verification (200)
 * 10. Threat scenario: Invalid OTP rejection (422)
 * 11. Valid GPS + Valid OTP attendance recording (200 PRESENT + Receipt)
 * 12. Threat scenario: Duplicate attendance rejection (409 Conflict)
 * 13. Teacher live roster inspection (Student listed as PRESENT)
 * 14. Session closure and expiration enforcement
 * 15. Student attendance history & subject-wise percentage stats
 * 16. ERP ledger synchronization
 * 17. Role-Based Access Control (RBAC) security barriers
 */

const API_BASE = 'http://localhost:4050/api/v1';
const CLIENT_BASE = 'http://localhost:5180';

async function main() {
  console.log('===============================================================');
  console.log('🧪 Starting 18-Step Comprehensive System Verification');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Vite Frontend Serving
  console.log('Step 1 & 2: Frontend & Backend Server Health');
  const feRes = await fetch(CLIENT_BASE);
  assert(feRes.status === 200, `Vite frontend responding at ${CLIENT_BASE} with 200 OK`);
  const beRes = await fetch('http://localhost:4050/health');
  const beHealth = await beRes.json();
  assert(beHealth.status === 'healthy', `Backend healthy on port 4050 (${beHealth.service})`);

  // 3. Teacher Authentication
  console.log('\nStep 3 & 4: Teacher Authentication & Start Attendance');
  const teacherLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'teacher@college.edu', password: 'Password@123' })
  });
  const teacherLogin = await teacherLoginRes.json();
  assert(teacherLoginRes.status === 200 && teacherLogin.token, `Teacher authenticated: ${teacherLogin.user.fullName}`);
  const teacherToken = teacherLogin.token;

  // 4. Fetch Subjects & Classrooms
  const clsRes = await fetch(`${API_BASE}/classrooms`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const clsData = await clsRes.json();
  const lh401 = clsData.classrooms.find(c => c.roomCode === 'LH-401');
  assert(lh401 && lh401.allowedRadiusMeters === 25, `Classroom LH-401 geofence radius strictly 25m from DB`);

  const subRes = await fetch(`${API_BASE}/academic/subjects`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const subData = await subRes.json();
  const cs601 = subData.subjects.find(s => s.code === 'CS601');
  assert(cs601, `Subject CS601 retrieved: ${cs601.name}`);

  const divRes = await fetch(`${API_BASE}/academic/divisions`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const divData = await divRes.json();
  const divA = divData.divisions.find(d => d.name.includes('Division A'));
  assert(divA, `Division A retrieved: name="${divA?.name}" id=${divA?.id}`);

  // 5. Teacher Starts Attendance Session
  const createSessionRes = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subjectId: cs601.id,
      divisionId: divA.id,
      classroomId: lh401.id,
      durationMinutes: 10
    })
  });
  const sessionData = await createSessionRes.json();
  assert(createSessionRes.status === 201 && sessionData.session, `Session created: Code=${sessionData.session.sessionCode}`);
  const activeSessionId = sessionData.session.id;
  const rawOtp = sessionData.session.rawOtp;
  assert(rawOtp && rawOtp.length === 6, `Dynamic 6-Digit OTP generated: [ ${rawOtp} ]`);

  // 6. Student Authentication (Ananya Patel - PRN20241002)
  console.log('\nStep 5, 6, 7: Student Authentication & Geofence Verification');
  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'PRN20241002', password: 'Password@123' })
  });
  const studentLogin = await studentLoginRes.json();
  assert(studentLoginRes.status === 200 && studentLogin.token, `Student authenticated: ${studentLogin.user.fullName} (${studentLogin.user.prn})`);
  const studentToken = studentLogin.token;

  // 7. Student Discovers Active Session
  const studentActiveRes = await fetch(`${API_BASE}/sessions/active/for-student`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  const studentActive = await studentActiveRes.json();
  assert(studentActive.hasActiveSession === true, `Student discovered active session for Division A`);
  assert(studentActive.session.rawOtp === undefined, `CRITICAL SECURITY: OTP is NOT exposed in student active session endpoint`);

  // 8. Outside Geofence Rejection Test
  const outsideGeoRes = await fetch(`${API_BASE}/attendance/verify-location`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      latitude: 18.52180,
      longitude: 73.85800,
      accuracy: 5.0
    })
  });
  const outsideGeo = await outsideGeoRes.json();
  assert(outsideGeoRes.status === 422 && outsideGeo.status === 'OUTSIDE_CLASSROOM', `Outside geofence rejected with 422 OUTSIDE_CLASSROOM (Distance: ${outsideGeo.distanceMeters}m, Max: ${outsideGeo.allowedRadiusMeters}m)`);

  // 9. Inside Geofence Verification Test
  const insideGeoRes = await fetch(`${API_BASE}/attendance/verify-location`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      latitude: 18.52048,
      longitude: 73.85679,
      accuracy: 5.0
    })
  });
  const insideGeo = await insideGeoRes.json();
  assert(insideGeoRes.status === 200 && insideGeo.status === 'LOCATION_VERIFIED', `Inside geofence verified: "${insideGeo.message}" (${insideGeo.distanceMeters}m from beacon)`);

  // 10. Invalid OTP Rejection Test
  console.log('\nStep 8, 9, 10: OTP Validation & Attendance Punch');
  const invalidOtpRes = await fetch(`${API_BASE}/attendance/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      otp: '000000',
      latitude: 18.52048,
      longitude: 73.85679,
      accuracy: 5.0
    })
  });
  const invalidOtp = await invalidOtpRes.json();
  assert(invalidOtpRes.status === 422 && invalidOtp.code === 'INVALID_OTP', `Invalid OTP intercepted with 422: "${invalidOtp.message}"`);

  // 11. Valid OTP + GPS Submission
  const validSubmitRes = await fetch(`${API_BASE}/attendance/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      otp: rawOtp,
      latitude: 18.52048,
      longitude: 73.85679,
      accuracy: 5.0
    })
  });
  const validSubmit = await validSubmitRes.json();
  assert(validSubmitRes.status === 200 && validSubmit.status === 'PRESENT', `Attendance punch successful: PRESENT (Receipt: ${validSubmit.data.receiptHash})`);

  // 12. Duplicate Submission Rejection
  const dupSubmitRes = await fetch(`${API_BASE}/attendance/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      otp: rawOtp,
      latitude: 18.52048,
      longitude: 73.85679,
      accuracy: 5.0
    })
  });
  const dupSubmit = await dupSubmitRes.json();
  assert(dupSubmitRes.status === 409 && dupSubmit.status === 'ALREADY_MARKED', `Duplicate punch prevented with 409 ALREADY_MARKED`);

  // 13. Teacher Live Roster Inspection
  console.log('\nStep 11, 12, 13: Live Roster, History, and Session Closure');
  const rosterRes = await fetch(`${API_BASE}/reports/sessions/${activeSessionId}/roster`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const rosterData = await rosterRes.json();
  const ananyaInRoster = rosterData.roster.find(s => s.prn === 'PRN20241002');
  assert(ananyaInRoster && ananyaInRoster.status === 'PRESENT', `Live roster shows Ananya Patel (PRN20241002) as PRESENT`);

  // 14. Student Attendance History & Compliance
  const histRes = await fetch(`${API_BASE}/attendance/history`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  const histData = await histRes.json();
  const personalRecord = histData.history.find(h => h.sessionId === activeSessionId);
  assert(personalRecord && personalRecord.status === 'PRESENT', `Student personal history recorded attendance: Status=${personalRecord.status}, Distance=${personalRecord.distanceMeters}m`);
  assert(histData.summary.overallPercentage > 0, `Student percentage computed from real DB records: ${histData.summary.overallPercentage}%`);

  // 15. Teacher Closes Session
  const closeRes = await fetch(`${API_BASE}/sessions/${activeSessionId}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const closeData = await closeRes.json();
  assert(closeRes.status === 200 && closeData.status === 'CLOSED', `Attendance session closed and finalized`);

  // 16. Threat Scenario: Attempt to punch on closed session
  const punchClosedRes = await fetch(`${API_BASE}/attendance/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      otp: rawOtp,
      latitude: 18.52048,
      longitude: 73.85679,
      accuracy: 5.0
    })
  });
  assert(punchClosedRes.status === 410, `Punching on closed session strictly rejected with 410 Gone / SESSION_EXPIRED`);

  // 17. ERP Ledger Synchronization
  console.log('\nStep 14, 15, 16: ERP Export & RBAC Enforcement');
  const erpSyncRes = await fetch(`${API_BASE}/erp/sync/session/${activeSessionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  const erpSync = await erpSyncRes.json();
  assert(erpSyncRes.status === 200 && erpSync.batch.status === 'SYNCED', `ERP ledger sync succeeded: Batch=${erpSync.batch.batchCode}`);

  // 18. Strict Role-Based Access Control (RBAC) Barriers
  const studentCreateSession = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subjectId: cs601.id, divisionId: divA.id, classroomId: lh401.id })
  });
  assert(studentCreateSession.status === 403, `Security RBAC: Student blocked from creating attendance session (403 Forbidden)`);

  const teacherSubmitPunch = await fetch(`${API_BASE}/attendance/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId: activeSessionId, otp: '123456', latitude: 18.52, longitude: 73.85 })
  });
  assert(teacherSubmitPunch.status === 403, `Security RBAC: Teacher blocked from submitting student attendance (403 Forbidden)`);

  console.log('\n===============================================================');
  console.log(`📊 Comprehensive Verification Result: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
