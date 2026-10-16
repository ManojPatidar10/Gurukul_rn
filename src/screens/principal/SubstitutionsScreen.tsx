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
  autoAssign,
  getFreeTeachers,
  getTeacherTimetable,
  getUncoveredPeriods,
  listOverrides,
  updateOverride,
  type AutoAssignPlan,
  type FreeTeacher,
  type OverrideKind,
  type Timetable,
  type TimetableClash,
  type TimetableOverride,
  type TimetableSlot,
  type UncoveredPeriod,
} from '../../api/timetable';
import type { Employee } from '../../api/types';
import Dropdown from '../../components/Dropdown';
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
import { useOnReturn } from '../../hooks/useOnReturn';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  freshLists,
  groupUncoveredByPeriod,
  noRoomMeansRegular,
  overrideKindVariant,
  overrideSummary,
  overrideUpdateFromExisting,
  reloadAfterFailedWrite,
  sortFreeTeachersByMatch,
  uncoveredAction,
  uncoveredOverrideKind,
  type LoadedFor,
} from '../../utils/substitutions';
import { formatIsoDate, isIsoDate, isPastIso, slotBadge, todayIso } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Substitutions'>;

/** A period being given to a substitute, from "Needs a substitute" or another teacher's periods. */
interface CoverTarget {
  sectionId: string;
  sectionLabel: string;
  periodNumber: number;
  subjectName: string | null;
  /** The absent teacher's subject, so free-teachers can rank whoever teaches it first. */
  subjectId?: string | null;
  /** Set when changing the substitute of a cover that already exists. */
  overrideId: string | null;
  override: TimetableOverride | null;
  /** SUBSTITUTE for a new cover; an existing change keeps its own kind (it can be an extra class). */
  kind: OverrideKind;
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
  const [loadedFor, setLoadedFor] = useState<LoadedFor | null>(null);
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
        setLoadedFor({ date, teacherId: teacher?.id ?? null });
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

