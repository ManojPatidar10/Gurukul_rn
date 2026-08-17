import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';

interface DatePickerFieldProps {
  label: string;
  /** ISO date string ('YYYY-MM-DD'), or '' when nothing is selected yet. */
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}

/** Parses a 'YYYY-MM-DD' string as local midnight, not UTC - `new Date(str)` would shift the
 * displayed day by one for any timezone west of UTC. */
export function parseIsoDate(value: string): Date {
  return value ? new Date(`${value}T00:00:00`) : new Date();
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePickerField({ label, value, onChange, minimumDate, maximumDate, placeholder }: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setShow(true)}>
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value
            ? parseIsoDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
            : (placeholder ?? 'Select date')}
        </Text>
        <FontAwesome5 name="calendar-alt" size={15} color={colors.textMuted} />
      </Pressable>
      {show && (
        <DateTimePicker
          value={parseIsoDate(value)}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, date) => {
            setShow(false);
            if (date) onChange(toIsoDate(date));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  valueText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.textMuted,
  },
});
