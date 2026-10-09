import { api } from './client';
import type {
  BoardingStatus,
  Bus,
  BusLocation,
  BusRequest,
  BusTrip,
  Driver,
  DriverHome,
  DriverStudentResult,
  LocationFix,
  MyChildTrip,
  NotBoardedReason,
  TripHistoryPage,
  TripDirection,
} from './types';

const BASE = '/api/v1/transport';

// ---- admin

export function listBuses(schoolId: string) {
  return api.get<Bus[]>(`${BASE}/buses`, schoolId);
}

export function createBus(schoolId: string, req: BusRequest) {
  return api.post<Bus>(`${BASE}/buses`, req, schoolId);
}

export function updateBus(schoolId: string, id: string, req: BusRequest) {
  return api.put<Bus>(`${BASE}/buses/${id}`, req, schoolId);
}

export function listDrivers(schoolId: string) {
  return api.get<Driver[]>(`${BASE}/drivers`, schoolId);
}

export function createDriver(schoolId: string, req: { name: string; phone: string }) {
  return api.post<Driver>(`${BASE}/drivers`, req, schoolId);
}

/** A day's trips (yyyy-mm-dd); today when omitted. */
export function listTrips(schoolId: string, date?: string) {
  return api.get<BusTrip[]>(`${BASE}/trips${date ? `?date=${date}` : ''}`, schoolId);
}

// ---- driver (and the trip's driver or an admin)

export function getDriverHome(schoolId: string) {
  return api.get<DriverHome>(`${BASE}/me`, schoolId);
}

/** The driver's own trips, newest first. */
export function getMyPastTrips(schoolId: string, page: number) {
  return api.get<TripHistoryPage>(`${BASE}/me/trips?page=${page}&size=20`, schoolId);
}

export function searchStudentsForBus(schoolId: string, q: string) {
  return api.get<DriverStudentResult[]>(`${BASE}/students/search?q=${encodeURIComponent(q)}`, schoolId);
}

export function startTrip(schoolId: string, busId: string, direction: TripDirection, morningTripIds?: string[]) {
  return api.post<BusTrip>(`${BASE}/trips`, { busId, direction, morningTripIds }, schoolId);
}

export function getTrip(schoolId: string, tripId: string) {
  return api.get<BusTrip>(`${BASE}/trips/${tripId}`, schoolId);
}

export function markStudent(
  schoolId: string,
  tripId: string,
  studentId: string,
  mark: { status: BoardingStatus; reason?: NotBoardedReason; note?: string }
) {
  return api.put<BusTrip>(`${BASE}/trips/${tripId}/students/${studentId}`, mark, schoolId);
}

export function unmarkStudent(schoolId: string, tripId: string, studentId: string) {
  return api.delete<BusTrip>(`${BASE}/trips/${tripId}/students/${studentId}`, schoolId);
}

/** Trip home: the child got off at their stop - the family is told at once. */
export function dropStudent(schoolId: string, tripId: string, studentId: string) {
  return api.post<BusTrip>(`${BASE}/trips/${tripId}/students/${studentId}/drop`, undefined, schoolId);
}

export function undoDrop(schoolId: string, tripId: string, studentId: string) {
  return api.delete<BusTrip>(`${BASE}/trips/${tripId}/students/${studentId}/drop`, schoolId);
}

export function startReturnTrip(schoolId: string, tripId: string) {
  return api.post<BusTrip>(`${BASE}/trips/${tripId}/start`, undefined, schoolId);
}

export function endTrip(schoolId: string, tripId: string) {
  return api.post<BusTrip>(`${BASE}/trips/${tripId}/end`, undefined, schoolId);
}

export function cancelTrip(schoolId: string, tripId: string) {
  return api.delete<null>(`${BASE}/trips/${tripId}`, schoolId);
}

export function postLocations(schoolId: string, tripId: string, points: LocationFix[]) {
  return api.post<BusLocation | null>(`${BASE}/trips/${tripId}/locations`, { points }, schoolId);
}

// ---- families

export function getMyChildrenTrips(schoolId: string) {
  return api.get<MyChildTrip[]>(`${BASE}/my-trips`, schoolId);
}

export function getTripLocation(schoolId: string, tripId: string) {
  return api.get<BusLocation | null>(`${BASE}/trips/${tripId}/location`, schoolId);
}
