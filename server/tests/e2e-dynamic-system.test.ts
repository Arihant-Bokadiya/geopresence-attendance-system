import { describe, it } from 'node:test';
import assert from 'node:assert';

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

describe('Complete Real Dynamic Attendance Platform E2E Verification', () => {
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  let createdDeptId: string;
  let createdClassroomId: string;
  let createdSubjectId: string;
  let createdDivisionId: string;
  let createdBatchId: string;
  let createdTeacherId: string;
  let createdStudentPrn = `124B1C${Math.floor(100 + Math.random() * 899)}`;
  let createdAssignmentId: string;
  let createdSessionId: string;
  let rawOtp: string;

  it('1. SUPER ADMIN authenticates and retrieves system statistics', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'admin@college.edu',
        password: 'Admin@123'
      })
    });

    assert.strictEqual(res.status, 200, `Admin login failed: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.user.role, 'ADMIN');
    adminToken = res.data.token;

    const statsRes = await api('/admin/stats', {}, adminToken);
    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.data.totalStudents >= 1);
    assert.ok(statsRes.data.totalTeachers >= 1);
    assert.ok(statsRes.data.totalClassrooms >= 1);
    console.log('   ✓ Super Admin logged in. Stats:', statsRes.data);
  });

  it('2. SUPER ADMIN creates dynamic Department', async () => {
    const res = await api('/admin/departments', {
      method: 'POST',
      body: JSON.stringify({
        code: `IT_${Date.now() % 10000}`,
        name: 'Information Technology'
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Create dept failed: ${JSON.stringify(res.data)}`);
    createdDeptId = res.data.department.id;
    console.log('   ✓ Dynamic Department created:', res.data.department.code);
  });

  it('3. SUPER ADMIN creates dynamic Classroom with GPS Geofence', async () => {
    const res = await api('/admin/classrooms', {
      method: 'POST',
      body: JSON.stringify({
        roomCode: `IT-LAB-${Date.now() % 1000}`,
        buildingName: 'Tech Tower',
        floorNumber: 3,
        latitude: 18.5204500,
        longitude: 73.8567500,
        allowedRadiusMeters: 25.0,
        isActive: true
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Create classroom failed: ${JSON.stringify(res.data)}`);
    createdClassroomId = res.data.classroom.id;
    assert.strictEqual(res.data.classroom.allowedRadiusMeters, 25.0);
    console.log('   ✓ Dynamic Classroom created:', res.data.classroom.roomCode, 'Radius:', res.data.classroom.allowedRadiusMeters);
  });

  it('4. SUPER ADMIN creates dynamic Curriculum Subject', async () => {
    const res = await api('/admin/subjects', {
      method: 'POST',
      body: JSON.stringify({
        code: `IT502_${Date.now() % 1000}`,
        name: 'Cloud Computing Architecture',
        departmentId: createdDeptId,
        semester: 5,
        credits: 4,
        isActive: true
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Create subject failed: ${JSON.stringify(res.data)}`);
    createdSubjectId = res.data.subject.id;
    console.log('   ✓ Dynamic Subject created:', res.data.subject.code, res.data.subject.name);
  });

  it('5. SUPER ADMIN creates dynamic Division with child Batches', async () => {
    const res = await api('/admin/divisions', {
      method: 'POST',
      body: JSON.stringify({
        name: `Division IT-${Date.now() % 1000}`,
        departmentId: createdDeptId,
        academicYear: '2024-2028',
        semester: 5,
        batchNames: ['IT-1', 'IT-2']
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Create division failed: ${JSON.stringify(res.data)}`);
    createdDivisionId = res.data.division.id;
    assert.strictEqual(res.data.division.batches.length, 2);
    createdBatchId = res.data.division.batches[0].id;
    console.log('   ✓ Dynamic Division & Batches created:', res.data.division.name, 'Batches:', res.data.division.batches.map((b: any) => b.name));
  });

  it('6. SUPER ADMIN registers dynamic Faculty Teacher', async () => {
    const empCode = `EMP-T${Date.now() % 10000}`;
    const email = `vikram.${Date.now() % 10000}@college.edu`;

    const res = await api('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: empCode,
        fullName: 'Prof. Vikram Deshmukh',
        email,
        departmentId: createdDeptId,
        phone: '+91 98220 12345',
        password: 'Password@123'
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Create teacher failed: ${JSON.stringify(res.data)}`);
    createdTeacherId = res.data.teacher.id;
    console.log('   ✓ Dynamic Teacher registered:', res.data.teacher.fullName, 'ID:', res.data.teacher.employeeId);
  });

  it('7. SUPER ADMIN registers dynamic Student with standard PRN format', async () => {
    const res = await api('/admin/students', {
      method: 'POST',
      body: JSON.stringify({
        prn: createdStudentPrn,
        fullName: 'Ananya Deshmukh',
        rollNumber: '23IT101',
        departmentId: createdDeptId,
        divisionId: createdDivisionId,
        batchId: createdBatchId,
        academicYear: '2024-2028',
        email: `ananya.${Date.now() % 10000}@college.edu`,
        password: 'Password@123'
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Create student failed: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.student.prn, createdStudentPrn);
    console.log('   ✓ Dynamic Student registered with PRN:', res.data.student.prn);
  });

  it('8. SUPER ADMIN allocates Teacher to Subject, Division, and Batch', async () => {
    const res = await api('/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({
        teacherId: createdTeacherId,
        subjectId: createdSubjectId,
        divisionId: createdDivisionId,
        batchId: createdBatchId
      })
    }, adminToken);

    assert.strictEqual(res.status, 201, `Allocate teacher failed: ${JSON.stringify(res.data)}`);
    createdAssignmentId = res.data.assignment.id;
    console.log('   ✓ Teacher allocated to Subject and Batch:', res.data.assignment.batch?.name);
  });

  it('9. TEACHER authenticates using Employee ID and starts Attendance Session', async () => {
    // Fetch teacher details to get employee ID
    const teachRes = await api('/admin/teachers', {}, adminToken);
    const teacher = teachRes.data.teachers.find((t: any) => t.id === createdTeacherId);

    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: teacher.employeeId,
        password: 'Password@123'
      })
    });

    assert.strictEqual(loginRes.status, 200, `Teacher login failed: ${JSON.stringify(loginRes.data)}`);
    assert.strictEqual(loginRes.data.user.role, 'TEACHER');
    teacherToken = loginRes.data.token;

    // Teacher creates attendance session
    const sessRes = await api('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: createdSubjectId,
        divisionId: createdDivisionId,
        batchId: createdBatchId,
        classroomId: createdClassroomId,
        durationSeconds: 300
      })
    }, teacherToken);

    assert.strictEqual(sessRes.status, 201, `Start session failed: ${JSON.stringify(sessRes.data)}`);
    createdSessionId = sessRes.data.session.id;
    rawOtp = sessRes.data.session.rawOtp;
    assert.ok(rawOtp && rawOtp.length === 6, 'OTP must be 6 digits');
    console.log('   ✓ Teacher started session:', createdSessionId, 'Generated OTP:', rawOtp);
  });

  it('10. STUDENT logs in via PRN and discovers eligible active attendance session', async () => {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: createdStudentPrn,
        password: 'Password@123'
      })
    });

    assert.strictEqual(loginRes.status, 200, `Student login failed: ${JSON.stringify(loginRes.data)}`);
    assert.strictEqual(loginRes.data.user.role, 'STUDENT');
    assert.strictEqual(loginRes.data.user.prn, createdStudentPrn);
    studentToken = loginRes.data.token;

    const activeRes = await api('/sessions/active/for-student', {}, studentToken);
    assert.strictEqual(activeRes.status, 200);
    assert.strictEqual(activeRes.data.hasActiveSession, true);
    assert.strictEqual(activeRes.data.session.id, createdSessionId);
    console.log('   ✓ Student discovered active session for their division & batch!');
  });

  it('11. STUDENT outside geofence is REJECTED with authoritative message', async () => {
    const res = await api('/attendance/verify-location', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: createdSessionId,
        latitude: 18.5350,
        longitude: 73.8700,
        accuracy: 10.0
      })
    }, studentToken);

    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.data.verified, false);
    assert.strictEqual(res.data.status, 'OUTSIDE_CLASSROOM');
    console.log('   ✓ Outside geofence rejected correctly:', res.data.message);
  });

  it('12. STUDENT submits wrong OTP -> REJECTED', async () => {
    const res = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: createdSessionId,
        otp: '000000',
        latitude: 18.5204500,
        longitude: 73.8567500,
        accuracy: 5.0
      })
    }, studentToken);

    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.data.status, 'REJECTED');
    assert.strictEqual(res.data.code, 'INVALID_OTP');
    console.log('   ✓ Invalid OTP rejected correctly:', res.data.message);
  });

  it('13. STUDENT submits valid GPS + valid OTP -> SUCCESS (PRESENT)', async () => {
    const res = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: createdSessionId,
        otp: rawOtp,
        latitude: 18.5204500,
        longitude: 73.8567500,
        accuracy: 5.0
      })
    }, studentToken);

    assert.strictEqual(res.status, 200, `Attendance submit failed: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.status, 'PRESENT');
    assert.ok(res.data.data.distanceMeters < 25.0);
    console.log('   ✓ Attendance verified and marked PRESENT! Distance:', res.data.data.distanceMeters, 'meters');
  });

  it('14. STUDENT duplicate submission attempt -> REJECTED', async () => {
    const res = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: createdSessionId,
        otp: rawOtp,
        latitude: 18.5204500,
        longitude: 73.8567500,
        accuracy: 5.0
      })
    }, studentToken);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.status, 'ALREADY_MARKED');
    console.log('   ✓ Duplicate attendance blocked with status 409 (ALREADY_MARKED)');
  });

  it('15. TEACHER inspects live roster -> student is PRESENT', async () => {
    const res = await api(`/sessions/${createdSessionId}`, {}, teacherToken);
    assert.strictEqual(res.status, 200);
    const presentRecord = res.data.session.records.find((r: any) => r.studentPrn === createdStudentPrn);
    assert.ok(presentRecord, 'Student must appear on live session records');
    assert.strictEqual(presentRecord.status, 'PRESENT');
    console.log('   ✓ Live Roster updated with student:', presentRecord.studentName, presentRecord.status, 'Distance:', presentRecord.distanceMeters);
  });

  it('16. TEACHER closes attendance session', async () => {
    const res = await api(`/sessions/${createdSessionId}/close`, { method: 'POST' }, teacherToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'CLOSED');
    console.log('   ✓ Session closed successfully with status CLOSED');
  });
});
