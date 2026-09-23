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

describe('3-Layer Verification Architecture & Teacher Demo E2E Test Suite', () => {
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  let sessionId: string;
  let testDeviceId: string;

  // Inside and Outside Coordinates for LH-401 (18.5204303, 73.8567437)
  const INSIDE_COORDS = { latitude: 18.52048, longitude: 73.85679, accuracy: 5.0 };
  const OUTSIDE_COORDS = { latitude: 18.52180, longitude: 73.85800, accuracy: 8.0 };

  it('1. SUPER ADMIN logs in and verifies Classroom Devices management', async () => {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin@college.edu', password: 'Admin@123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
    adminToken = loginRes.data.token;

    // Fetch existing devices
    const devicesRes = await api('/admin/devices', {}, adminToken);
    assert.strictEqual(devicesRes.status, 200);
    assert.ok(Array.isArray(devicesRes.data.devices), 'Devices must be an array');
    assert.ok(devicesRes.data.devices.length >= 1, 'At least 1 seeded device should exist');

    // Verify LH-401 device
    const lh401Device = devicesRes.data.devices.find((d: any) => d.deviceId === 'ESP32-LH401');
    assert.ok(lh401Device, 'ESP32-LH401 must be registered');
    assert.strictEqual(lh401Device.status, 'ACTIVE');

    // Create a temporary test device
    const classroomsRes = await api('/admin/classrooms', {}, adminToken);
    const testClassroom = classroomsRes.data.classrooms[0];

    const createDevRes = await api('/admin/devices', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `ESP32-TEST-${Date.now().toString().slice(-4)}`,
        classroomId: testClassroom.id,
        bleIdentifier: 'GEO-TEST-99',
        status: 'ACTIVE'
      })
    }, adminToken);

    // If already has device, might reject 400 unique classroom, which is valid 1-to-1 constraint
    if (createDevRes.status === 201) {
      testDeviceId = createDevRes.data.device.id;
      // Delete test device
      const delRes = await api(`/admin/devices/${testDeviceId}`, { method: 'DELETE' }, adminToken);
      assert.strictEqual(delRes.status, 200);
    }
  });

  it('2. TEACHER logs in and initiates an Attendance Session for LH-401', async () => {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'rahul.patil@college.edu', password: 'Password@123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Teacher login should succeed');
    teacherToken = loginRes.data.token;

    // Find Subject, Division, and Classroom LH-401
    const subRes = await api('/academic/subjects', {}, teacherToken);
    const divRes = await api('/academic/divisions', {}, teacherToken);
    const clsRes = await api('/classrooms', {}, teacherToken);

    const subject = subRes.data.subjects.find((s: any) => s.code === 'CS-402') || subRes.data.subjects[0];
    const division = divRes.data.divisions.find((d: any) => d.name.includes('B')) || divRes.data.divisions[0];
    const batch = division.batches?.find((b: any) => b.name === 'B1') || null;
    const classroom = clsRes.data.classrooms.find((c: any) => c.roomCode === 'LH-401') || clsRes.data.classrooms[0];

    // Create session (Zero OTP exposure in UI)
    const sessionRes = await api('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: subject.id,
        divisionId: division.id,
        batchId: batch?.id || null,
        classroomId: classroom.id,
        durationSeconds: 300
      })
    }, teacherToken);

    assert.strictEqual(sessionRes.status, 201, `Failed to create session: ${JSON.stringify(sessionRes.data)}`);
    assert.strictEqual(sessionRes.data.session.status, 'ACTIVE');
    assert.ok(sessionRes.data.session.classroom.device, 'Classroom must include linked ClassroomDevice');
    assert.strictEqual(sessionRes.data.session.classroom.device.deviceId, 'ESP32-LH401');

    sessionId = sessionRes.data.session.id;
  });

  it('3. LAYER 1: STUDENT authenticates using college PRN (124B1C088)', async () => {
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: '124B1C088', password: 'Password@123' })
    });

    assert.strictEqual(loginRes.status, 200, `Student login failed: ${JSON.stringify(loginRes.data)}`);
    assert.strictEqual(loginRes.data.user.role, 'STUDENT');
    assert.strictEqual(loginRes.data.user.prn, '124B1C088');
    studentToken = loginRes.data.token;
  });

  it('4. LAYER 2 (Classroom Presence): Rejected when student is OUTSIDE geofence', async () => {
    const presenceRes = await api('/attendance/verify-presence', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        latitude: OUTSIDE_COORDS.latitude,
        longitude: OUTSIDE_COORDS.longitude,
        accuracy: OUTSIDE_COORDS.accuracy,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          isSimulated: true
        }
      })
    }, studentToken);

    assert.strictEqual(presenceRes.status, 422, 'Outside geofence must return 422 Unprocessable Entity');
    assert.strictEqual(presenceRes.data.verified, false);
    assert.strictEqual(presenceRes.data.status, 'OUTSIDE_GEOFENCE');
    assert.ok(presenceRes.data.distanceMeters > 25.0, 'Distance must exceed classroom radius');
  });

  it('5. LAYER 2 (Classroom Presence): Verified when student is INSIDE geofence with active ESP32 device', async () => {
    const presenceRes = await api('/attendance/verify-presence', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        latitude: INSIDE_COORDS.latitude,
        longitude: INSIDE_COORDS.longitude,
        accuracy: INSIDE_COORDS.accuracy,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          isSimulated: true
        }
      })
    }, studentToken);

    assert.strictEqual(presenceRes.status, 200, 'Inside classroom presence check must succeed');
    assert.strictEqual(presenceRes.data.verified, true);
    assert.strictEqual(presenceRes.data.status, 'PRESENCE_VERIFIED');
    assert.ok(presenceRes.data.distanceMeters <= 25.0, 'Distance must be within allowed geofence');
    assert.ok(presenceRes.data.device, 'Must return verified classroom device');
    assert.strictEqual(presenceRes.data.device.deviceId, 'ESP32-LH401');
  });

  it('6. LAYER 3: Rejected if Phone Biometric Authentication fails', async () => {
    const punchRes = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        latitude: INSIDE_COORDS.latitude,
        longitude: INSIDE_COORDS.longitude,
        accuracy: INSIDE_COORDS.accuracy,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          isSimulated: true
        },
        authPayload: {
          biometricType: 'FINGERPRINT',
          authenticatorConfirmed: false, // Simulated user cancel / mismatch
          isSimulated: true
        }
      })
    }, studentToken);

    assert.strictEqual(punchRes.status, 401, 'Failed biometric authentication must return 401 Unauthorized');
    assert.strictEqual(punchRes.data.code, 'BIOMETRIC_FAILED');
  });

  it('7. COMPLETE 3-LAYER FLOW: Student marks attendance with PRN + Inside GPS + ESP32 + Phone Biometrics', async () => {
    const punchRes = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        latitude: INSIDE_COORDS.latitude,
        longitude: INSIDE_COORDS.longitude,
        accuracy: INSIDE_COORDS.accuracy,
        devicePayload: {
          deviceId: 'ESP32-LH401',
          bleIdentifier: 'GEO-LH401',
          isSimulated: true
        },
        authPayload: {
          biometricType: 'FINGERPRINT',
          authenticatorConfirmed: true,
          isSimulated: true,
          timestamp: new Date().toISOString()
        }
      })
    }, studentToken);

    assert.strictEqual(punchRes.status, 200, `Punch failed: ${JSON.stringify(punchRes.data)}`);
    assert.strictEqual(punchRes.data.status, 'PRESENT');
    assert.strictEqual(punchRes.data.data.prn, '124B1C088');
    assert.strictEqual(punchRes.data.data.deviceId, 'ESP32-LH401');
    assert.strictEqual(punchRes.data.data.verificationMode, 'GPS_DEVICE_BIOMETRIC');
    assert.ok(punchRes.data.data.receiptHash, 'Authoritative cryptographic receipt hash must be generated');
  });

  it('8. DUPLICATE CHECK: Submitting attendance again returns 409 ALREADY_MARKED', async () => {
    const punchRes = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        latitude: INSIDE_COORDS.latitude,
        longitude: INSIDE_COORDS.longitude,
        accuracy: INSIDE_COORDS.accuracy,
        devicePayload: { deviceId: 'ESP32-LH401', isSimulated: true },
        authPayload: { biometricType: 'FINGERPRINT', authenticatorConfirmed: true, isSimulated: true }
      })
    }, studentToken);

    assert.strictEqual(punchRes.status, 409, 'Duplicate punch must return 409 Conflict');
    assert.strictEqual(punchRes.data.code, 'ALREADY_MARKED');
  });

  it('9. TEACHER ROSTER: Live roster displays student marked PRESENT with 3 layers satisfied', async () => {
    const rosterRes = await api(`/reports/sessions/${sessionId}/roster`, {}, teacherToken);
    assert.strictEqual(rosterRes.status, 200);

    const studentRecord = rosterRes.data.roster.find((r: any) => r.prn === '124B1C088');
    assert.ok(studentRecord, 'Student 124B1C088 must appear on roster');
    assert.strictEqual(studentRecord.status, 'PRESENT');
    assert.strictEqual(studentRecord.verificationMode, 'GPS_DEVICE_BIOMETRIC');
    assert.ok(studentRecord.markedTimestamp, 'Timestamp must be present');
    assert.ok(studentRecord.locationDistanceMeters <= 25.0, 'Distance must be verified');

    // Session summary verified
    assert.ok(rosterRes.data.summary.presentCount >= 1);
  });

  it('10. TEACHER closes attendance session', async () => {
    const closeRes = await api(`/sessions/${sessionId}/close`, { method: 'POST' }, teacherToken);
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.data.status, 'CLOSED');

    // Attempting to submit after close returns 410 SESSION_EXPIRED
    const latePunch = await api('/attendance/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        latitude: INSIDE_COORDS.latitude,
        longitude: INSIDE_COORDS.longitude,
        devicePayload: { deviceId: 'ESP32-LH401', isSimulated: true },
        authPayload: { biometricType: 'FINGERPRINT', authenticatorConfirmed: true, isSimulated: true }
      })
    }, studentToken);

    assert.strictEqual(latePunch.status, 410, 'Punch on closed session must return 410 Gone');
  });
});