  // With rooms out of use, so a change that already has one keeps showing it (pickers hide the rest).
  // A failed reload keeps the rooms already shown.
  const loadRooms = useCallback(
    () =>
      listRooms(schoolId, true)
        .then(setRooms)
        .catch(() => {}),
    [schoolId]
  );

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Back from staff attendance (someone may have just been marked absent) or from Rooms (one may
  // have just been added for the Find substitute sheet).
  useOnReturn(() => {
    load();
    loadRooms();
  });

  const refresh = () => {
    setRefreshing(true);
    Promise.all([load(), loadRooms()]).finally(() => setRefreshing(false));
  };

  const afterWrite = async () => {
    setClashes([]);
    setError(null);
    showToast(t('timetable.subs.saved'), 'success');
    await load();
  };

  /**
   * A refused change. The Undo buttons can sit far below the error box at the top, so the message
   * is also shown as a toast. When the lists are out of date (the period already has a change, or
   * the change is gone) they are reloaded first, so the change the message talks about is on show.
   */
  const writeFailed = async (e: unknown) => {
    if (reloadAfterFailedWrite(e)) await load();
    const message = getErrorMessage(e);
    setClashes(clashesFromError(e) ?? []);
    setError(message);
    showToast(message, 'error');
  };

  const periodLabel = (periodNumber: number, startTime?: string | null) =>
    startTime ? `${t('timetable.periodN', { n: periodNumber })} · ${startTime}` : t('timetable.periodN', { n: periodNumber });

  // Auto-assign: the plan the server would carry out, shown before anything is saved.
  const [plan, setPlan] = useState<AutoAssignPlan | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const previewAutoAssign = async () => {
    setAutoAssigning(true);
    setError(null);
    try {
      setPlan(await autoAssign(schoolId, date, { dryRun: true }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAutoAssigning(false);
    }
  };

  const confirmAutoAssign = async () => {
    setAutoAssigning(true);
    setError(null);
    try {
      const done = await autoAssign(schoolId, date);
      setPlan(null);
      showToast(t('timetable.subs.autoAssignDone', { assigned: done.assigned, unassigned: done.unassigned }), 'success');
      await refresh();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAutoAssigning(false);
    }
  };

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
            await writeFailed(e);
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
            await writeFailed(e);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  // Only the lists loaded for the date (and teacher) now picked are shown: a stale row's buttons
  // would act on the new date. While the new date loads, the spinner shows instead.
  const fresh = freshLists(loadedFor, date, teacher?.id ?? null);
  const uncoveredShown = fresh.day ? uncovered : null;
  const overridesShown = fresh.day ? overrides : null;
  const teacherDayShown = fresh.teacher ? teacherDay : null;
  const locked = busy || loading;

  const coverFromUncovered = (entry: UncoveredPeriod): CoverTarget => {
    const existing = entry.overrideId ? (overridesShown?.find((o) => o.id === entry.overrideId) ?? null) : null;
    return {
      sectionId: entry.sectionId,
      sectionLabel: sectionLabel(entry),
      periodNumber: entry.periodNumber,
      subjectName: entry.subjectName,
      subjectId: entry.subjectId,
      overrideId: uncoveredAction(entry) === 'edit' ? entry.overrideId : null,
      override: existing,
      kind: existing?.kind ?? 'SUBSTITUTE',
    };
  };

  const coverFromSlot = (slot: TimetableSlot): CoverTarget => ({
    sectionId: slot.sectionId,
    sectionLabel: sectionLabel(slot),
    periodNumber: slot.periodNumber,
    subjectName: slot.subjectName,
    overrideId: null,
    override: null,
    kind: 'SUBSTITUTE',
  });

  const groups = groupUncoveredByPeriod(uncoveredShown ?? []);
  // Covers already made, kept under their period greyed out, so "period 1 is handled" is something the
  // admin can see rather than infer, and a wrong pick is one tap from undo.
  const coveredByPeriod = new Map<number, TimetableOverride[]>();
  for (const o of overridesShown ?? []) {
    if (o.kind === 'SUBSTITUTE') coveredByPeriod.set(o.periodNumber, [...(coveredByPeriod.get(o.periodNumber) ?? []), o]);
  }
  const periodRows = [...new Set([...groups.map((g) => g.periodNumber), ...coveredByPeriod.keys()])]
    .sort((a, b) => a - b)
    .map((periodNumber) => {
      const group = groups.find((g) => g.periodNumber === periodNumber) ?? null;
      const covered = coveredByPeriod.get(periodNumber) ?? [];
      return { periodNumber, group, covered, startTime: group?.startTime ?? covered[0]?.startTime ?? null, endTime: group?.endTime ?? covered[0]?.endTime ?? null };
    });
  const teacherSlots = [...(teacherDayShown?.slots ?? [])].sort((a, b) => a.periodNumber - b.periodNumber);
  const teacherPeriodStart = (n: number) => teacherDayShown?.periods.find((p) => p.periodNumber === n)?.startTime ?? null;

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
        {uncoveredShown !== null && periodRows.length === 0 && <Text style={styles.empty}>{t('timetable.subs.noneUncovered')}</Text>}
        {!past && groups.length > 0 && (
          <View style={styles.card}>
            <ActionButton label={t('timetable.subs.autoAssign')} disabled={locked || autoAssigning} onPress={previewAutoAssign} />
            <Text style={styles.hint}>{t('timetable.subs.autoAssignHint')}</Text>
          </View>
        )}
        {periodRows.map((row) => (
          <View key={row.periodNumber} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {periodLabel(row.periodNumber, row.startTime)}
                {row.endTime ? `–${row.endTime}` : ''}
              </Text>
              {row.group ? (
                <StatusChip label={t('timetable.subs.stillToCover', { count: row.group.entries.length })} variant="warning" />
              ) : (
                <StatusChip label={t('timetable.subs.allCovered')} variant="success" />
              )}
            </View>
            {(row.group?.entries ?? []).map((entry) => {
              // A change whose substitute is now away: a substitution or an extra class.
              const kind = uncoveredOverrideKind(entry, overridesShown);
              return (
                <View key={`${entry.sectionId}-${entry.periodNumber}`} style={styles.periodRow}>
                  <Text style={styles.periodTitle}>
                    {sectionLabel(entry)}
                    {entry.subjectName ? ` · ${entry.subjectName}` : ''}
                  </Text>
                  <View style={styles.chipRow}>
                    <Text style={styles.periodMeta}>{t('timetable.subs.away', { name: entry.teacherName })}</Text>
                    <StatusChip
                      label={entry.attendanceStatus === 'ABSENT' ? t('timetable.subs.absent') : t('timetable.subs.halfDay')}
                      variant={entry.attendanceStatus === 'ABSENT' ? 'error' : 'warning'}
                    />
                    {kind && <StatusChip label={t('timetable.subs.coverLost')} variant={overrideKindVariant(kind)} />}
                  </View>
                  {entry.roomName ? <Text style={styles.periodMeta}>{t('timetable.room', { name: entry.roomName })}</Text> : null}
                  {!past && (
                    <View style={styles.actions}>
                      <ActionButton
                        label={t('timetable.subs.findSubstitute')}
                        disabled={locked}
                        onPress={() => setTarget(coverFromUncovered(entry))}
                      />
                      {uncoveredAction(entry) === 'create' && (
                        <ActionButton
                          label={t('timetable.subs.cancelPeriod')}
                          danger
                          disabled={locked}
                          onPress={() => confirmCancel(entry.sectionId, sectionLabel(entry), entry.periodNumber)}
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            {row.covered.map((o) => (
              <View key={o.id ?? `${o.sectionId}-${o.periodNumber}`} style={[styles.periodRow, styles.coveredRow]}>
                <Text style={styles.periodTitle}>
                  {sectionLabel(o)}
                  {o.subjectName ? ` · ${o.subjectName}` : ''}
                </Text>
                <Text style={styles.periodMeta}>{t('timetable.subs.coveredBy', { name: o.substituteTeacherName ?? '' })}</Text>
                {!past && (
                  <View style={styles.actions}>
                    <ActionButton label={t('timetable.subs.undo')} danger disabled={locked} onPress={() => o.id && confirmUndo(o.id)} />
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
        {teacher && teacherDayShown && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{teacher.name}</Text>
            {teacherDayShown.schoolDay === false ? (
              <Text style={styles.empty}>
                {t('timetable.date.noSchool', { date: dateLabel })}
                {teacherDayShown.holidayName ? ` ${t('timetable.date.holiday', { name: teacherDayShown.holidayName })}` : ''}
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
                            disabled={locked}
                            onPress={() => slot.overrideId && confirmUndo(slot.overrideId)}
                          />
                        ) : (
                          <>
                            <ActionButton
                              label={t('timetable.subs.findSubstitute')}
                              disabled={locked}
                              onPress={() => setTarget(coverFromSlot(slot))}
                            />
                            <ActionButton
                              label={t('timetable.subs.cancelPeriod')}
                              danger
                              disabled={locked}
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
        {overridesShown !== null && overridesShown.length === 0 && <Text style={styles.empty}>{t('timetable.subs.noChanges')}</Text>}
        {overridesShown?.map((o) => {
          const summary = overrideSummary(o);
          const who =
            summary.kind === 'SUBSTITUTE' ? `${summary.from ?? ''} → ${summary.to ?? ''}` : (summary.from ?? summary.to ?? '');
          return (
            <View key={o.id ?? `${o.sectionId}-${o.periodNumber}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.periodTitle}>
                  {periodLabel(o.periodNumber, o.startTime)} · {sectionLabel(o)}
                </Text>
                <StatusChip label={t(`timetable.subs.kind.${o.kind}`)} variant={overrideKindVariant(o.kind)} />
              </View>
              {!!summary.subject && <Text style={styles.periodMeta}>{summary.subject}</Text>}
              {!!who && <Text style={styles.periodMeta}>{who}</Text>}
              {!!o.roomName && <Text style={styles.periodMeta}>{t('timetable.room', { name: o.roomName })}</Text>}
              {!!o.reason && <Text style={styles.reason}>{o.reason}</Text>}
              {!past && !!o.id && (
                <View style={styles.actions}>
                  <ActionButton label={t('timetable.subs.undo')} danger disabled={locked} onPress={() => o.id && confirmUndo(o.id)} />
                </View>
              )}
            </View>
          );
        })}
      </ScreenContainer>

      {plan && (

        <AutoAssignSheet

          plan={plan}

          busy={autoAssigning}

          onConfirm={confirmAutoAssign}

          onClose={() => setPlan(null)}

        />

      )}

      {target && (
        <CoverSheet
          schoolId={schoolId}
          date={date}
          dateLabel={dateLabel}
          target={target}
          rooms={rooms}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            afterWrite();
          }}
          onStale={(e) => {
            // The period already has a change (or it is gone): close, and show the lists as they are now.
            setTarget(null);
            writeFailed(e);
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
  /** The date as shown, so the admin can see which day the change is for. */
  dateLabel: string;
  target: CoverTarget;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
  /** The save failed because the screen's lists are out of date (see reloadAfterFailedWrite). */
  onStale: (e: unknown) => void;
  onManageRooms: () => void;
}

/** "Find substitute": the teachers free in that period, a room, a reason, and Save. */
function CoverSheet({ schoolId, date, dateLabel, target, rooms, onClose, onSaved, onStale, onManageRooms }: CoverSheetProps) {
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
    getFreeTeachers(schoolId, date, target.periodNumber, target.sectionId, target.subjectId)
      .then((rows) => setTeachers(sortFreeTeachersByMatch(rows)))
      .catch((e) => {
        setTeachers([]);
        setError(getErrorMessage(e));
      });
  }, [schoolId, date, target.periodNumber, target.sectionId, target.subjectId]);

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
      if (reloadAfterFailedWrite(e)) {
        onStale(e);
        return;
      }
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
              {[dateLabel, target.sectionLabel, t('timetable.periodN', { n: target.periodNumber }), target.subjectName]
                .filter(Boolean)
                .join(' · ')}
            </Text>

            {teachers === null && <ActivityIndicator color={colors.primary} style={styles.loading} />}
            {teachers?.length === 0 && !error && <Text style={styles.empty}>{t('timetable.subs.noFreeTeachers')}</Text>}
            {teachers && teachers.length > 0 && (
              <Dropdown
                label={t('timetable.subs.substitute')}
                value={selected ?? ''}
                placeholder={t('timetable.subs.pickSubstitute')}
                required
                onSelect={setSelected}
                options={teachers.map((teacher) => ({
                  value: teacher.teacherId,
                  // Ranked by the server; the label says why: "Anil Verma — teaches Maths to Grade 8 - B · 3 periods today"
                  label: [
                    teacher.name,
                    `${t(`timetable.subs.match.${teacher.match ?? 'FREE'}`, {
                      subject: target.subjectName ?? '',
                      section: target.sectionLabel,
                    })} · ${t('timetable.subs.periodsThatDay', { count: teacher.periodsThatDay })}${
                      teacher.attendanceStatus === 'HALF_DAY' ? ` · ${t('timetable.subs.halfDay')}` : ''
                    }`,
                  ].join(' — '),
                }))}
              />
            )}

            <Text style={[styles.fieldLabel, styles.spaced]}>{t('timetable.editor.room')}</Text>
            <RoomPicker
              rooms={rooms}
              selectedId={roomId}
              onSelect={setRoomId}
              noneLabel={noRoomMeansRegular(target.kind) ? t('timetable.subs.sameRoom') : undefined}
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

/** Auto-assign's preview: who gets which class, and which periods nobody was free for, then Confirm. */
function AutoAssignSheet({
  plan,
  busy,
  onConfirm,
  onClose,
}: {
  plan: AutoAssignPlan;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sheetBottom = useBottomInset(spacing.lg);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>
              {plan.assigned > 0
                ? t('timetable.subs.autoAssignPreviewTitle', { count: plan.assigned })
                : t('timetable.subs.autoAssignNothing')}
            </Text>
            {plan.assigned > 0 && <Text style={styles.sheetSubtitle}>{t('timetable.subs.autoAssignPreviewBody')}</Text>}
            {plan.items.map((item) => (
              <View key={`${item.sectionId}-${item.periodNumber}`} style={styles.periodRow}>
                <Text style={styles.periodTitle}>
                  {t('timetable.periodN', { n: item.periodNumber })}
                  {item.startTime ? ` · ${item.startTime}` : ''} · {sectionLabel(item)}
                  {item.subjectName ? ` · ${item.subjectName}` : ''}
                </Text>
                {item.substituteTeacherName ? (
                  <Text style={styles.periodMeta}>
                    → {item.substituteTeacherName}
                    {item.match
                      ? ` (${t(`timetable.subs.match.${item.match}`, { subject: item.subjectName ?? '', section: sectionLabel(item) })})`
                      : ''}
                  </Text>
                ) : (
                  <Text style={[styles.periodMeta, styles.warn]}>{t('timetable.subs.autoAssignNoneFree')}</Text>
                )}
              </View>
            ))}
            <View style={[styles.actions, styles.spaced]}>
              <ActionButton label={t('common.cancel')} disabled={busy} onPress={onClose} />
              {plan.assigned > 0 && (
                <ActionButton label={t('timetable.subs.autoAssignConfirm')} disabled={busy} onPress={onConfirm} />
              )}
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
  warn: { color: colors.warning, fontWeight: '700' },
  coveredRow: { opacity: 0.6 },
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
