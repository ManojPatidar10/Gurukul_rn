import type { Room } from '../api/rooms';
import { roomFormToRequest, roomPickerOptions, roomToForm, splitRooms, validateRoomForm } from '../utils/rooms';

const room = (id: string, name: string, active = true, capacity: number | null = null): Room => ({ id, name, active, capacity });

describe('validateRoomForm', () => {
  const form = (name: string, capacity = '') => ({ name, capacity, active: true });

  it('needs a name', () => {
    expect(validateRoomForm(form(''))).toBe('nameRequired');
    expect(validateRoomForm(form('   '))).toBe('nameRequired');
  });

  it('allows at most 50 characters after trimming', () => {
    expect(validateRoomForm(form('x'.repeat(50)))).toBeNull();
    expect(validateRoomForm(form(`  ${'x'.repeat(50)}  `))).toBeNull();
    expect(validateRoomForm(form('x'.repeat(51)))).toBe('nameTooLong');
  });

  it('takes seats from 1 to 1000, or none', () => {
    expect(validateRoomForm(form('Lab 1'))).toBeNull();
    expect(validateRoomForm(form('Lab 1', '  '))).toBeNull();
    expect(validateRoomForm(form('Lab 1', '1'))).toBeNull();
    expect(validateRoomForm(form('Lab 1', '1000'))).toBeNull();
    expect(validateRoomForm(form('Lab 1', '0'))).toBe('badCapacity');
    expect(validateRoomForm(form('Lab 1', '1001'))).toBe('badCapacity');
    expect(validateRoomForm(form('Lab 1', '-5'))).toBe('badCapacity');
    expect(validateRoomForm(form('Lab 1', '12.5'))).toBe('badCapacity');
    expect(validateRoomForm(form('Lab 1', 'forty'))).toBe('badCapacity');
  });
});

describe('roomFormToRequest / roomToForm', () => {
  it('trims the name and turns empty seats into null', () => {
    expect(roomFormToRequest({ name: ' Lab 1 ', capacity: '', active: true }, true)).toEqual({ name: 'Lab 1', capacity: null });
    expect(roomFormToRequest({ name: 'Lab 1', capacity: ' 40 ', active: true }, true)).toEqual({ name: 'Lab 1', capacity: 40 });
  });

  it('sends the in-use switch only when saving an existing room', () => {
    expect(roomFormToRequest({ name: 'Lab 1', capacity: '', active: false }, false)).toEqual({ name: 'Lab 1', capacity: null, active: false });
    expect(roomFormToRequest({ name: 'Lab 1', capacity: '', active: false }, true)).not.toHaveProperty('active');
  });

  it('fills the form from a room, or blank for a new one', () => {
    expect(roomToForm(room('r1', 'Lab 1', false, 40))).toEqual({ name: 'Lab 1', capacity: '40', active: false });
    expect(roomToForm(null)).toEqual({ name: '', capacity: '', active: true });
  });
});

describe('splitRooms / roomPickerOptions', () => {
  const rooms = [room('b', 'room 2'), room('a', 'Lab 1'), room('c', 'Art room', false), room('d', 'Room 10')];

  it('splits rooms in and out of use, each by name ignoring case', () => {
    const { active, inactive } = splitRooms(rooms);
    expect(active.map((r) => r.name)).toEqual(['Lab 1', 'room 2', 'Room 10']);
    expect(inactive.map((r) => r.name)).toEqual(['Art room']);
  });

  it('offers only rooms in use, plus a room out of use that is already chosen', () => {
    expect(roomPickerOptions(rooms, null).map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(roomPickerOptions(rooms, 'b').map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(roomPickerOptions(rooms, 'c').map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(roomPickerOptions(rooms, 'gone').map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(roomPickerOptions([], null)).toEqual([]);
  });
});
