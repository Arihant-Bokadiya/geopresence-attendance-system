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
  marginMeters: number; // Positive if inside, negative if outside
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

  const R = 6371000; // Mean Earth radius in meters
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
  allowedRadiusMeters: number
): GeofenceCheckResult {
  const distanceMeters = calculateHaversineDistanceMeters(studentCoord, classroomCoord);
  const isInside = distanceMeters <= allowedRadiusMeters;
  const marginMeters = Math.round((allowedRadiusMeters - distanceMeters) * 100) / 100;

  return {
    distanceMeters,
    isInside,
    allowedRadiusMeters,
    marginMeters
  };
}
