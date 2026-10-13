import { api } from './client';

/** A classroom or lab the timetable can put a period in. Rooms are never deleted, only taken out of use. */
export interface Room {
  id: string;
  name: string;
  /** Seats; null when not set. */
  capacity: number | null;
  /** False once taken out of use: it stays on the periods that have it, but can't be picked for new ones. */
  active: boolean;
}

export interface RoomRequest {
  name: string;
  /** 1..1000; null clears it. */
  capacity: number | null;
  /** Ignored when adding a room. On a save, null or left out keeps the current value; true puts it back in use. */
  active?: boolean | null;
}

const BASE = '/api/v1/rooms';

/** Sorted by name. Admin and teachers. */
export function listRooms(schoolId: string, includeInactive = false) {
  return api.get<Room[]>(includeInactive ? `${BASE}?includeInactive=true` : BASE, schoolId);
}

/** Admin. Rejects with 409 ROOM_NAME_TAKEN when another room has the name. */
export function createRoom(schoolId: string, req: RoomRequest) {
  return api.post<Room>(BASE, req, schoolId);
}

export function updateRoom(schoolId: string, roomId: string, req: RoomRequest) {
  return api.put<Room>(`${BASE}/${roomId}`, req, schoolId);
}

/** Admin: takes the room out of use (it is kept, not deleted). */
export function deactivateRoom(schoolId: string, roomId: string) {
  return api.delete<Room>(`${BASE}/${roomId}`, schoolId);
}
