/**
 * High-Precision Geodesic Distance Calculator using the Haversine Formula
 * 
 * Formula:
 *   Δφ = φ2 - φ1 (radians)
 *   Δλ = λ2 - λ1 (radians)
 *   a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
 *   c = 2 * atan2(√a, √(1−a))
 *   d = R * c
 * 
 * Where R = 6,371,000 meters (mean Earth radius)
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceCheckResult {
  distanceMeters: number;
  isInside: boolean;
  allowedRadiusMeters: number;
  marginMeters: number; // Positive if inside nominal, negative if outside nominal
  accuracyAcceptable: boolean;
  studentAccuracyMeters: number;
  uncertaintyAllowanceMeters: number;
  effectiveRadiusMeters: number;
  status: 'INSIDE_NOMINAL' | 'INSIDE_WITH_GPS_UNCERTAINTY' | 'OUTSIDE_GEOFENCE' | 'ACCURACY_TOO_LOW';
  message: string;
}

export function calculateHaversineDistanceMeters(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  if (
    coord1.latitude === coord2.latitude &&
    coord1.longitude === coord2.longitude
  ) {
    return 0;
  }

  const R = 6371000; // Mean Earth radius in meters (WGS-84 spherical approximation)
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRad(coord1.latitude);
  const lat2Rad = toRad(coord2.latitude);
  const dLatRad = toRad(coord2.latitude - coord1.latitude);
  const dLonRad = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 2 decimal places (centimeter precision)
  return Math.round(distance * 100) / 100;
}

export function evaluateGeofence(
  studentCoord: Coordinates,
  classroomCoord: Coordinates,
  allowedRadiusMeters: number,
  studentAccuracyMeters: number = 10.0,
  classroomAccuracyMeters?: number | null
): GeofenceCheckResult {
  const distanceMeters = calculateHaversineDistanceMeters(studentCoord, classroomCoord);
  const nominalMargin = Math.round((allowedRadiusMeters - distanceMeters) * 100) / 100;

  // Maximum acceptable uncertainty threshold for authoritative physical verification (60 meters)
  const MAX_ACCEPTABLE_ACCURACY_METERS = 60.0;
  const accuracyAcceptable = studentAccuracyMeters <= MAX_ACCEPTABLE_ACCURACY_METERS;

  if (!accuracyAcceptable) {
    return {
      distanceMeters,
      isInside: false,
      allowedRadiusMeters,
      marginMeters: nominalMargin,
      accuracyAcceptable: false,
      studentAccuracyMeters,
      uncertaintyAllowanceMeters: 0,
      effectiveRadiusMeters: allowedRadiusMeters,
      status: 'ACCURACY_TOO_LOW',
      message: `Location accuracy is too low (±${Math.round(studentAccuracyMeters)}m). Please enable high-accuracy GPS and retry.`
    };
  }

  // Case 1: Strictly inside the nominal classroom radius
  if (distanceMeters <= allowedRadiusMeters) {
    return {
      distanceMeters,
      isInside: true,
      allowedRadiusMeters,
      marginMeters: nominalMargin,
      accuracyAcceptable: true,
      studentAccuracyMeters,
      uncertaintyAllowanceMeters: 0,
      effectiveRadiusMeters: allowedRadiusMeters,
      status: 'INSIDE_NOMINAL',
      message: `Location verified within classroom geofence (${distanceMeters}m / ${allowedRadiusMeters}m).`
    };
  }

  // Case 2: Check whether device is within normal GPS measurement noise / uncertainty
  // Uncertainty allowance is strictly bounded to a fraction of the reported 95% confidence radius, capped at 6.0m
  const uncertaintyAllowanceMeters = Math.min(
    Math.round((studentAccuracyMeters * 0.25) * 100) / 100,
    6.0
  );
  const effectiveRadiusMeters = Math.round((allowedRadiusMeters + uncertaintyAllowanceMeters) * 100) / 100;

  if (distanceMeters <= effectiveRadiusMeters) {
    return {
      distanceMeters,
      isInside: true,
      allowedRadiusMeters,
      marginMeters: nominalMargin,
      accuracyAcceptable: true,
      studentAccuracyMeters,
      uncertaintyAllowanceMeters,
      effectiveRadiusMeters,
      status: 'INSIDE_WITH_GPS_UNCERTAINTY',
      message: `Location verified within classroom geofence (${distanceMeters}m, accounting for ±${studentAccuracyMeters}m GPS uncertainty).`
    };
  }

  // Case 3: Genuinely outside the classroom geofence
  return {
    distanceMeters,
    isInside: false,
    allowedRadiusMeters,
    marginMeters: nominalMargin,
    accuracyAcceptable: true,
    studentAccuracyMeters,
    uncertaintyAllowanceMeters,
    effectiveRadiusMeters,
    status: 'OUTSIDE_GEOFENCE',
    message: `You are outside the classroom attendance area (${distanceMeters}m from classroom, allowed: ${allowedRadiusMeters}m).`
  };
}
