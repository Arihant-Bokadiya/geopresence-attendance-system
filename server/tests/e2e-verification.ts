const BASE_URL = 'http://localhost:4050/api/v1';

async function req(endpoint: string, method = 'GET', body?: any, token?: string) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runE2E() {
  console.log('===============================================================');
  console.log('🚀 Running Complete End-to-End GPS + OTP Verification Pipeline');
  console.log('===============================================================\n');

  // 1. Teacher Login
  console.log('1️⃣ Authenticating Faculty (Dr. Sarah Jenkins)...');
  const teacherLogin = await req('/auth/login', 'POST', {
    identifier: 'teacher@college.edu',
    password: 'Password@123'
  });
  if (!teacherLogin.ok) throw new Error('Teacher login failed: ' + JSON.stringify(teacherLogin.data));
  const teacherToken = teacherLogin.data.token;
  console.log(`   ✅ Logged in as ${teacherLogin.data.user.fullName} (${teacherLogin.data.user.teacherCode})`);

  // 2. Query Subjects & Classrooms
  const subRes = await req('/academic/subjects', 'GET', null, teacherToken);
  const clsRes = await req('/classrooms', 'GET', null, teacherToken);
  const divRes = await req('/academic/divisions', 'GET', null, teacherToken);

  const subject = subRes.data.subjects[0];
  const classroom = clsRes.data.classrooms.find((c: any) => c.roomCode === 'LH-401');
  const division = divRes.data.divisions[0];

  console.log(`   🎯 Subject: ${subject.code} (${subject.name})`);
  console.log(`   📍 Classroom: ${classroom.roomCode} (Lat: ${classroom.latitude}, Lon: ${classroom.longitude}, Radius: ${classroom.allowedRadiusMeters}m)`);

  // 3. Teacher Starts Attendance Session
  console.log('\n2️⃣ Teacher starts Attendance Session...');
  const sessionStart = await req('/sessions', 'POST', {
    subjectId: subject.id,
    divisionId: division.id,
    classroomId: classroom.id,
    durationSeconds: 300
  }, teacherToken);

  if (!sessionStart.ok) throw new Error('Session start failed: ' + JSON.stringify(sessionStart.data));
  const session = sessionStart.data.session;
  console.log(`   ✅ Session Created: Code=${session.sessionCode}, Status=${session.status}`);
  console.log(`   🔑 Generated 6-Digit Billboard OTP: [ ${session.rawOtp} ] (Expires in ${session.durationSeconds}s)`);

  // 4. Check Initial Roster
  console.log('\n3️⃣ Inspecting Initial Class Attendance Roster...');
  const initialRoster = await req(`/reports/sessions/${session.id}/roster`, 'GET', null, teacherToken);
  console.log(`   👥 Total Enrolled Students: ${initialRoster.data.summary.totalEnrolled}`);
  console.log(`   📊 Present: ${initialRoster.data.summary.presentCount}, Absent: ${initialRoster.data.summary.absentCount}`);
  if (initialRoster.data.summary.presentCount !== 0) throw new Error('Initial present count should be 0');

  // 5. Student Login (PRN20241001 - Aarav Sharma)
  console.log('\n4️⃣ Authenticating Student via PRN (Aarav Sharma - PRN20241001)...');
  const studentLogin = await req('/auth/login', 'POST', {
    identifier: 'PRN20241001',
    password: 'Password@123'
  });
  if (!studentLogin.ok) throw new Error('Student login failed: ' + JSON.stringify(studentLogin.data));
  const studentToken = studentLogin.data.token;
  console.log(`   ✅ Student Authenticated: ${studentLogin.data.user.fullName}, PRN: ${studentLogin.data.user.prn}, Roll: ${studentLogin.data.user.rollNumber}`);

  // 6. Test Scenario A: Correct OTP, but OUTSIDE Geofence (~120m away)
  console.log('\n5️⃣ Testing Threat Scenario A: Valid OTP + OUTSIDE Geofence (WhatsApp proxy attack)...');
  const outsideLat = classroom.latitude + 0.0011; // ~120m offset
  const outsideLon = classroom.longitude + 0.0011;
  const outsideAttempt = await req('/attendance/submit', 'POST', {
    sessionId: session.id,
    otp: session.rawOtp,
    latitude: outsideLat,
    longitude: outsideLon,
    accuracy: 10.0
  }, studentToken);

  console.log(`   HTTP Status: ${outsideAttempt.status}`);
  console.log(`   Response Code: ${outsideAttempt.data.code}`);
  console.log(`   Message: ${outsideAttempt.data.message}`);
  if (outsideAttempt.status !== 422 || outsideAttempt.data.code !== 'OUTSIDE_GEOFENCE') {
    throw new Error('Expected OUTSIDE_GEOFENCE rejection');
  }
  if (outsideAttempt.data.allowedRadiusMeters !== classroom.allowedRadiusMeters) {
    throw new Error(`Enforcement radius mismatch: expected ${classroom.allowedRadiusMeters}m, got ${outsideAttempt.data.allowedRadiusMeters}m`);
  }
  console.log(`   🛡️ Geofence Violation successfully intercepted: Authoritative radius strictly enforced at ${outsideAttempt.data.allowedRadiusMeters}m!`);

  // 7. Test Scenario B: Inside Geofence, but WRONG OTP
  console.log('\n6️⃣ Testing Threat Scenario B: Inside Geofence (~8m away) + WRONG OTP...');
  const insideLat = classroom.latitude + 0.00005; // ~7m offset
  const insideLon = classroom.longitude + 0.00005;
  const wrongOtpAttempt = await req('/attendance/submit', 'POST', {
    sessionId: session.id,
    otp: '000000',
    latitude: insideLat,
    longitude: insideLon,
    accuracy: 10.0
  }, studentToken);

  console.log(`   HTTP Status: ${wrongOtpAttempt.status}`);
  console.log(`   Response Code: ${wrongOtpAttempt.data.code}`);
  console.log(`   Message: ${wrongOtpAttempt.data.message}`);
  if (wrongOtpAttempt.status !== 422 || wrongOtpAttempt.data.code !== 'INVALID_OTP') {
    throw new Error('Expected INVALID_OTP rejection');
  }
  console.log('   🛡️ Invalid OTP successfully intercepted and rejected!');

  // 8. Test Scenario C: Valid PRN + Valid GPS (Inside) + Valid OTP -> SUCCESS
  console.log('\n7️⃣ Testing Scenario C: Combined Valid GPS + Valid OTP (Authoritative Punch)...');
  const validPunch = await req('/attendance/submit', 'POST', {
    sessionId: session.id,
    otp: session.rawOtp,
    latitude: insideLat,
    longitude: insideLon,
    accuracy: 8.5
  }, studentToken);

  console.log(`   HTTP Status: ${validPunch.status}`);
  console.log(`   Verification Status: ${validPunch.data.status}`);
  console.log(`   Distance Recorded: ${validPunch.data.data.distanceMeters} meters`);
  console.log(`   Receipt Hash: ${validPunch.data.data.receiptHash}`);
  if (validPunch.status !== 200 || validPunch.data.status !== 'PRESENT') {
    throw new Error('Expected PRESENT status');
  }
  console.log('   🎉 Attendance verified and recorded successfully!');

  // 9. Test Scenario D: Duplicate Punch Prevention
  console.log('\n8️⃣ Testing Scenario D: Duplicate Submission Prevention...');
  const dupPunch = await req('/attendance/submit', 'POST', {
    sessionId: session.id,
    otp: session.rawOtp,
    latitude: insideLat,
    longitude: insideLon,
    accuracy: 8.5
  }, studentToken);

  console.log(`   HTTP Status: ${dupPunch.status}`);
  console.log(`   Message: ${dupPunch.data.message}`);
  if (dupPunch.status !== 409) {
    throw new Error('Expected 409 Conflict for duplicate punch');
  }
  console.log('   🛡️ Duplicate punch cleanly blocked with 409 Conflict!');

  // 10. Verify Teacher Dashboard Roster Updated in Real-Time
  console.log('\n9️⃣ Inspecting Updated Faculty Roster...');
  const updatedRoster = await req(`/reports/sessions/${session.id}/roster`, 'GET', null, teacherToken);
  console.log(`   📊 Verified Present: ${updatedRoster.data.summary.presentCount}`);
  console.log(`   📊 Current Absent: ${updatedRoster.data.summary.absentCount}`);
  console.log(`   📈 Attendance Rate: ${updatedRoster.data.summary.attendancePercentage}%`);

  const aarav = updatedRoster.data.roster.find((r: any) => r.prn === 'PRN20241001');
  console.log(`   Student: ${aarav.studentName} (${aarav.prn}) -> Status: ${aarav.status} (Distance: ${aarav.locationDistanceMeters}m at ${aarav.markedTimestamp})`);
  if (aarav.status !== 'PRESENT') throw new Error('Aarav should be marked PRESENT');

  // 11. Sync to College ERP
  console.log('\n🔟 Testing Institutional ERP Ledger Synchronization...');
  const erpSync = await req(`/erp/sync/session/${session.id}`, 'POST', null, teacherToken);
  console.log(`   Batch Code: ${erpSync.data.batch.batchCode}`);
  console.log(`   Sync Status: ${erpSync.data.batch.status}`);
  console.log(`   Ledger Message: ${erpSync.data.message}`);
  if (!erpSync.ok || erpSync.data.batch.status !== 'SYNCED') {
    throw new Error('ERP sync failed');
  }
  console.log('   🏛️ ERP Ledger synchronization completed successfully!');

  console.log('\n===============================================================');
  console.log('🏆 All 10/10 Verification Scenarios PASSED WITH FLYING COLORS!');
  console.log('===============================================================');
}

runE2E().catch(e => {
  console.error('❌ E2E Verification failed:', e);
  process.exit(1);
});
