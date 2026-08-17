import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { scheduleCall } from '../../api/calls';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useCallTargets, type CallTarget } from '../../hooks/useCallTargets';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ScheduleCall'>;

export function ScheduleCallScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const {
    targets,
    filteredTargets,
    localQuery,
    setLocalQuery,
    loading: loadingTargets,
    error: targetsError,
  } = useCallTargets();
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const singleFixedTarget = targets.length === 1 ? targets[0] : null;
  const isMultiPick = targets.length > 1;

  const effectiveSelectedIds = useMemo(
    () => (singleFixedTarget ? [singleFixedTarget.ownerId] : selectedIds),
    [singleFixedTarget, selectedIds]
  );

  // A scheduled call can only invite one owner type at a time (ScheduleCallRequest.inviteeOwnerType
  // is a single value for the whole batch) - a student's target list now mixes teachers and
  // classmates, so picking one of a different type than what's already selected starts a fresh
  // selection instead of silently mixing (and silently dropping) types in one request.
  const toggleTarget = (target: CallTarget) => {
    setSelectedIds((prev) => {
      if (prev.includes(target.ownerId)) return prev.filter((id) => id !== target.ownerId);
      const currentType = prev.length > 0 ? targets.find((t) => t.ownerId === prev[0])?.ownerType : null;
      if (currentType && currentType !== target.ownerType) return [target.ownerId];
      return [...prev, target.ownerId];
    });
  };

  const canSubmit = title.trim().length > 0 && effectiveSelectedIds.length > 0 && scheduledAt.getTime() > Date.now();

  const handleSubmit = async () => {
    if (!canSubmit || targets.length === 0) return;
    const inviteeOwnerType = targets.find((t) => t.ownerId === effectiveSelectedIds[0])?.ownerType ?? targets[0].ownerType;
    setSubmitting(true);
    setError(null);
    try {
      await scheduleCall(schoolId, {
        title: title.trim(),
        inviteeOwnerType,
        inviteeOwnerIds: effectiveSelectedIds,
        scheduledAt: scheduledAt.toISOString(),
      });
      navigation.replace('ScheduledCalls');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Schedule a call" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <LabeledInput label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Progress discussion" />

        <Text style={styles.sectionLabel}>Invite</Text>
        {loadingTargets && <ActivityIndicator color={colors.primary} />}
        {targetsError && <Text style={styles.error}>{targetsError}</Text>}
        {!loadingTargets && targets.length === 0 && !targetsError && (
          <Text style={styles.empty}>No one available to invite right now.</Text>
        )}
        {singleFixedTarget && <Text style={styles.fixedTarget}>{singleFixedTarget.name}</Text>}
        {isMultiPick && (
          <>
            <SearchBar value={localQuery} onChangeText={setLocalQuery} placeholder="Search by name…" />
            {filteredTargets.length === 0 && <Text style={styles.empty}>No match found.</Text>}
            <View style={styles.chips}>
              {filteredTargets.map((target) => {
                const selected = selectedIds.includes(target.ownerId);
                return (
                  <Pressable
                    key={target.ownerId}
                    onPress={() => toggleTarget(target)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{target.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>When</Text>
        <View style={styles.dateTimeRow}>
          <Pressable style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateTimeText}>{scheduledAt.toLocaleDateString()}</Text>
          </Pressable>
          <Pressable style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.dateTimeText}>
              {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) {
                const next = new Date(scheduledAt);
                next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                setScheduledAt(next);
              }
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="time"
            onChange={(_, date) => {
              setShowTimePicker(false);
              if (date) {
                const next = new Date(scheduledAt);
                next.setHours(date.getHours(), date.getMinutes());
                setScheduledAt(next);
              }
            }}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Scheduling…' : 'Schedule call'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.sm },
  fixedTarget: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dateTimeButton: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dateTimeText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  empty: { color: colors.textMuted, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
