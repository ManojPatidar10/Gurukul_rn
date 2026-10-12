import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Room } from '../api/rooms';
import { colors, radius, spacing } from '../theme/colors';
import { roomPickerOptions } from '../utils/rooms';

interface Props {
  rooms: Room[];
  /** The chosen room, or null for the first chip ("No room" unless `noneLabel` says otherwise). */
  selectedId: string | null;
  onSelect: (roomId: string | null) => void;
  /** The first chip's words: "No room" in the editor, "Same room" for a substitution. */
  noneLabel?: string;
  /** Shown as a link when the school has no rooms in use yet. */
  onManageRooms?: () => void;
}

/**
 * Chips for the rooms in use, plus a "no room" chip. A room taken out of use is hidden unless it
 * is the one already chosen, so re-saving a period keeps it.
 */
export function RoomPicker({ rooms, selectedId, onSelect, noneLabel, onManageRooms }: Props) {
  const { t } = useTranslation();
  const options = roomPickerOptions(rooms, selectedId);

  const chip = (id: string | null, label: string) => {
    const active = selectedId === id;
    return (
      <Pressable
        key={id ?? 'none'}
        onPress={() => onSelect(id)}
        style={[styles.chip, active && styles.chipActive]}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.chips}>
        {chip(null, noneLabel ?? t('timetable.editor.noRoom'))}
        {options.map((room) => chip(room.id, room.active ? room.name : `${room.name} (${t('timetable.rooms.inactive')})`))}
      </View>
      {options.length === 0 && onManageRooms && (
        <Pressable onPress={onManageRooms} accessibilityRole="link">
          <Text style={styles.link}>{t('timetable.editor.manageRooms')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  link: { color: colors.primary, fontWeight: '700', marginBottom: spacing.sm },
});
