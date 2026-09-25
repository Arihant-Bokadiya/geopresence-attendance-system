/**
 * High-Precision Fresh Geolocation Acquisition Utility
 * 
 * Ensures fresh, high-accuracy GPS coordinates are obtained from device GNSS hardware,
 * actively discarding stale cached positions and refining signal lock.
 */

export interface FreshPositionResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export function acquireFreshHighAccuracyPosition(options?: {
  timeoutMs?: number;
  desiredAccuracyMeters?: number;
}): Promise<FreshPositionResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return reject(new Error('Geolocation is not supported by your device browser.'));
    }

    const timeoutMs = options?.timeoutMs || 12000;
    const desiredAccuracy = options?.desiredAccuracyMeters || 15.0;

    let bestReading: FreshPositionResult | null = null;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      cleanup();
      if (bestReading) {
        resolve(bestReading);
      } else {
        const timeoutError: any = new Error('GPS location request timed out. Please ensure high-accuracy device location is enabled and try again.');
        timeoutError.code = 3;
        reject(timeoutError);
      }
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const reading: FreshPositionResult = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy !== undefined ? pos.coords.accuracy : 10.0,
            timestamp: pos.timestamp || Date.now()
          };

          if (!bestReading || reading.accuracy < bestReading.accuracy) {
            bestReading = reading;
          }

          // If we achieved strong accuracy (e.g. <= 15m), finish immediately
          if (reading.accuracy <= desiredAccuracy) {
            cleanup();
            resolve(reading);
          }
        },
        (err) => {
          if (bestReading) {
            cleanup();
            resolve(bestReading);
            return;
          }
          cleanup();
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0
        }
      );
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}
