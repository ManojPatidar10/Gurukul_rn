import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getStaffAttendanceRoster, markStaffAttendance } from '../../api/staffAttendance';
import type { AttendanceMethod, AttendanceStatus, StaffAttendanceRoster } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DatePickerField, toIsoDate } from '../../components/DatePickerField';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { changedStaffAttendanceRecords } from '../../utils/staffAttendance';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StaffAttendance'>;

const methodEmoji: Record<AttendanceMethod, string> = {
  RFID: '📇',
  FINGERPRINT: '👆',
  FACE: '📷',
};

const statusVariant: Record<AttendanceStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  PRESENT: 'success',
  ABSENT: 'error',
  LATE: 'warning',
  HALF_DAY: 'neutral',
};

// The statuses the backend's AttendanceStatus accepts, in the order the edit chips show them.
const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];

const statusColor: Record<AttendanceStatus, string> = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.warning,
  HALF_DAY: colors.textSecondary,
};

// Local calendar day - toISOString() would give yesterday's date in India before 5:30am.
function toDateString(date: Date) {
  return toIsoDate(date);
}

function isToday(dateString: string) {
  return dateString === toDateString(new Date());
}

export function StaffAttendanceScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  // Marking and correcting staff is the admin's job (the backend allows only ADMIN to post it).
  const canEdit = session.role === 'ADMIN';
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [roster, setRoster] = useState<StaffAttendanceRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Edit-mode statuses by employee id, seeded from the roster; only rows that differ get saved.
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getStaffAttendanceRoster(schoolId, date)
      .then((next) => {
        setRoster(next);
        setDraft(seedDraft(next));
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, date]);

  const shiftDate = (deltaDays: number) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + deltaDays);
    setDate(toDateString(next));
  };

  const startEditing = () => {
    if (roster) setDraft(seedDraft(roster));
    setEditing(true);
  };

  const cancelEditing = () => {
    if (roster) setDraft(seedDraft(roster));
    setEditing(false);
  };

  const changes = roster ? changedStaffAttendanceRecords(roster.entries, draft) : [];

  const handleSave = async () => {
    if (changes.length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const next = await markStaffAttendance(schoolId, { date, records: changes });
      setRoster(next);
      setDraft(seedDraft(next));
      setEditing(false);
      showToast(t('staffAttendance.saved', { count: changes.length }), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const markedCount = roster?.entries.filter((e) => e.status != null).length ?? 0;
  const selfMarkedCount = roster?.entries.filter((e) => e.selfMarked).length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Staff Attendance" subtitle="Today's check-ins" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.dateNav}>
          <Pressable style={styles.dateNavButton} onPress={() => shiftDate(-1)}>
            <Text style={styles.dateNavButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.dateText}>{isToday(date) ? `Today · ${date}` : date}</Text>
          <Pressable style={styles.dateNavButton} onPress={() => shiftDate(1)} disabled={isToday(date)}>
            <Text style={[styles.dateNavButtonText, isToday(date) && styles.dateNavButtonDisabled]}>›</Text>
          </Pressable>
        </View>

        {editing && (
          <DatePickerField
            label={t('staffAttendance.dateLabel')}
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
          />
        )}

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <ErrorNotice message={error} />}

        {roster && !loading && (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {markedCount}/{roster.entries.length}
                </Text>
                <Text style={styles.summaryLabel}>Marked</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{selfMarkedCount}</Text>
                <Text style={styles.summaryLabel}>Self check-in</Text>
              </View>
            </View>

            {canEdit && roster.entries.length > 0 && !editing && (
              <Pressable style={styles.editButton} onPress={startEditing}>
                <Text style={styles.editButtonText}>{t('staffAttendance.edit')}</Text>
              </Pressable>
            )}
            {editing && <Text style={styles.editHint}>{t('staffAttendance.editHint')}</Text>}

            {roster.entries.length === 0 && <Text style={styles.empty}>No staff records for this school yet.</Text>}
            {editing &&
              roster.entries.map((entry) => (
                <View key={entry.employeeId} style={styles.editRow}>
                  <Text style={styles.rowName}>{entry.employeeName}</Text>
                  <Text style={styles.rowMeta}>
                    {entry.designation}
                    {entry.selfMarked ? ' · 📍 self check-in' : ''}
                  </Text>
                  <View style={styles.statusRow}>
                    {STATUSES.map((status) => {
                      const selected = draft[entry.employeeId] === status;
                      return (
                        <Pressable
                          key={status}
                          style={[
                            styles.statusChip,
                            selected && { backgroundColor: statusColor[status], borderColor: statusColor[status] },
                          ]}
                          onPress={() => setDraft((prev) => ({ ...prev, [entry.employeeId]: status }))}
                        >
                          <Text style={[styles.statusChipText, selected && styles.statusChipTextSelected]}>
                            {t(`staffAttendance.statuses.${status}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            {editing && (
              <View style={styles.editActions}>
                <Pressable style={styles.cancelButton} onPress={cancelEditing} disabled={saving}>
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveButtonText}>
                    {saving
                      ? t('common.saving')
                      : changes.length > 0
                        ? t('staffAttendance.saveCount', { count: changes.length })
                        : t('common.done')}
                  </Text>
                </Pressable>
              </View>
            )}
            {!editing &&
              roster.entries.map((entry) => (
                <Pressable
                  key={entry.employeeId}
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('EmployeeAttendanceHistory', {
                      employee: { id: entry.employeeId, name: entry.employeeName },
                    })
                  }
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName}>{entry.employeeName}</Text>
                    <Text style={styles.rowMeta}>
                      {entry.designation}
                      {entry.selfMarked ? ' · 📍 self check-in' : ''}
                      {entry.method ? ` · ${methodEmoji[entry.method]} ${entry.method.toLowerCase()}` : ''}
                    </Text>
                  </View>
                  <StatusChip
                    label={entry.status ? entry.status.replace('_', ' ') : 'Not marked'}
                    variant={entry.status ? statusVariant[entry.status] : 'neutral'}
                  />
                </Pressable>
              ))}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  dateNavButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  dateNavButtonText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  dateNavButtonDisabled: { color: colors.textMuted },
  dateText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  editButton: {
    alignSelf: 'flex-end',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  editButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  editHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  editRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  statusChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  statusChipTextSelected: { color: colors.white },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  cancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.textSecondary, fontWeight: '700' },
  saveButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  saveButtonText: { color: colors.white, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

function seedDraft(roster: StaffAttendanceRoster): Record<string, AttendanceStatus> {
  const draft: Record<string, AttendanceStatus> = {};
  roster.entries.forEach((entry) => {
    if (entry.status) draft[entry.employeeId] = entry.status;
  });
  return draft;
}
