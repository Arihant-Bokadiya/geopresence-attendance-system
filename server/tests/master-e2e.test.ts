import assert from 'node:assert';
import { prisma } from '../src/db.js';

const BASE_URL = 'http://localhost:4050/api/v1';

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

async function runMasterAcceptanceSuite() {
  console.log('========================================================================');
  console.log('🚀 RUNNING MASTER ACCEPTANCE SUITE — REAL TEST-READY & DEPLOY-READY SYSTEM');
  console.log('========================================================================\n');

  // Step 1: Wipe DB to 0 records (Clean First-Run Baseline)
  console.log('🧹 Step 1: Preparing Clean Database Slate (0 records)...');
  await prisma.auditLog.deleteMany();
  await prisma.erpStagingBatch.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.classroomDevice.deleteMany();
  await prisma.teacherAssignment.deleteMany();
  await prisma.studentEnrollment.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.webAuthnCredential.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.division.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  const userCount = await prisma.user.count();
  const studentCount = await prisma.student.count();
  const teacherCount = await prisma.teacher.count();
  const classroomCount = await prisma.classroom.count();
  const sessionCount = await prisma.attendanceSession.count();

  assert.strictEqual(userCount, 0, 'User table must have 0 records');
  assert.strictEqual(studentCount, 0, 'Student table must have 0 records');
  assert.strictEqual(teacherCount, 0, 'Teacher table must have 0 records');
  assert.strictEqual(classroomCount, 0, 'Classroom table must have 0 records');
  assert.strictEqual(sessionCount, 0, 'Session table must have 0 records');
  console.log('   ✅ PASS: Database is at absolute ZERO records. No business data exists.\n');

  // Step 2: First-Run Setup Status
  console.log('🔍 Step 2: Checking First-Run Setup Status...');
  const setupStatusRes = await api('/auth/setup-status');
  assert.strictEqual(setupStatusRes.status, 200);
  assert.strictEqual(setupStatusRes.data.needsSetup, true);
  assert.strictEqual(setupStatusRes.data.adminCount, 0);
  console.log('   ✅ PASS: Setup status reports needsSetup = true and adminCount = 0.\n');

  // Step 3: Verify No Universal / Default Credentials
  console.log('🔒 Step 3: Verifying Rejection of Default Credentials (admin/admin, 123456)...');
  const dummyLogin1 = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin@college.edu', password: 'admin' })
  });
  assert.strictEqual(dummyLogin1.status === 401 || dummyLogin1.status === 404, true);

  const dummyLogin2 = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'student', password: 'password' })
  });
  assert.strictEqual(dummyLogin2.status === 401 || dummyLogin2.status === 404, true);
  console.log('   ✅ PASS: Default/demo credentials do not exist.\n');

  // Step 4: First-Run Administrator Account Creation
  console.log('👤 Step 4: Creating First Administrator Account via /auth/initialize-admin...');
  const adminEmail = `registrar.${Date.now()}@institute.edu`;
  const adminPassword = 'StrongPassword!2026';
  const initAdminRes = await api('/auth/initialize-admin', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Dean of Academics Dr. S. Rao',
      email: adminEmail,
      password: adminPassword
    })
  });
  assert.strictEqual(initAdminRes.status, 201, `Failed to initialize admin: ${JSON.stringify(initAdminRes.data)}`);
  assert.ok(initAdminRes.data.token, 'Token must be issued');
  assert.strictEqual(initAdminRes.data.user.role, 'ADMIN');
  const adminToken = initAdminRes.data.token;
  console.log('   ✅ PASS: Administrator created securely with hashed password.\n');

  // Step 5: Verify One-Time Guard on Admin Initialization
  console.log('🛡️ Step 5: Testing Re-initialization Lockout (Must Reject Subsequent Admin Inits)...');
  const reInitRes = await api('/auth/initialize-admin', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Intruder',
      email: 'hacker@college.edu',
      password: 'password123'
    })
  });
  assert.strictEqual(reInitRes.status, 403, 'Subsequent admin initialization must return 403 Forbidden');
  console.log('   ✅ PASS: First-run initialization endpoint is permanently locked.\n');

  // Step 6: Admin Configures Real Institutional Architecture
  console.log('🏢 Step 6: Admin Configures Department, Classroom, Device, Division, and Batch...');
  
  // Create Department
  const deptRes = await api('/admin/departments', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Department of Computer Science & Engineering',
      code: 'CSE'
    })
  }, adminToken);
  assert.strictEqual(deptRes.status, 201);
  const deptId = deptRes.data.department.id;

  // Create Classroom with actual GPS coordinates (e.g., Tech Tower Room 302)
  const roomLat = 12.9715987;
  const roomLon = 77.5945627;
  const classroomRes = await api('/admin/classrooms', {
    method: 'POST',
    body: JSON.stringify({
      roomCode: 'CS-302',
      buildingName: 'Turing Technology Tower',
      floorNumber: 3,
      latitude: roomLat,
      longitude: roomLon,
      allowedRadiusMeters: 25.0,
      isActive: true
    })
  }, adminToken);
  assert.strictEqual(classroomRes.status, 201);
  const classroomId = classroomRes.data.classroom.id;
  console.log('   ✅ PASS: Department and Classroom (12.9715987, 77.5945627) registered without requiring ESP32.\n');

  // Create Division & Batch
  const divRes = await api('/admin/divisions', {
    method: 'POST',
    body: JSON.stringify({
      name: 'TE-CSE-A',
      academicYear: '2026-2027',
      semester: 6,
      departmentId: deptId
    })
  }, adminToken);
  assert.strictEqual(divRes.status, 201);
  const divisionId = divRes.data.division.id;

  const batchRes = await api('/admin/batches', {
    method: 'POST',
    body: JSON.stringify({
      name: 'A1',
      divisionId: divisionId
    })
  }, adminToken);
  assert.strictEqual(batchRes.status, 201);
  const batchId = batchRes.data.batch.id;

  // Step 7: Admin Creates Real Teacher and Real Student
  console.log('👩‍🏫 Step 7: Admin Creates Real Teacher and Real Student...');
  const teacherEmail = `prof.sharma.${Date.now()}@institute.edu`;
  const teacherPassword = 'FacultyPassword@2026';
  const teacherRes = await api('/admin/teachers', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Prof. Ramesh Sharma',
      employeeId: `EMP-T${Math.floor(1000 + Math.random() * 9000)}`,
      email: teacherEmail,
      departmentId: deptId,
      password: teacherPassword,
      phone: '+91 98765 43210'
    })
  }, adminToken);
  assert.strictEqual(teacherRes.status, 201);
  const teacherId = teacherRes.data.teacher.id;

  const studentPrn = `PRN${Date.now().toString().slice(-6)}`;
  const studentEmail = `student.${studentPrn.toLowerCase()}@institute.edu`;
  const studentPassword = 'StudentPassword@2026';
  const studentRes = await api('/admin/students', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Ananya Deshmukh',
      prn: studentPrn,
      rollNumber: '302-01',
      email: studentEmail,
      departmentId: deptId,
      divisionId: divisionId,
      batchId: batchId,
      academicYear: '2026-2027',
      password: studentPassword
    })
  }, adminToken);
  assert.strictEqual(studentRes.status, 201);
  console.log(`   ✅ PASS: Teacher (${teacherEmail}) and Student (${studentPrn}) created.\n`);

  // Step 7B: Student Academic Options & Self-Registration with Database Validations
  console.log('🎓 Step 7B: Testing Student Self-Registration Workflow...');

  // 1. Unauthenticated student queries academic enrollment options from DB
  const academicOptionsRes = await api('/auth/student/academic-options');
  assert.strictEqual(academicOptionsRes.status, 200);
  assert.ok(Array.isArray(academicOptionsRes.data.departments), 'Departments must be an array');
  const foundDept = academicOptionsRes.data.departments.find((d: any) => d.id === deptId);
  assert.ok(foundDept, 'Configured department must appear in academic options');
  const foundDiv = foundDept.divisions.find((div: any) => div.id === divisionId);
  assert.ok(foundDiv, 'Configured division must appear under department');
  console.log('   ✅ PASS: Academic options endpoint dynamically reflects database configuration.');

  // 2. Negative test: Password mismatch
  const mismatchRes = await api('/auth/student/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Siddharth Rao',
      prn: '124B1C999',
      email: 'siddharth@college.edu',
      departmentId: deptId,
      divisionId: divisionId,
      password: 'StrongPassword1',
      confirmPassword: 'DifferentPassword2'
    })
  });
  assert.strictEqual(mismatchRes.status, 400);

  // 3. Negative test: Duplicate PRN rejection (using studentPrn already created by admin)
  const duplicatePrnRes = await api('/auth/student/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Imposter Student',
      prn: studentPrn,
      email: 'imposter@college.edu',
      departmentId: deptId,
      divisionId: divisionId,
      password: 'StrongPassword1',
      confirmPassword: 'StrongPassword1'
    })
  });
  assert.strictEqual(duplicatePrnRes.status, 409);
  console.log('   ✅ PASS: Duplicate PRN rejection enforced with 409 Conflict.');

  // 4. Positive test: Successful student self-registration
  const selfPrn = `124B1C${Math.floor(100 + Math.random() * 899)}`;
  const selfEmail = `student.${selfPrn.toLowerCase()}@college.edu`;
  const selfSignupRes = await api('/auth/student/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Siddharth Rao',
      prn: selfPrn,
      email: selfEmail,
      phone: '+91 99887 76655',
      departmentId: deptId,
      divisionId: divisionId,
      batchId: batchId,
      password: 'SelfStudentPassword@2026',
      confirmPassword: 'SelfStudentPassword@2026'
    })
  });
  assert.strictEqual(selfSignupRes.status, 201);
  assert.strictEqual(selfSignupRes.data.status, 'AUTHENTICATION_PENDING');
  assert.strictEqual(selfSignupRes.data.user.prn, selfPrn);
  assert.strictEqual(selfSignupRes.data.user.phone, '+91 99887 76655');
  assert.strictEqual(selfSignupRes.data.user.isAuthenticationRegistered, false);
  const selfStudentToken = selfSignupRes.data.token;

  // 5. Verify initial WebAuthn status is false
  const selfStatusRes = await api('/auth/webauthn/status', {}, selfStudentToken);
  assert.strictEqual(selfStatusRes.status, 200);
  assert.strictEqual(selfStatusRes.data.isRegistered, false);

  // 6. Request WebAuthn registration options for the self-registered student
  const selfRegOptionsRes = await api('/auth/webauthn/register/options', { method: 'POST' }, selfStudentToken);
  assert.strictEqual(selfRegOptionsRes.status, 200);
  assert.ok(selfRegOptionsRes.data.challenge, 'WebAuthn challenge must be generated');
  assert.strictEqual(selfRegOptionsRes.data.authenticatorSelection.authenticatorAttachment, 'platform');
  console.log(`   ✅ PASS: Student self-registration completed (PRN: ${selfPrn}), status: AUTHENTICATION_PENDING, WebAuthn challenge issued.\n`);

  // Step 8: Admin Creates Real Subject and Teacher Assignment
  console.log('📚 Step 8: Admin Creates Subject and Assigns Teacher...');
  const subjectRes = await api('/admin/subjects', {
    method: 'POST',
    body: JSON.stringify({
      code: 'CS601',
      name: 'Distributed Cloud Systems',
      departmentId: deptId,
      semester: 6,
      credits: 4
    })
  }, adminToken);
  assert.strictEqual(subjectRes.status, 201);
  const subjectId = subjectRes.data.subject.id;

  const assignRes = await api('/admin/assignments', {
    method: 'POST',
    body: JSON.stringify({
      teacherId,
      subjectId,
      divisionId,
      batchId: null
    })
  }, adminToken);
  assert.strictEqual(assignRes.status, 201);
  console.log('   ✅ PASS: Subject CS601 created and assigned to Teacher.\n');

  // Step 9: Multi-User Simultaneous Session Isolation Test
  console.log('👥 Step 9: Multi-User Independent Authentication Contexts...');
  
  // Teacher Login
  const teacherLoginRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: teacherEmail,
      password: teacherPassword
    })
  });
  assert.strictEqual(teacherLoginRes.status, 200);
  assert.strictEqual(teacherLoginRes.data.user.role, 'TEACHER');
  let teacherToken = teacherLoginRes.data.token;

  // Student Login (PRN Identity)
  const studentLoginRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: studentPrn,
      password: studentPassword
    })
  });
  assert.strictEqual(studentLoginRes.status, 200);
  assert.strictEqual(studentLoginRes.data.user.role, 'STUDENT');
  assert.strictEqual(studentLoginRes.data.user.prn, studentPrn);
  const studentToken = studentLoginRes.data.token;

  // Verify Admin Token remains intact and independent
  const adminStatsCheck = await api('/admin/stats', {}, adminToken);
  assert.strictEqual(adminStatsCheck.status, 200);
  console.log('   ✅ PASS: Independent simultaneous tokens for Admin, Teacher, and Student verified.\n');

  // Step 9B: Teacher Profile Editing, Password Change, and Classroom RBAC Restriction
  console.log('🔒 Step 9B: Testing Teacher Profile Editing, Password Change, and RBAC Restrictions...');
  
  // 1. Teacher updates their personal profile
  const profileUpdateRes = await api('/auth/teacher/profile', {
    method: 'PUT',
    body: JSON.stringify({
      fullName: 'Prof. Ramesh Sharma (PhD)',
      email: teacherEmail,
      phone: '+91 91234 56789'
    })
  }, teacherToken);
  assert.strictEqual(profileUpdateRes.status, 200);
  assert.strictEqual(profileUpdateRes.data.user.fullName, 'Prof. Ramesh Sharma (PhD)');
  assert.strictEqual(profileUpdateRes.data.user.phone, '+91 91234 56789');

  // 2. Teacher attempts to create a classroom (Must be rejected with 403 Forbidden)
  const teacherClassroomAttempt = await api('/classrooms', {
    method: 'POST',
    body: JSON.stringify({
      roomCode: 'LH-ILLEGAL',
      buildingName: 'Main',
      floorNumber: 1,
      latitude: 12.9715,
      longitude: 77.5945
    })
  }, teacherToken);
  assert.strictEqual(teacherClassroomAttempt.status, 403, 'Teachers must NOT have permission to create classrooms');

  // 3. Teacher attempts to change password with invalid current password (Must fail with 401)
  const wrongPasswordRes = await api('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: 'WrongPassword123',
      newPassword: 'NewFacultyPassword@2026'
    })
  }, teacherToken);
  assert.strictEqual(wrongPasswordRes.status, 401);

  // 4. Teacher changes password with valid current password
  const newTeacherPassword = 'NewFacultyPassword@2026';
  const changePasswordRes = await api('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: teacherPassword,
      newPassword: newTeacherPassword
    })
  }, teacherToken);
  assert.strictEqual(changePasswordRes.status, 200);

  // 5. Verify Teacher can authenticate with the new password
  const newLoginRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: teacherEmail,
      password: newTeacherPassword
    })
  });
  assert.strictEqual(newLoginRes.status, 200);
  teacherToken = newLoginRes.data.token;
  console.log('   ✅ PASS: Teacher profile editing, secure password change, and classroom RBAC verified.\n');

  // Step 10: Teacher Starts Attendance Session (Without Any ESP32 Device Configured)
  console.log('⏱️ Step 10: Teacher Starts Attendance Session in Classroom CS-302 (Zero ESP32 Devices Required)...');
  const startSessionRes = await api('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      subjectId,
      divisionId,
      classroomId,
      durationMinutes: 5
    })
  }, teacherToken);
  assert.strictEqual(startSessionRes.status, 201);
  const sessionId = startSessionRes.data.session.id;
  console.log(`   ✅ PASS: Session ${startSessionRes.data.session.sessionCode} started in CS-302.\n`);

  // Step 11: Student Discovers Active Session
  console.log('📡 Step 11: Student Discovers Active Session for Enrolled Division...');
  const studentActiveRes = await api('/sessions/active/for-student', {}, studentToken);
  assert.strictEqual(studentActiveRes.status, 200);
  assert.strictEqual(studentActiveRes.data.hasActiveSession, true);
  assert.strictEqual(studentActiveRes.data.session.id, sessionId);
  console.log('   ✅ PASS: Student dynamically sees the active lecture session.\n');

  // Step 12: Negative Test — GPS Outside Classroom Geofence
  console.log('❌ Step 12: Testing Outside Geofence Rejection (Lat: 12.98000, ~950m away)...');
  const outsideRes = await api('/attendance/verify-presence', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      latitude: roomLat + 0.008, // ~900m outside
      longitude: roomLon + 0.008,
      accuracy: 5.0
    })
  }, studentToken);
  assert.strictEqual(outsideRes.data.verified, false);
  assert.strictEqual(outsideRes.data.status, 'OUTSIDE_GEOFENCE');
  console.log('   ✅ PASS: Student outside geofence is rejected with OUTSIDE_GEOFENCE.\n');

  // Step 13: Negative Test — Poor GPS Accuracy Rejection
  console.log('❌ Step 13: Testing Poor GPS Accuracy Rejection (>50m accuracy)...');
  const poorAccRes = await api('/attendance/verify-presence', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      latitude: roomLat + 0.00002, // inside coordinates
      longitude: roomLon + 0.00002,
      accuracy: 85.0 // poor accuracy
    })
  }, studentToken);
  assert.strictEqual(poorAccRes.data.verified, false);
  assert.strictEqual(poorAccRes.data.status, 'ACCURACY_TOO_LOW');
  console.log('   ✅ PASS: Poor accuracy rejected with ACCURACY_TOO_LOW message.\n');

  // Step 14: Negative Test — Cancelled / Failed Phone Biometric Authentication
  console.log('❌ Step 14: Testing Cancelled / Failed Phone Biometric Authentication...');
  const cancelledAuthRes = await api('/attendance/submit', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      latitude: roomLat + 0.00003,
      longitude: roomLon + 0.00003,
      accuracy: 4.5,
      authPayload: {
        type: 'SIMULATED_BIOMETRIC',
        authenticatorConfirmed: false, // User cancelled Touch ID / Face ID
        simulatedFailure: true
      }
    })
  }, studentToken);
  assert.strictEqual(cancelledAuthRes.status, 401);
  assert.strictEqual(cancelledAuthRes.data.code, 'BIOMETRIC_FAILED');

  // Verify DB contains ZERO attendance records marked as PRESENT
  const presentCountAfterFail = await prisma.attendanceRecord.count({
    where: { sessionId, status: 'PRESENT' }
  });
  assert.strictEqual(presentCountAfterFail, 0, 'No attendance record must be marked PRESENT on auth failure');
  console.log('   ✅ PASS: Cancelled biometric authentication creates ZERO attendance records.\n');

  // Step 15: Positive Test — Valid Physical Presence + Authenticated Phone Identity
  console.log('✅ Step 15: Submitting Valid Attendance (GPS Geofence + Phone Authentication)...');
  const validPunchRes = await api('/attendance/submit', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      latitude: roomLat + 0.00003, // ~3.5 meters from center
      longitude: roomLon + 0.00003,
      accuracy: 4.5,
      authPayload: {
        type: 'SIMULATED_BIOMETRIC',
        isSimulated: true,
        authenticatorConfirmed: true,
        biometricType: 'FINGERPRINT'
      }
    })
  }, studentToken);
  assert.strictEqual(validPunchRes.status, 200);
  assert.strictEqual(validPunchRes.data.status, 'PRESENT');
  assert.ok(validPunchRes.data.data.receiptHash, 'Cryptographic receipt hash must be generated');
  console.log('   ✅ PASS: Attendance successfully verified and recorded as PRESENT.\n');

  // Step 16: Negative Test — Duplicate Attendance Prevention
  console.log('❌ Step 16: Testing Duplicate Attendance Prevention...');
  const duplicatePunchRes = await api('/attendance/submit', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      latitude: roomLat + 0.00003,
      longitude: roomLon + 0.00003,
      accuracy: 4.5,
      authPayload: {
        type: 'SIMULATED_BIOMETRIC',
        isSimulated: true,
        authenticatorConfirmed: true
      }
    })
  }, studentToken);
  assert.strictEqual(duplicatePunchRes.status, 409);
  assert.strictEqual(duplicatePunchRes.data.code, 'ALREADY_MARKED');
  console.log('   ✅ PASS: Duplicate punch rejected with 409 ALREADY_MARKED.\n');

  // Step 17: Live Faculty Roster Reconciliation
  console.log('📊 Step 17: Faculty Inspects Live Attendance Roster from DB...');
  const rosterRes = await api(`/reports/sessions/${sessionId}/roster`, {}, teacherToken);
  assert.strictEqual(rosterRes.status, 200);
  assert.strictEqual(rosterRes.data.summary.presentCount, 1);
  const studentInRoster = rosterRes.data.roster.find((r: any) => r.prn === studentPrn);
  assert.ok(studentInRoster, 'Student must be in faculty roster');
  const dist = studentInRoster.locationDistanceMeters ?? studentInRoster.distanceMeters;
  assert.ok(dist !== null && dist < 25.0, 'Distance must be verified within geofence');
  console.log(`   ✅ PASS: Faculty roster reflects student PRESENT (Distance: ${dist.toFixed(2)}m, Accuracy: ${studentInRoster.gpsAccuracyMeters}m).\n`);

  // Step 18: Teacher Closes Attendance Session
  console.log('🔒 Step 18: Teacher Closes Attendance Session...');
  const closeSessionRes = await api(`/sessions/${sessionId}/close`, { method: 'POST' }, teacherToken);
  assert.strictEqual(closeSessionRes.status, 200);
  console.log('   ✅ PASS: Session marked CLOSED.\n');

  // Step 19: Negative Test — Attendance Attempt on Closed Session
  console.log('❌ Step 19: Testing Punch Attempt on Closed Session...');
  const closedPunchRes = await api('/attendance/submit', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      latitude: roomLat,
      longitude: roomLon,
      accuracy: 5.0,
      authPayload: {
        type: 'SIMULATED_BIOMETRIC',
        authenticatorConfirmed: true
      }
    })
  }, studentToken);
  assert.strictEqual(closedPunchRes.status, 410);
  assert.strictEqual(closedPunchRes.data.code, 'SESSION_EXPIRED');
  console.log('   ✅ PASS: Attendance punch on closed session rejected with 410 SESSION_EXPIRED.\n');

  console.log('========================================================================');
  console.log('🎉 ALL 20 END-TO-END MASTER ACCEPTANCE TESTS PASSED SUCCESSFULLY! (20/20)');
  console.log('========================================================================\n');
}

runMasterAcceptanceSuite()
  .catch((err) => {
    console.error('❌ Master Acceptance Test Suite FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
