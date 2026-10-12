import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { listRooms, type Room } from '../../api/rooms';
import {
  clashesFromError,
  createOverride,
  deleteOverride,
  getFreeTeachers,
  getTeacherTimetable,
  getUncoveredPeriods,
  listOverrides,
  updateOverride,
  type FreeTeacher,
  type Timetable,
  type TimetableClash,
  type TimetableOverride,
  type TimetableSlot,
  type UncoveredPeriod,
} from '../../api/timetable';
import type { Employee } from '../../api/types';
import { ClashList } from '../../components/ClashList';
import EmployeePicker from '../../components/EmployeePicker';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { RoomPicker } from '../../components/RoomPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { TimetableDateBar } from '../../components/TimetableDateBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  groupUncoveredByTeacher,
  overrideSummary,
  overrideUpdateFromExisting,
  sortFreeTeachers,
  uncoveredAction,
} from '../../utils/substitutions';
import { formatIsoDate, isIsoDate, isPastIso, slotBadge, todayIso } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Substitutions'>;

/** A period being given to a substitute, from "Needs a substitute" or another teacher's periods. */
interface CoverTarget {
  sectionId: string;
  sectionLabel: string;
  periodNumber: number;
  subjectName: string | null;
  /** Set when changing the substitute of a cover that already exists. */
  overrideId: string | null;
  override: TimetableOverride | null;
}

const isTeaching = (employee: Employee) => employee.employeeType !== 'NON_TEACHING';
const sectionLabel = (row: { className: string; section: string }) => `${row.className} - ${row.section}`;

/**
 * Admin: cover a date's periods when teachers are away. Lists the periods of teachers marked
 * Absent or Half day that nobody covers yet, lets the admin open any teacher's periods for the
 * date (leave can't be marked in advance in staff attendance, so a planned absence starts here),
 * and lists that date's changes, each of which can be undone. A substitute is picked from the
 * teachers free in that period, fewest periods that day first. Every change tells the teachers and
 * the class's students by push.
 */
