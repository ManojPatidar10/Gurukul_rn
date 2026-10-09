import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getStoredSession } from '../api/authStorage';
import { ApiError, getAuthToken, setAuthSession } from '../api/client';
import { postLocations } from '../api/transport';
import type { LocationFix } from '../api/types';
import i18n from '../i18n';

/**
 * Shares the driver's position while a bus trip runs. Positions go into a queue on the phone and
 * are posted in batches, so a stretch with no signal just delays them - nothing is lost (up to
 * MAX_QUEUED fixes). On Android the updates come through a foreground service with a persistent
 * notification, which keeps them flowing with the screen off or another app open, and needs only
 * the "while using the app" location permission - not background location. If that can't start,
 * it falls back to updates while this screen is open.
 */

export const BUS_LOCATION_TASK = 'gurukul-bus-location';

const ACTIVE_TRIP_KEY = 'gurukul.busTracking.trip';
const QUEUE_KEY = 'gurukul.busTracking.queue';
const MAX_QUEUED = 2000;
const MAX_PER_REQUEST = 200;
/** How often queued fixes are posted - parents see the bus move about this often. */
const FLUSH_EVERY_MS = 8000;

interface ActiveTrip {
  schoolId: string;
  tripId: string;
}

export type TrackingMode = 'background' | 'foreground';

export interface TrackingStatus {
  tripId: string | null;
  mode: TrackingMode | null;
  pending: number;
  lastSentAt: number | null;
  /** The trip stopped accepting locations (ended elsewhere, say) - tracking has stopped itself. */
  stoppedReason: string | null;
}

let status: TrackingStatus = { tripId: null, mode: null, pending: 0, lastSentAt: null, stoppedReason: null };
const listeners = new Set<(s: TrackingStatus) => void>();
let foregroundWatch: Location.LocationSubscription | null = null;
let flushing: Promise<void> | null = null;
let lastFlushAt = 0;

function setStatus(patch: Partial<TrackingStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener(status));
}

export function onTrackingStatus(listener: (s: TrackingStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

function toFix(location: Location.LocationObject): LocationFix {
  const { latitude, longitude, heading, speed, accuracy } = location.coords;
  return {
    lat: latitude,
    lng: longitude,
    // -1 / null mean "unknown" on both platforms.
    heading: heading != null && heading >= 0 ? heading : null,
    speed: speed != null && speed >= 0 ? speed : null,
    accuracy: accuracy ?? null,
    at: new Date(location.timestamp).toISOString(),
  };
}

async function readQueue(): Promise<LocationFix[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as LocationFix[]) : [];
}

async function writeQueue(queue: LocationFix[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED)));
  setStatus({ pending: Math.min(queue.length, MAX_QUEUED) });
}

async function readActiveTrip(): Promise<ActiveTrip | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  return raw ? (JSON.parse(raw) as ActiveTrip) : null;
}

async function enqueue(locations: Location.LocationObject[]) {
  if (locations.length === 0) return;
  const queue = await readQueue();
  await writeQueue([...queue, ...locations.map(toFix)]);
}

/** The OS may wake this task with the app's screens gone - load the saved login if needed. */
async function ensureSignedIn() {
  if (getAuthToken()) return;
  const session = await getStoredSession().catch(() => null);
  if (session) setAuthSession(session);
}

/** A response meaning the trip will never accept these points (ended, not ours, logged out). */
function isPermanentFailure(error: unknown) {
  return error instanceof ApiError && error.status !== undefined && [400, 401, 403, 404].includes(error.status);
}

async function flushNow(): Promise<void> {
  const trip = await readActiveTrip();
  if (!trip) return;
  await ensureSignedIn();
  let queue = await readQueue();
  while (queue.length > 0) {
    const batch = queue.slice(0, MAX_PER_REQUEST);
    try {
      await postLocations(trip.schoolId, trip.tripId, batch);
    } catch (error) {
      if (isPermanentFailure(error)) {
        await stopBusTracking((error as Error).message);
      }
      return; // offline: keep the queue for the next try
    }
    queue = (await readQueue()).slice(batch.length);
    await writeQueue(queue);
    setStatus({ lastSentAt: Date.now() });
  }
}

export function flushBusLocations(force = false): Promise<void> {
  if (!force && Date.now() - lastFlushAt < FLUSH_EVERY_MS) return Promise.resolve();
  if (!flushing) {
    lastFlushAt = Date.now();
    flushing = flushNow().finally(() => (flushing = null));
  }
  return flushing;
}

// Must be defined when the JS bundle loads (imported from index.ts), so the OS can deliver
// locations even when it started the app just for this task.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(BUS_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  try {
    await enqueue(data.locations);
    await flushBusLocations();
  } catch (e) {
    console.warn('[bus] saving locations failed', e);
  }
});

/**
 * Starts sharing this phone's location for the trip. Throws if location permission is refused.
 * Must be called while the app is open (Android only starts a foreground service from the foreground).
 */
export async function startBusTracking(schoolId: string, tripId: string): Promise<TrackingMode> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error(i18n.t('transport.driver.locationPermissionNeeded'));
  }
  const current = await readActiveTrip();
  if (current?.tripId !== tripId) {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }
  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify({ schoolId, tripId } satisfies ActiveTrip));
  setStatus({ tripId, stoppedReason: null, pending: (await readQueue()).length });

  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(BUS_LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(BUS_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 0,
        activityType: Location.ActivityType.AutomotiveNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: i18n.t('transport.driver.trackingNotificationTitle'),
          notificationBody: i18n.t('transport.driver.trackingNotificationBody'),
          notificationColor: '#7C3AED',
          killServiceOnDestroy: false,
        },
      });
    }
    setStatus({ mode: 'background' });
    return 'background';
  } catch (e) {
    console.warn('[bus] background updates unavailable, sharing while the app is open', e);
  }

  foregroundWatch?.remove();
  foregroundWatch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
    (location) => {
      enqueue([location])
        .then(() => flushBusLocations())
        .catch(() => {});
    }
  );
  setStatus({ mode: 'foreground' });
  return 'foreground';
}

/** Stops sharing; whatever is still queued is sent first when possible. */
export async function stopBusTracking(stoppedReason: string | null = null): Promise<void> {
  foregroundWatch?.remove();
  foregroundWatch = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BUS_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BUS_LOCATION_TASK);
    }
  } catch (e) {
    console.warn('[bus] stopping location updates failed', e);
  }
  await AsyncStorage.multiRemove([ACTIVE_TRIP_KEY, QUEUE_KEY]);
  setStatus({ tripId: null, mode: null, pending: 0, stoppedReason });
}

/** Sends the last queued positions before the trip ends (best effort). */
export async function sendRemainingLocations(): Promise<void> {
  await flushBusLocations(true).catch(() => {});
}

/** The trip this phone is sharing location for, if any (survives an app restart). */
export async function trackedTripId(): Promise<string | null> {
  return (await readActiveTrip())?.tripId ?? null;
}
