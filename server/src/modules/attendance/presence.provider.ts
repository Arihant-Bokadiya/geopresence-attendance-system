import { evaluateGeofence, Coordinates } from '../../utils/haversine.js';
import { prisma } from '../../db.js';

export interface ClassroomPresenceCheckRequest {
  sessionId: string;
  classroomId: string;
  studentPrn: string;
  studentCoords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  devicePayload?: {
    deviceId?: string;
    bleIdentifier?: string;
    isSimulated?: boolean;
  };
}

export interface GpsVerificationDiagnostics {
  classroomLatitude: number;
  classroomLongitude: number;
  classroomStoredAccuracy: number | null;
  studentLatitude: number;
  studentLongitude: number;
  studentReportedAccuracy: number;
  calculatedDistanceMeters: number;
  configuredRadius: number;
  finalGeofenceResult: 'VERIFIED' | 'OUTSIDE_GEOFENCE' | 'ACCURACY_TOO_LOW';
}

export interface ClassroomPresenceResult {
  verified: boolean;
  gpsVerified: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  deviceVerified: boolean;
  device?: {
    id: string;
    deviceId: string;
    bleIdentifier: string;
    status: string;
    isSimulated: boolean;
  } | null;
  status: 'VERIFIED' | 'OUTSIDE_GEOFENCE' | 'DEVICE_INACTIVE' | 'DEVICE_NOT_FOUND' | 'ACCURACY_TOO_LOW';
  message: string;
  diagnostics: GpsVerificationDiagnostics;
}

/**
 * ClassroomPresenceProvider
 * Clean architectural abstraction combining:
 * 1. Physical GPS Geofence (Haversine distance <= classroom allowed radius with uncertainty)
 * 2. Classroom Device (ESP32 / BLE) Presence Verification
 */
export class ClassroomPresenceProvider {
  /**
   * Authoritatively evaluates presence inside the classroom attendance zone
   */
  public static async verifyPresence(
    request: ClassroomPresenceCheckRequest
  ): Promise<ClassroomPresenceResult> {
    const { classroomId, studentCoords, devicePayload } = request;

    // 1. Fetch Classroom and linked ClassroomDevice from Database
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { device: true }
    });

    if (!classroom) {
      throw new Error(`Classroom ${classroomId} not found`);
    }

    // 2. Authoritative GPS Geofence Check
    const classroomCoords: Coordinates = {
      latitude: classroom.latitude,
      longitude: classroom.longitude
    };

    const studentGeocoords: Coordinates = {
      latitude: studentCoords.latitude,
      longitude: studentCoords.longitude
    };

    const studentAccuracy = studentCoords.accuracy !== undefined ? studentCoords.accuracy : 10.0;

    const geofence = evaluateGeofence(
      studentGeocoords,
      classroomCoords,
      classroom.allowedRadiusMeters,
      studentAccuracy,
      classroom.locationAccuracyMeters
    );

    const diagnostics: GpsVerificationDiagnostics = {
      classroomLatitude: classroom.latitude,
      classroomLongitude: classroom.longitude,
      classroomStoredAccuracy: classroom.locationAccuracyMeters ?? null,
      studentLatitude: studentCoords.latitude,
      studentLongitude: studentCoords.longitude,
      studentReportedAccuracy: studentAccuracy,
      calculatedDistanceMeters: geofence.distanceMeters,
      configuredRadius: classroom.allowedRadiusMeters,
      finalGeofenceResult: geofence.isInside ? 'VERIFIED' : (geofence.status === 'ACCURACY_TOO_LOW' ? 'ACCURACY_TOO_LOW' : 'OUTSIDE_GEOFENCE')
    };

    // Development diagnostic logging with real database & device values
    console.log(`================ [GPS VERIFICATION DIAGNOSTIC] ================`);
    console.log(`Classroom Latitude:        ${diagnostics.classroomLatitude}`);
    console.log(`Classroom Longitude:       ${diagnostics.classroomLongitude}`);
    console.log(`Classroom Stored Accuracy: ${diagnostics.classroomStoredAccuracy ?? 'N/A'} m`);
    console.log(`Student Latitude:          ${diagnostics.studentLatitude}`);
    console.log(`Student Longitude:         ${diagnostics.studentLongitude}`);
    console.log(`Student Reported Accuracy: ${diagnostics.studentReportedAccuracy} m`);
    console.log(`Calculated Distance:       ${diagnostics.calculatedDistanceMeters} m`);
    console.log(`Configured Radius:         ${diagnostics.configuredRadius} m`);
    console.log(`Final Geofence Result:     ${diagnostics.finalGeofenceResult}`);
    console.log(`Message:                   ${geofence.message}`);
    console.log(`===============================================================`);

    // Check if accuracy is unacceptable
    if (!geofence.accuracyAcceptable) {
      return {
        verified: false,
        gpsVerified: false,
        distanceMeters: geofence.distanceMeters,
        allowedRadiusMeters: classroom.allowedRadiusMeters,
        deviceVerified: false,
        device: null,
        status: 'ACCURACY_TOO_LOW',
        message: geofence.message,
        diagnostics
      };
    }

    if (!geofence.isInside) {
      return {
        verified: false,
        gpsVerified: false,
        distanceMeters: geofence.distanceMeters,
        allowedRadiusMeters: classroom.allowedRadiusMeters,
        deviceVerified: false,
        device: classroom.device ? {
          id: classroom.device.id,
          deviceId: classroom.device.deviceId,
          bleIdentifier: classroom.device.bleIdentifier,
          status: classroom.device.status,
          isSimulated: false
        } : null,
        status: 'OUTSIDE_GEOFENCE',
        message: geofence.message,
        diagnostics
      };
    }

    // 3. Physical GPS Geofence verified!
    const classroomDevice = classroom.device;

    return {
      verified: true,
      gpsVerified: true,
      distanceMeters: geofence.distanceMeters,
      allowedRadiusMeters: classroom.allowedRadiusMeters,
      deviceVerified: Boolean(classroomDevice && classroomDevice.status === 'ACTIVE'),
      device: classroomDevice ? {
        id: classroomDevice.id,
        deviceId: classroomDevice.deviceId,
        bleIdentifier: classroomDevice.bleIdentifier,
        status: classroomDevice.status,
        isSimulated: false
      } : null,
      status: 'VERIFIED',
      message: geofence.message,
      diagnostics
    };
  }
}
