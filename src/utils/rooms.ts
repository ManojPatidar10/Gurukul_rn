import type { Room, RoomRequest } from '../api/rooms';

export const ROOM_NAME_MAX = 50;
export const ROOM_CAPACITY_MAX = 1000;

/** The Rooms screen's form, as typed. */
export interface RoomForm {
  name: string;
  /** Seats as typed; '' means not set. */
  capacity: string;
  active: boolean;
}

export type RoomFormError = 'nameRequired' | 'nameTooLong' | 'badCapacity';

export function roomToForm(room?: Room | null): RoomForm {
  return {
    name: room?.name ?? '',
    capacity: room?.capacity != null ? String(room.capacity) : '',
    active: room?.active ?? true,
  };
}

/** Mirrors the server: a name of at most 50 characters after trimming, and seats 1..1000 or empty. */
export function validateRoomForm(form: RoomForm): RoomFormError | null {
  const name = form.name.trim();
  if (!name) return 'nameRequired';
  if (name.length > ROOM_NAME_MAX) return 'nameTooLong';
  const capacity = form.capacity.trim();
  if (capacity) {
    if (!/^\d+$/.test(capacity)) return 'badCapacity';
    const seats = Number(capacity);
    if (seats < 1 || seats > ROOM_CAPACITY_MAX) return 'badCapacity';
  }
  return null;
}

/** The request for a valid form. A new room is always in use, so `active` is only sent on a save. */
export function roomFormToRequest(form: RoomForm, isNew: boolean): RoomRequest {
  const capacity = form.capacity.trim();
  return {
    name: form.name.trim(),
    capacity: capacity ? Number(capacity) : null,
    ...(isNew ? {} : { active: form.active }),
  };
}

// Ignoring case, and with numbers in order ("Room 2" before "Room 10").
const byName = (a: Room, b: Room) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

/** Rooms in use and out of use, each by name. */
export function splitRooms(rooms: Room[]): { active: Room[]; inactive: Room[] } {
  const sorted = [...rooms].sort(byName);
  return { active: sorted.filter((r) => r.active), inactive: sorted.filter((r) => !r.active) };
}

/**
 * The rooms a picker offers: those in use, by name. A room taken out of use is hidden - except the
 * one already chosen, so re-saving a period that has it keeps it (the server allows that).
 */
export function roomPickerOptions(rooms: Room[], selectedId: string | null | undefined): Room[] {
  const { active } = splitRooms(rooms);
  const selected = selectedId ? rooms.find((r) => r.id === selectedId && !r.active) : undefined;
  return selected ? [...active, selected] : active;
}