export function SubstitutionsScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const today = todayIso();
  const paramDate = route.params?.date;
  const [date, setDate] = useState<string>(isIsoDate(paramDate) ? paramDate : today);
  const [uncovered, setUncovered] = useState<UncoveredPeriod[] | null>(null);
  const [overrides, setOverrides] = useState<TimetableOverride[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teacher, setTeacher] = useState<Employee | null>(null);
  const [teacherDay, setTeacherDay] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<CoverTarget | null>(null);
  const requestRef = useRef(0);
  const past = isPastIso(date, today);
  const dateLabel = formatIsoDate(date, i18n.language);

  const load = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    return Promise.all([
      getUncoveredPeriods(schoolId, date),
      listOverrides(schoolId, { from: date, to: date }),
      teacher ? getTeacherTimetable(schoolId, teacher.id, date) : Promise.resolve(null),
    ])
      .then(([uncoveredRows, overrideRows, day]) => {
        if (requestId !== requestRef.current) return;
        setUncovered(uncoveredRows);
        setOverrides(overrideRows);
        setTeacherDay(day);
        setError(null);
      })
      .catch((e) => {
        if (requestId === requestRef.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [schoolId, date, teacher]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // With rooms out of use, so a change that already has one keeps showing it (pickers hide the rest).
    listRooms(schoolId, true)
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [schoolId]);

  // Back from staff attendance: someone may have just been marked absent.
  useEffect(() => {
    let first = true;
    return navigation.addListener('focus', () => {
      if (first) {
        first = false;
        return;
      }
      load();
    });
  }, [load, navigation]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const afterWrite = async () => {
    setClashes([]);
    setError(null);
    showToast(t('timetable.subs.saved'), 'success');
    await load();
  };

  const periodLabel = (periodNumber: number, startTime?: string | null) =>
    startTime ? `${t('timetable.periodN', { n: periodNumber })} · ${startTime}` : t('timetable.periodN', { n: periodNumber });

  const confirmCancel = (sectionId: string, label: string, periodNumber: number) =>
    Alert.alert(t('timetable.subs.cancelTitle'), t('timetable.subs.cancelBody', { class: label, n: periodNumber, date: dateLabel }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('timetable.subs.cancelPeriod'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await createOverride(schoolId, { date, sectionId, periodNumber, kind: 'CANCELLED' });
            await afterWrite();
          } catch (e) {
            setClashes(clashesFromError(e) ?? []);
            setError(getErrorMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const confirmUndo = (overrideId: string) =>
    Alert.alert(t('timetable.subs.undoTitle'), t('timetable.subs.undoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('timetable.subs.undo'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteOverride(schoolId, overrideId);
            await afterWrite();
          } catch (e) {
            // Refused when the regular teacher or room is now busy elsewhere then.
            setClashes(clashesFromError(e) ?? []);
            setError(getErrorMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const coverFromUncovered = (entry: UncoveredPeriod): CoverTarget => ({
    sectionId: entry.sectionId,
    sectionLabel: sectionLabel(entry),
    periodNumber: entry.periodNumber,
    subjectName: entry.subjectName,
    overrideId: uncoveredAction(entry) === 'edit' ? entry.overrideId : null,
    override: entry.overrideId ? (overrides?.find((o) => o.id === entry.overrideId) ?? null) : null,
  });

  const coverFromSlot = (slot: TimetableSlot): CoverTarget => ({
    sectionId: slot.sectionId,
    sectionLabel: sectionLabel(slot),
    periodNumber: slot.periodNumber,
    subjectName: slot.subjectName,
    overrideId: null,
    override: null,
  });

  const groups = groupUncoveredByTeacher(uncovered ?? []);
  const teacherSlots = [...(teacherDay?.slots ?? [])].sort((a, b) => a.periodNumber - b.periodNumber);
  const teacherPeriodStart = (n: number) => teacherDay?.periods.find((p) => p.periodNumber === n)?.startTime ?? null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('timetable.subs.title')} subtitle={t('timetable.subs.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <TimetableDateBar value={date} onChange={(value) => value && setDate(value)} minimumDate={today} />
        {past && <ErrorNotice message={t('timetable.subs.pastDate')} />}
        {error && <ErrorNotice message={error} />}
        <ClashList clashes={clashes} />
        {loading && !refreshing && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {/* Needs a substitute */}
        <Text style={styles.sectionTitle}>{t('timetable.subs.needsCover')}</Text>
        <Text style={styles.hint}>{t('timetable.subs.leaveHint')}</Text>
        {date === today && (
          <Pressable onPress={() => navigation.navigate('StaffAttendance')} accessibilityRole="link">
            <Text style={styles.link}>{t('timetable.subs.markLeave')}</Text>
          </Pressable>
        )}
        {uncovered !== null && groups.length === 0 && <Text style={styles.empty}>{t('timetable.subs.noneUncovered')}</Text>}
        {groups.map((group) => (
          <View key={group.teacherId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{group.teacherName}</Text>
              <StatusChip
                label={group.attendanceStatus === 'ABSENT' ? t('timetable.subs.absent') : t('timetable.subs.halfDay')}
                variant={group.attendanceStatus === 'ABSENT' ? 'error' : 'warning'}
              />
            </View>
            {group.periods.map((entry) => (
              <View key={`${entry.sectionId}-${entry.periodNumber}`} style={styles.periodRow}>
                <Text style={styles.periodTitle}>
                  {periodLabel(entry.periodNumber, entry.startTime)} · {sectionLabel(entry)}
                </Text>
                <Text style={styles.periodMeta}>
                  {[entry.subjectName, entry.roomName ? t('timetable.room', { name: entry.roomName }) : null].filter(Boolean).join(' · ')}
                </Text>
                {!!entry.overrideId && (
                  <View style={styles.chipRow}>
                    <StatusChip label={t('timetable.subs.kind.SUBSTITUTE')} variant="warning" />
                  </View>
                )}
                {!past && (
                  <View style={styles.actions}>
                    <ActionButton
                      label={t('timetable.subs.findSubstitute')}
                      disabled={busy}
                      onPress={() => setTarget(coverFromUncovered(entry))}
                    />
                    {uncoveredAction(entry) === 'create' && (
                      <ActionButton
                        label={t('timetable.subs.cancelPeriod')}
                        danger
                        disabled={busy}
                        onPress={() => confirmCancel(entry.sectionId, sectionLabel(entry), entry.periodNumber)}
                      />
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* Another teacher's periods */}
        <Text style={styles.sectionTitle}>{t('timetable.subs.anyTeacher')}</Text>
        <Text style={styles.hint}>{t('timetable.subs.anyTeacherHint')}</Text>
        <EmployeePicker
          schoolId={schoolId}
          selectedId={teacher?.id ?? null}
          filter={isTeaching}
          onSelect={(employee) => {
            setTeacherDay(null);
            setTeacher(employee);
          }}
        />
        {teacher && teacherDay && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{teacher.name}</Text>
            {teacherDay.schoolDay === false ? (
              <Text style={styles.empty}>
                {t('timetable.date.noSchool', { date: dateLabel })}
                {teacherDay.holidayName ? ` ${t('timetable.date.holiday', { name: teacherDay.holidayName })}` : ''}
              </Text>
            ) : teacherSlots.length === 0 ? (
              <Text style={styles.empty}>{t('timetable.my.nothingToday')}</Text>
            ) : (
              teacherSlots.map((slot) => {
                const badge = slotBadge(slot, teacher.id, { thirdPerson: true });
                return (
                  <View key={`${slot.sectionId}-${slot.periodNumber}-${slot.overrideId ?? 'regular'}`} style={styles.periodRow}>
                    <Text style={styles.periodTitle}>
                      {periodLabel(slot.periodNumber, teacherPeriodStart(slot.periodNumber))} · {sectionLabel(slot)}
                    </Text>
                    <Text style={styles.periodMeta}>
                      {[slot.subjectName, slot.roomName ? t('timetable.room', { name: slot.roomName }) : null].filter(Boolean).join(' · ')}
                    </Text>
                    {badge && (
                      <View style={styles.chipRow}>
                        <StatusChip
                          label={
                            badge.kind === 'cancelled' || badge.kind === 'extra'
                              ? t(`timetable.badge.${badge.kind}`)
                              : t(`timetable.badge.${badge.kind}`, { teacher: badge.teacher })
                          }
                          variant={badge.kind === 'cancelled' ? 'error' : 'warning'}
                        />
                      </View>
                    )}
                    {!past && (
                      <View style={styles.actions}>
                        {slot.overrideId ? (
                          <ActionButton
                            label={t('timetable.subs.undo')}
                            danger
                            disabled={busy}
                            onPress={() => slot.overrideId && confirmUndo(slot.overrideId)}
                          />
                        ) : (
                          <>
                            <ActionButton
                              label={t('timetable.subs.findSubstitute')}
                              disabled={busy}
                              onPress={() => setTarget(coverFromSlot(slot))}
                            />
                            <ActionButton
                              label={t('timetable.subs.cancelPeriod')}
                              danger
                              disabled={busy}
                              onPress={() => confirmCancel(slot.sectionId, sectionLabel(slot), slot.periodNumber)}
                            />
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Changes on this day */}
        <Text style={styles.sectionTitle}>{t('timetable.subs.changes')}</Text>
        {overrides !== null && overrides.length === 0 && <Text style={styles.empty}>{t('timetable.subs.noChanges')}</Text>}
        {overrides?.map((o) => {
          const summary = overrideSummary(o);
          const who =
            summary.kind === 'SUBSTITUTE' ? `${summary.from ?? ''} → ${summary.to ?? ''}` : (summary.from ?? summary.to ?? '');
          return (
            <View key={o.id ?? `${o.sectionId}-${o.periodNumber}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.periodTitle}>
                  {periodLabel(o.periodNumber, o.startTime)} · {sectionLabel(o)}
                </Text>
                <StatusChip
                  label={t(`timetable.subs.kind.${o.kind}`)}
                  variant={o.kind === 'CANCELLED' ? 'error' : o.kind === 'EXTRA' ? 'success' : 'warning'}
                />
              </View>
              {!!summary.subject && <Text style={styles.periodMeta}>{summary.subject}</Text>}
              {!!who && <Text style={styles.periodMeta}>{who}</Text>}
              {!!o.roomName && <Text style={styles.periodMeta}>{t('timetable.room', { name: o.roomName })}</Text>}
              {!!o.reason && <Text style={styles.reason}>{o.reason}</Text>}
              {!past && !!o.id && (
                <View style={styles.actions}>
                  <ActionButton label={t('timetable.subs.undo')} danger disabled={busy} onPress={() => o.id && confirmUndo(o.id)} />

                </View>
              )}
            </View>
          );
        })}
      </ScreenContainer>

      {target && (
        <CoverSheet
          schoolId={schoolId}
          date={date}
          target={target}
          rooms={rooms}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            afterWrite();
          }}
          onManageRooms={() => {
            setTarget(null);
            navigation.navigate('Rooms');
          }}
        />
      )}
    </View>
  );
}

function ActionButton({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.actionButton, danger && styles.actionDanger, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={[styles.actionText, danger && styles.actionDangerText]}>{label}</Text>
    </Pressable>
  );
}

interface CoverSheetProps {
  schoolId: string;
  date: string;
  target: CoverTarget;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
  onManageRooms: () => void;
}

/** "Find substitute": the teachers free in that period, a room, a reason, and Save. */
function CoverSheet({ schoolId, date, target, rooms, onClose, onSaved, onManageRooms }: CoverSheetProps) {
  const { t } = useTranslation();
  const sheetBottom = useBottomInset(spacing.lg);
  const [teachers, setTeachers] = useState<FreeTeacher[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(target.override?.roomId ?? null);
  const [reason, setReason] = useState(target.override?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTeachers = useCallback(() => {
    setTeachers(null);
    getFreeTeachers(schoolId, date, target.periodNumber, target.sectionId)
      .then((rows) => setTeachers(sortFreeTeachers(rows)))
      .catch((e) => {
        setTeachers([]);
        setError(getErrorMessage(e));
      });
  }, [schoolId, date, target.periodNumber, target.sectionId]);

  useEffect(loadTeachers, [loadTeachers]);

  const save = async () => {
    if (!selected) {
      setError(t('timetable.subs.pickTeacherFirst'));
      return;
    }
    setSaving(true);
    setError(null);
    setClashes([]);
    const trimmedReason = reason.trim() ? reason.trim() : null;
    try {
      if (target.overrideId) {
        const body = target.override
          ? overrideUpdateFromExisting(target.override, { substituteTeacherId: selected, roomId, reason: trimmedReason })
          : { substituteTeacherId: selected, subjectId: null, roomId, reason: trimmedReason };
        await updateOverride(schoolId, target.overrideId, body);
      } else {
        await createOverride(schoolId, {
          date,
          sectionId: target.sectionId,
          periodNumber: target.periodNumber,
          kind: 'SUBSTITUTE',
          substituteTeacherId: selected,
          roomId,
          reason: trimmedReason,
        });
      }
      onSaved();
    } catch (e) {
      const found = clashesFromError(e);
      if (found) {
        // Someone else's change got there first: show why, and who is free now.
        setClashes(found);
        setSelected(null);
        loadTeachers();
      }
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{t('timetable.subs.findSubstitute')}</Text>
            <Text style={styles.sheetSubtitle}>
              {[target.sectionLabel, t('timetable.periodN', { n: target.periodNumber }), target.subjectName].filter(Boolean).join(' · ')}
            </Text>

            <Text style={styles.fieldLabel}>{t('timetable.subs.freeTeachers', { n: target.periodNumber })}</Text>
            {teachers === null && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {teachers?.length === 0 && !error && <Text style={styles.empty}>{t('timetable.subs.noFreeTeachers')}</Text>}
            {teachers?.map((teacher) => {
              const active = selected === teacher.teacherId;
              return (
                <Pressable
                  key={teacher.teacherId}
                  style={[styles.option, active && styles.optionSelected]}
                  onPress={() => setSelected(teacher.teacherId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.optionTitle}>
                    {teacher.name}
                    {teacher.designation ? ` (${teacher.designation})` : ''}
                  </Text>
                  <Text style={styles.optionDetail}>{t('timetable.subs.periodsThatDay', { count: teacher.periodsThatDay })}</Text>
                  {(teacher.teachesSection || teacher.attendanceStatus === 'HALF_DAY') && (
                    <View style={styles.chipRow}>
                      {teacher.teachesSection && <StatusChip label={t('timetable.subs.teachesClass')} variant="success" />}
                      {teacher.attendanceStatus === 'HALF_DAY' && <StatusChip label={t('timetable.subs.halfDay')} variant="warning" />}
                    </View>
                  )}
                </Pressable>
              );
            })}

            <Text style={[styles.fieldLabel, styles.spaced]}>{t('timetable.editor.room')}</Text>
            <RoomPicker
              rooms={rooms}
              selectedId={roomId}
              onSelect={setRoomId}
              noneLabel={t('timetable.subs.sameRoom')}
              onManageRooms={onManageRooms}
            />

            <LabeledInput label={t('timetable.subs.reason')} value={reason} onChangeText={setReason} maxLength={200} />

            {error && <ErrorNotice message={error} />}
            <ClashList clashes={clashes} />

            <View style={styles.formButtons}>
              <Pressable style={styles.secondaryButton} onPress={close}>
                <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('timetable.subs.save')}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginVertical: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: '700', marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 14, marginVertical: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
  periodRow: { paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  periodTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  periodMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  reason: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  actionDanger: { backgroundColor: '#FDECEC' },
  actionDangerText: { color: colors.error },
  disabled: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  sheetSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  spaced: { marginTop: spacing.md },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  optionSelected: { backgroundColor: colors.primaryLight },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  optionDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  secondaryText: { color: colors.textSecondary, fontWeight: '800' },
  primaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
});
