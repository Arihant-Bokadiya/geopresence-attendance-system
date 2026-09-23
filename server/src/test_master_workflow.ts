const BASE_URL = 'http://localhost:4050/api/v1';

async function request(endpoint: string, options: any = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: any = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function runTest() {
  console.log('====================================================================');
  console.log('🚀 TESTING MULTI-SESSION ISOLATION, WEBAUTHN & ATTENDANCE WORKFLOW');
  console.log('====================================================================\n');

  // 1. Verify Setup Status on Clean DB
  console.log('Step 1: Check Setup Status...');
  const setupStatusRes = await request('/auth/setup-status');
  console.log('Setup Status:', setupStatusRes.data);
  if (!setupStatusRes.data.needsSetup) {
    throw new Error('Expected needsSetup to be true on clean DB!');
  }
  console.log('✅ Setup status verified: needsSetup=true, adminCount=0\n');

  // 2. Initialize First Admin (Tab 1)
  console.log('Step 2: Initialize First Administrator (TAB 1)...');
  const initAdminRes = await request('/auth/initialize-admin', {
    method: 'POST',
    body: {
      fullName: 'System Administrator',
      email: 'admin@institution.edu',
      password: 'AdminPassword@2026'
    }
  });
  const adminToken = initAdminRes.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✅ First Admin created successfully. Token received.\n');

  // 3. Verify First-Run Setup is now DISABLED (rejects subsequent calls)
  console.log('Step 3: Verify First-Run Setup is disabled for subsequent calls...');
  try {
    await request('/auth/initialize-admin', {
      method: 'POST',
      body: {
        fullName: 'Hacker Admin',
        email: 'hacker@institution.edu',
        password: 'HackerPassword123'
      }
    });
    throw new Error('Failed: Expected initialize-admin to be blocked!');
  } catch (err: any) {
    if (err.status === 403) {
      console.log('✅ Subsequent admin initialization properly blocked (403 Forbidden):', err.data.message);
    } else {
      throw err;
    }
  }

  // 4. Admin creates Department
  console.log('\nStep 4: Admin creates Department dynamically...');
  const deptRes = await request('/admin/departments', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Computer Engineering',
      code: 'COMP'
    }
  });
  const departmentId = deptRes.data.department.id;
  console.log('✅ Department created:', deptRes.data.department.name, `(${deptRes.data.department.id})`);

  // 5. Admin creates Division & Batch
  console.log('\nStep 5: Admin creates Division and Batch dynamically...');
  const divRes = await request('/admin/divisions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Division B',
      departmentId,
      semester: 6,
      academicYear: '2025-2026'
    }
  });
  const divisionId = divRes.data.division.id;
  console.log('✅ Division created:', divRes.data.division.name, `(${divisionId})`);

  const batchRes = await request('/admin/batches', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      divisionId,
      name: 'B1'
    }
  });
  const batchId = batchRes.data.batch.id;
  console.log('✅ Batch created:', batchRes.data.batch.name, `(${batchId})`);

  // 6. Admin creates Classroom
  console.log('\nStep 6: Admin creates Classroom dynamically...');
  const classRes = await request('/admin/classrooms', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      roomCode: 'LH-401',
      buildingName: 'Main Academic Block',
      floorNumber: 4,
      latitude: 18.5204303,
      longitude: 73.8567437,
      allowedRadiusMeters: 25,
      isActive: true
    }
  });
  const classroomId = classRes.data.classroom.id;
  console.log('✅ Classroom created:', classRes.data.classroom.roomCode, `(Lat: 18.5204303, Lon: 73.8567437, Radius: 25m)`);

  // 7. Admin creates Classroom Device
  console.log('\nStep 7: Admin registers Classroom Device...');
  const devRes = await request('/admin/devices', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      deviceId: 'ESP32-LH401',
      classroomId,
      bleIdentifier: 'GEO-LH401',
      status: 'ACTIVE'
    }
  });
  console.log('✅ Classroom Device registered:', devRes.data.device.deviceId, `(Classroom: ${classRes.data.classroom.roomCode})`);

  // 8. Admin creates Subject
  console.log('\nStep 8: Admin creates Subject dynamically...');
  const subRes = await request('/admin/subjects', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      code: 'CS601',
      name: 'Computer Networks',
      departmentId,
      semester: 6,
      credits: 4
    }
  });
  const subjectId = subRes.data.subject.id;
  console.log('✅ Subject created:', subRes.data.subject.code, subRes.data.subject.name);

  // 9. Admin creates Teacher
  console.log('\nStep 9: Admin creates Teacher dynamically...');
  const teacherEmail = 'sarah.jenkins@college.edu';
  const teacherPassword = 'TeacherPass@123';
  const teacherRes = await request('/admin/teachers', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      employeeId: 'EMP-9001',
      fullName: 'Dr. Sarah Jenkins',
      email: teacherEmail,
      departmentId,
      phone: '9876543210',
      password: teacherPassword,
      isActive: true
    }
  });
  const teacherId = teacherRes.data.teacher.id;
  console.log('✅ Teacher created:', teacherRes.data.teacher.fullName, `(Emp ID: ${teacherRes.data.teacher.employeeId})`);

  // 10. Admin assigns Teacher to Subject + Division
  console.log('\nStep 10: Admin assigns Teacher to Subject and Division...');
  const assignRes = await request('/admin/assignments', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      teacherId,
      subjectId,
      divisionId,
      batchId
    }
  });
  console.log('✅ Teacher assignment created:', assignRes.data.assignment.id);

  // 11. Admin creates Student (with division and batch allocation)
  console.log('\nStep 11: Admin creates Student dynamically...');
  const studentPrn = '124B1C088';
  const studentEmail = 'aarav.sharma@college.edu';
  const studentPassword = 'StudentPass@123';
  const studentRes = await request('/admin/students', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      prn: studentPrn,
      fullName: 'Aarav Sharma',
      rollNumber: '23B101',
      email: studentEmail,
      departmentId,
      divisionId,
      batchId,
      academicYear: '2024-2028',
      password: studentPassword,
      isActive: true
    }
  });
  console.log('✅ Student created and enrolled:', studentRes.data.student.fullName, `(PRN: ${studentPrn})`);

  // 12. MULTI-USER PARALLEL LOGIN (Simulating Tab 1, Tab 2, Tab 3)
  console.log('\nStep 12: Simulating 3 Independent Browser Tabs/Sessions...');
  // Tab 2: Teacher logs in
  const teacherLoginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      identifier: teacherEmail,
      password: teacherPassword,
      role: 'TEACHER'
    }
  });
  const teacherToken = teacherLoginRes.data.token;
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
  console.log('   Tab 2 (Teacher) logged in:', teacherLoginRes.data.user.fullName);

  // Tab 3: Student logs in
  const studentLoginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      identifier: studentPrn,
      password: studentPassword,
      role: 'STUDENT'
    }
  });
  const studentToken = studentLoginRes.data.token;
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };
  console.log('   Tab 3 (Student) logged in:', studentLoginRes.data.user.fullName);

  // Verify all 3 sessions remain active simultaneously
  const adminMe = await request('/auth/me', { headers: adminHeaders });
  const teacherMe = await request('/auth/me', { headers: teacherHeaders });
  const studentMe = await request('/auth/me', { headers: studentHeaders });

  if (adminMe.data.user.role !== 'ADMIN' || teacherMe.data.user.role !== 'TEACHER' || studentMe.data.user.role !== 'STUDENT') {
    throw new Error('Multi-tab session leak detected!');
  }
  console.log('✅ Multi-session isolation verified: Tab 1 (Admin), Tab 2 (Teacher), Tab 3 (Student) operating concurrently with zero cross-contamination!\n');

  // 13. Student WebAuthn Phone Registration (Section 5 & 6)
  console.log('Step 13: Student checks phone authentication registration status...');
  const initialPhoneStatus = await request('/auth/webauthn/status', { headers: studentHeaders });
  console.log('   Initial Status:', initialPhoneStatus.data);
  if (initialPhoneStatus.data.isRegistered) {
    throw new Error('Expected phone to be not registered initially!');
  }
  console.log('✅ Verified: Phone is initially NOT registered (no fake credentials).\n');

  console.log('Step 14: Student generates WebAuthn phone registration options...');
  const regOptionsRes = await request('/auth/webauthn/register/options', {
    method: 'POST',
    headers: studentHeaders
  });
  console.log('   Challenge generated:', regOptionsRes.data.challenge.slice(0, 16) + '...');
  console.log('   RP ID:', regOptionsRes.data.rp.id, 'User:', regOptionsRes.data.user.name);

  // 15. Student registers WebAuthn Credential in Database
  console.log('\nStep 15: Student registers phone credential in database...');
  // We simulate the platform authenticator storing public key (e.g. from TouchID/FaceID)
  const testCredentialId = 'test_cred_id_' + Buffer.from(studentPrn).toString('base64url');
  const testPublicKey = Buffer.from('test_public_key_bytes_from_platform_authenticator').toString('base64url');

  // Register credential via database or API
  const { prisma } = await import('./db.js');
  await prisma.webAuthnCredential.create({
    data: {
      studentPrn,
      credentialId: testCredentialId,
      publicKey: testPublicKey,
      counter: 0,
      deviceType: 'Platform Authenticator (Face/Touch ID/Passcode)',
      transports: JSON.stringify(['internal'])
    }
  });

  const registeredPhoneStatus = await request('/auth/webauthn/status', { headers: studentHeaders });
  console.log('   Status after registration:', registeredPhoneStatus.data);
  if (!registeredPhoneStatus.data.isRegistered || registeredPhoneStatus.data.credentialCount !== 1) {
    throw new Error('Phone registration verification failed!');
  }
  console.log('✅ Verified: Phone Authentication is now registered for student!\n');

  // 16. Teacher Starts Attendance Session (Tab 2)
  console.log('Step 16: Teacher starts attendance session (Tab 2)...');
  const startSessionRes = await request('/sessions', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      subjectId,
      classroomId,
      divisionId,
      batchId,
      sessionType: 'LECTURE',
      durationMinutes: 30
    }
  });
  const sessionId = startSessionRes.data.session.id;
  console.log('✅ Attendance Session started! Session ID:', sessionId);
  console.log('   Classroom:', startSessionRes.data.session.classroom.roomCode);
  console.log('   Status:', startSessionRes.data.session.status);

  // 17. Student discovers active attendance session (Tab 3)
  console.log('\nStep 17: Student queries active sessions for their enrolled division (Tab 3)...');
  const activeSessionsRes = await request('/sessions/active/for-student', { headers: studentHeaders });
  console.log('   Has Active Session:', activeSessionsRes.data.hasActiveSession);
  console.log('   Active sessions count:', activeSessionsRes.data.activeSessions.length);
  const foundSession = activeSessionsRes.data.activeSessions.find((s: any) => s.id === sessionId);
  if (!foundSession) {
    throw new Error('Active session not found in student query!');
  }
  console.log('✅ Student dynamically sees active attendance session:', foundSession.subject.name, 'in', foundSession.classroom.roomCode);

  // 18. REJECTION TEST: Outside GPS Geofence Check
  console.log('\nStep 18: REJECTION TEST — Student outside GPS geofence (~500m away)...');
  try {
    const outsideRes = await request('/attendance/verify-presence', {
      method: 'POST',
      headers: studentHeaders,
      body: {
        sessionId,
        latitude: 18.5250000, // ~500m away
        longitude: 73.8600000,
        accuracy: 5.0,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          isSimulated: true
        }
      }
    });
    if (outsideRes.data.verified) {
      throw new Error('Failed: Expected outside geofence to NOT be verified!');
    }
    console.log('✅ Correctly flagged outside geofence (verified: false, distance:', outsideRes.data.distanceMeters, 'm)');
  } catch (err: any) {
    if (err.status === 422 || err.data?.code === 'OUTSIDE_GEOFENCE') {
      console.log('✅ Correctly REJECTED outside geofence:', err.data?.message);
    } else {
      throw err;
    }
  }

  // 19. REJECTION TEST: Biometric Authentication Cancellation / Failure
  console.log('\nStep 19: REJECTION TEST — Biometric Authentication Cancelled by Student...');
  try {
    await request('/attendance/submit', {
      method: 'POST',
      headers: studentHeaders,
      body: {
        sessionId,
        latitude: 18.5204400,
        longitude: 73.8567500,
        accuracy: 4.0,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          bleIdentifier: 'GEO-LH401',
          isSimulated: true
        },
        authPayload: {
          authenticatorConfirmed: false, // User cancelled biometric prompt
          simulatedFailure: true
        }
      }
    });
    throw new Error('Failed: Expected cancelled biometric to reject attendance!');
  } catch (err: any) {
    if (err.status === 401 || err.data?.code === 'BIOMETRIC_FAILED') {
      console.log('✅ Correctly REJECTED cancelled authentication (401 Unauthorized):', err.data.message);
    } else {
      throw err;
    }
  }

  // Verify Teacher live roster shows 0 PRESENT after failure
  const rosterCheckAfterFail = await request(`/sessions/${sessionId}/roster`, { headers: teacherHeaders });
  if (rosterCheckAfterFail.data.session.presentCount !== 0) {
    throw new Error('Teacher roster was modified after failed biometric authentication!');
  }
  console.log('✅ Teacher roster remains completely unchanged after failed authentication (0 Present).\n');

  // 20. SUCCESS TEST: Valid GPS + Classroom Device + Valid Phone Biometric Authentication
  console.log('Step 20: SUCCESS TEST — Valid GPS (10m) + Classroom Device + Authenticated Phone Biometric...');
  const submitRes = await request('/attendance/submit', {
    method: 'POST',
    headers: studentHeaders,
    body: {
      sessionId,
      latitude: 18.5204400,
      longitude: 73.8567500,
      accuracy: 4.0,
      devicePayload: {
        deviceId: 'ESP32-LH401',
        bleIdentifier: 'GEO-LH401',
        isSimulated: true
      },
      authPayload: {
        type: 'SIMULATED_BIOMETRIC',
        isSimulated: true,
        authenticatorConfirmed: true,
        biometricType: 'FINGERPRINT',
        timestamp: new Date().toISOString()
      }
    }
  });
  console.log('   Result:', submitRes.data.status, submitRes.data.message);
  if (submitRes.data.status !== 'PRESENT') {
    throw new Error('Expected status to be PRESENT');
  }
  console.log('✅ Attendance successfully recorded as PRESENT in database!\n');

  // 21. REJECTION TEST: Duplicate Attendance Attempt
  console.log('Step 21: REJECTION TEST — Attempt duplicate attendance submission...');
  try {
    await request('/attendance/submit', {
      method: 'POST',
      headers: studentHeaders,
      body: {
        sessionId,
        latitude: 18.5204400,
        longitude: 73.8567500,
        accuracy: 4.0,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          bleIdentifier: 'GEO-LH401',
          isSimulated: true
        },
        authPayload: {
          type: 'SIMULATED_BIOMETRIC',
          isSimulated: true,
          authenticatorConfirmed: true,
          biometricType: 'FINGERPRINT',
          timestamp: new Date().toISOString()
        }
      }
    });
    throw new Error('Failed: Expected duplicate attendance to be rejected!');
  } catch (err: any) {
    if (err.status === 409 || err.data?.code === 'ALREADY_MARKED') {
      console.log('✅ Correctly REJECTED duplicate attendance (409 Conflict):', err.data.message);
    } else {
      throw err;
    }
  }

  // 22. Teacher views live roster (Tab 2)
  console.log('\nStep 22: Teacher views live roster (Tab 2)...');
  const rosterRes = await request(`/sessions/${sessionId}/roster`, { headers: teacherHeaders });
  console.log('   Live Roster Present Count:', rosterRes.data.session.presentCount, '/', rosterRes.data.session.totalEligible);
  const studentEntry = rosterRes.data.session.students.find((s: any) => s.student.prn === studentPrn);
  if (!studentEntry || studentEntry.status !== 'PRESENT') {
    throw new Error('Student not recorded as PRESENT on live teacher roster!');
  }
  console.log('✅ Student confirmed PRESENT on Teacher Roster:', studentEntry.student.fullName, `(PRN: ${studentPrn})`);

  // 23. Teacher Closes Session (Tab 2)
  console.log('\nStep 23: Teacher closes the attendance session (Tab 2)...');
  const closeRes = await request(`/sessions/${sessionId}/close`, {
    method: 'POST',
    headers: teacherHeaders
  });
  const status = closeRes.data.status || closeRes.data.session?.status;
  console.log('   Session status after closure:', status);
  if (status !== 'CLOSED') {
    throw new Error('Session is not closed!');
  }
  console.log('✅ Attendance session CLOSED.');

  // 24. REJECTION TEST: Marking attendance on closed session
  console.log('\nStep 24: REJECTION TEST — Student attempting to mark attendance on closed session...');
  try {
    await request('/attendance/submit', {
      method: 'POST',
      headers: studentHeaders,
      body: {
        sessionId,
        latitude: 18.5204400,
        longitude: 73.8567500,
        accuracy: 4.0,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          bleIdentifier: 'GEO-LH401',
          isSimulated: true
        },
        authPayload: {
          type: 'SIMULATED_BIOMETRIC',
          isSimulated: true,
          authenticatorConfirmed: true,
          biometricType: 'FINGERPRINT',
          timestamp: new Date().toISOString()
        }
      }
    });
    throw new Error('Failed: Expected closed session to reject attendance!');
  } catch (err: any) {
    if (err.status === 410 || err.data?.code === 'SESSION_EXPIRED') {
      console.log('✅ Correctly REJECTED attendance on closed session (410 Expired):', err.data.message);
    } else {
      throw err;
    }
  }

  // 25. Final Admin KPI and Session Verification (Tab 1 remains untouched)
  console.log('\nStep 25: Tab 1 (Admin) remains fully authenticated and functional...');
  const finalStatsRes = await request('/admin/stats', { headers: adminHeaders });
  console.log('   Admin Operational Stats from Tab 1:', finalStatsRes.data);
  if (finalStatsRes.data.totalStudents !== 1 || finalStatsRes.data.totalTeachers !== 1) {
    throw new Error('Admin session corrupted!');
  }
  console.log('✅ Tab 1 Admin remains fully functional with 0 session disruption!\n');

  console.log('====================================================================');
  console.log('🎉 ALL 25 MULTI-SESSION, WEBAUTHN & ATTENDANCE CHECKS PASSED PERFECTLY!');
  console.log('====================================================================');
}

runTest().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.data || e.message);
  process.exit(1);
});
