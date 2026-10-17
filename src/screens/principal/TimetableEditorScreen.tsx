import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listRooms, type Room } from '../../api/rooms';
import { listSectionSubjects } from '../../api/sectionSubjects';
import {
  clashesFromError,
  clearTimetableCell,
  getSectionTimetable,
  notAssignedFromError,
  saveSectionTimetable,
  setTimetableCell,
  type DayOfWeek,
  type Period,
  type Timetable,
  type TimetableClash,
  type TimetableSlot,
} from '../../api/timetable';
import type { ClassSection, SubjectAssignment } from '../../api/types';
import { ClashList } from '../../components/ClashList';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import EmployeePicker from '../../components/EmployeePicker';
import { RoomPicker } from '../../components/RoomPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { TimetableDayTabs } from '../../components/TimetableDayTabs';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { useOnReturn } from '../../hooks/useOnReturn';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  cellEditMode,
  cellsToSlotRequests,
  clearCellAction,
  defaultDay,
  slotKey,
  slotsToCells,
  type CellAssignment,
} from '../../utils/timetable';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TimetableEditor'>;

const assignmentKey = (a: { subjectId: string; teacherId: string }) => `${a.subjectId}|${a.teacherId}`;

/** The period being edited in the bottom sheet, and what's picked for it so far. */
interface CellSheet {
  period: Period;
  subjectId: string | null;
  teacherId: string | null;
  roomId: string | null;
  /** Showing the subject and teacher pickers, for a pair the class doesn't have yet. */
  other: boolean;
  /** Names of a pair picked through the pickers, for the "Also assign?" question. */
  subjectName?: string;
  teacherName?: string;
}

/**
 * Admin-only weekly timetable editor for one class-section: day tabs, one row per period. Tapping
 * a row opens a sheet to pick one of the section's subject+teacher assignments (or any teacher and
 * subject - the app then offers to assign them) and a room. "Save this period" saves just that
 * period straight away; the server refuses clashes (the teacher or room is busy elsewhere then)
 * and they're listed in the sheet. After "Copy this day to every day" the edits are a draft
 * instead, and "Save timetable" sends the whole week.
 */
export function TimetableEditorScreen({ route, navigation }: Props) {
  const sheetBottom = useBottomInset(spacing.lg);
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [classSection, setClassSection] = useState<ClassSection | null>(route.params?.classSection ?? null);
  const [days, setDays] = useState<DayOfWeek[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [cells, setCells] = useState<Record<string, CellAssignment>>({});
  const [day, setDay] = useState<DayOfWeek>('MONDAY');
  const [sheet, setSheet] = useState<CellSheet | null>(null);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetClashes, setSheetClashes] = useState<TimetableClash[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [success, setSuccess] = useState(false);
  const mode = cellEditMode(dirty);

  const applyTimetable = (tt: Timetable) => {
    setDays(tt.days);
    setPeriods(tt.periods);
    setSlots(tt.slots);
    setCells(slotsToCells(tt.slots));
  };

  const load = useCallback(() => {
    if (!classSection) return;
    setLoading(true);
    setError(null);
    setClashes([]);
    setSuccess(false);
    Promise.all([
      getSectionTimetable(schoolId, classSection.id),
      listSectionSubjects(schoolId, classSection.id),
      // Rooms are optional: the editor works without them. Rooms out of use come too, so a period
      // that already has one keeps showing it (the picker hides them otherwise).
      listRooms(schoolId, true).catch(() => [] as Room[]),
    ])
      .then(([tt, subjects, roomList]) => {
        setDays(tt.days);
        setPeriods(tt.periods);
        setSlots(tt.slots);
        setCells(slotsToCells(tt.slots));
        setAssignments(subjects);
        setRooms(roomList);
        setDay((current) => (tt.days.includes(current) ? current : defaultDay(tt.days)));
        setDirty(false);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, classSection]);

  useEffect(load, [load]);

  // Coming back from the bell schedule, subject assignments or rooms: reload, unless there are
  // unsaved edits. Those are kept, and only the rooms are refreshed, so one just added can be picked.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useOnReturn(() => {
    if (!dirtyRef.current) {
      load();
      return;
    }
    listRooms(schoolId, true)
      .then(setRooms)
      .catch(() => {});
  });

  const assignmentByKey = useMemo(() => {
    const map = new Map<string, SubjectAssignment>();
    for (const a of assignments) map.set(assignmentKey(a), a);
    return map;
  }, [assignments]);

  // Names for every subject+teacher pair on show: the saved periods (which may use a pair that's no
  // longer assigned) and the class's assignments.
  const pairNames = useMemo(() => {
    const map = new Map<string, { subjectName: string; teacherName: string }>();
    for (const s of slots) map.set(assignmentKey(s), { subjectName: s.subjectName, teacherName: s.teacherName });
    for (const a of assignments) map.set(assignmentKey(a), { subjectName: a.subjectName, teacherName: a.teacherName });
    return map;
  }, [slots, assignments]);

  const roomNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of slots) if (s.roomId && s.roomName) map.set(s.roomId, s.roomName);
    for (const r of rooms) map.set(r.id, r.name);
    return map;
  }, [slots, rooms]);

  const clashKeys = useMemo(() => new Set(clashes.map((c) => slotKey(c.dayOfWeek, c.periodNumber))), [clashes]);

  const teachablePeriods = periods.filter((p) => !p.breakPeriod);
  const filledToday = teachablePeriods.filter((p) => cells[slotKey(day, p.periodNumber)]).length;

  const dayName = (d: DayOfWeek) => t(`timetable.days.${d}`);

  /** Draft mode only: changes the local week, saved later with "Save timetable". */
  const setDraftCell = (period: Period, value: CellAssignment | null) => {
    const key = slotKey(day, period.periodNumber);
    setCells((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setClashes((prev) => prev.filter((c) => slotKey(c.dayOfWeek, c.periodNumber) !== key));
    setDirty(true);
    setSuccess(false);
    setSheet(null);
  };

  const openSheet = (period: Period) => {
    const cell = cells[slotKey(day, period.periodNumber)];
    const names = cell ? pairNames.get(assignmentKey(cell)) : undefined;
    setSheet({
      period,
      subjectId: cell?.subjectId ?? null,
      teacherId: cell?.teacherId ?? null,
      roomId: cell?.roomId ?? null,
      other: !!cell && !assignmentByKey.has(assignmentKey(cell)) && mode === 'immediate',
      subjectName: names?.subjectName,
      teacherName: names?.teacherName,
    });
    setSheetError(null);
    setSheetClashes([]);
  };

  const closeSheet = () => {
    if (!sheetSaving) setSheet(null);
  };

  const saveSheet = async (current: CellSheet, assignIfMissing = false) => {
    if (!classSection) return;
    if (!current.subjectId || !current.teacherId) {
      setSheetError(t('timetable.editor.pickBoth'));
      return;
    }
    const value: CellAssignment = { subjectId: current.subjectId, teacherId: current.teacherId, roomId: current.roomId };
    if (mode === 'draft') {
      setDraftCell(current.period, value);
      return;
    }
    setSheetSaving(true);
    setSheetError(null);
    setSheetClashes([]);
    try {
      const result = await setTimetableCell(schoolId, classSection.id, day, current.period.periodNumber, {
        subjectId: value.subjectId,
        teacherId: value.teacherId,
        roomId: value.roomId ?? null,
        assignIfMissing,
      });
      applyTimetable(result.timetable);
      if (result.assignmentCreated) {
        listSectionSubjects(schoolId, classSection.id)
          .then(setAssignments)
          .catch(() => {});
      }
      setClashes([]);
      setSheet(null);
      showToast(t('timetable.editor.cellSaved'), 'success');
    } catch (e) {
      const notAssigned = notAssignedFromError(e);
      if (notAssigned && !assignIfMissing) {
        // Saving would otherwise work (the server checks clashes first), so offer to assign them.
        Alert.alert(
          t('timetable.editor.assignTitle'),
          t('timetable.editor.assignBody', {
            teacher: notAssigned.teacherName || current.teacherName || '',
            subject: notAssigned.subjectName || current.subjectName || '',
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('timetable.editor.assignYes'), onPress: () => saveSheet(current, true) },
          ]
        );
        return;
      }
      const found = clashesFromError(e);
      if (found) setSheetClashes(found);
      setSheetError(getErrorMessage(e));
    } finally {
      setSheetSaving(false);
    }
  };

  const clearSheet = (current: CellSheet) => {
    if (!classSection) return;
    const action = clearCellAction(mode, !!cells[slotKey(day, current.period.periodNumber)]);
    if (action === 'draft') {
      setDraftCell(current.period, null);
      return;
    }
    if (action === 'close') {
      setSheet(null);
      return;
    }
    // Deleted on the server straight away, with no undo: ask first.
    Alert.alert(
      t('timetable.editor.clearConfirm', { day: dayName(day), n: current.period.periodNumber }),
      t('timetable.editor.clearConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('timetable.editor.clearCell'), style: 'destructive', onPress: () => clearSaved(current) },
      ]
    );
  };

  const clearSaved = async (current: CellSheet) => {
    if (!classSection) return;
    setSheetSaving(true);
    setSheetError(null);
    setSheetClashes([]);
    try {
      const result = await clearTimetableCell(schoolId, classSection.id, day, current.period.periodNumber);
      applyTimetable(result.timetable);
      setSheet(null);
      showToast(t('timetable.editor.cellCleared'), 'success');
    } catch (e) {
      setSheetError(getErrorMessage(e));
    } finally {
      setSheetSaving(false);
    }
  };

  const copyDayToAll = () => {
    setCells((prev) => {
      const next = { ...prev };
      for (const other of days) {
        if (other === day) continue;
        for (const p of teachablePeriods) {
          const from = prev[slotKey(day, p.periodNumber)];
          const to = slotKey(other, p.periodNumber);
          if (from) next[to] = from;
          else delete next[to];
        }
      }
      return next;
    });
    setDirty(true);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!classSection) return;
    setSaving(true);
    setError(null);
    setClashes([]);
    setSuccess(false);
    try {
      const saved = await saveSectionTimetable(schoolId, classSection.id, cellsToSlotRequests(cells, days, periods));
      setSlots(saved.slots);
      setCells(slotsToCells(saved.slots));
      setDirty(false);
      setSuccess(true);
    } catch (e) {
      const found = clashesFromError(e);
      if (found) setClashes(found);
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const currentSheetKey = sheet ? assignmentKey({ subjectId: sheet.subjectId ?? '', teacherId: sheet.teacherId ?? '' }) : '';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('timetable.editor.title')}
        subtitle={classSection ? `${classSection.className} - ${classSection.section} (${classSection.academicYear})` : t('timetable.editor.subtitle')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        {!route.params?.classSection && (
          <View style={styles.pickerWrap}>
            <Text style={styles.fieldLabel}>{t('timetable.editor.pickSection')}</Text>
            <ClassSectionPicker
              schoolId={schoolId}
              selectedId={classSection?.id ?? null}
              onSelect={(cs) => {
                setClassSection(cs);
                setCells({});
                setSlots([]);
                setDirty(false);
              }}
            />
          </View>
        )}

        {/* The editor is one day at a time; this opens the same week laid out against the clock,
            which is where "when is this class free" is actually answerable. */}
        {!loading && classSection && periods.length > 0 && (
          <Pressable
            style={styles.weekLink}
            onPress={() => navigation.navigate('TimetableWeek', { classSection })}
            accessibilityRole="button"
          >
            <Text style={styles.weekLinkText}>{t('timetable.week.open')}</Text>
          </Pressable>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {!loading && error && <ErrorNotice message={error} />}
        {!loading && <ClashList clashes={clashes} title={t('timetable.editor.clashTitle')} />}

        {!loading && classSection && periods.length === 0 && !error && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('timetable.noPeriodsAdmin')}</Text>
            <Pressable style={styles.noticeButton} onPress={() => navigation.navigate('PeriodSetup')}>
              <Text style={styles.noticeButtonText}>{t('timetable.setUpPeriods')}</Text>
            </Pressable>
          </View>
        )}

        {!loading && classSection && periods.length > 0 && assignments.length === 0 && !error && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('timetable.editor.noAssignments')}</Text>
            <Pressable style={styles.noticeButton} onPress={() => navigation.navigate('SectionSubjectsList', { classSection })}>
              <Text style={styles.noticeButtonText}>{t('timetable.editor.assignSubjects')}</Text>
            </Pressable>
          </View>
        )}

        {!loading && classSection && periods.length > 0 && (
          <>
            <TimetableDayTabs days={days} selected={day} onSelect={setDay} />
            <View style={styles.dayMeta}>
              <Text style={styles.metaText}>
                {t('timetable.editor.filled', { count: filledToday, total: teachablePeriods.length })}
              </Text>
              {days.length > 1 && (
                <Pressable onPress={copyDayToAll}>
                  <Text style={styles.linkText}>{t('timetable.editor.copyToAll')}</Text>
                </Pressable>
              )}
            </View>

            {periods.map((period) => {
              const cell = cells[slotKey(day, period.periodNumber)];
              const names = cell ? pairNames.get(assignmentKey(cell)) : undefined;
              const roomName = cell?.roomId ? roomNames.get(cell.roomId) : undefined;
              const clashing = clashKeys.has(slotKey(day, period.periodNumber));
              return (
                <Pressable
                  key={period.periodNumber}
                  disabled={period.breakPeriod}
                  onPress={() => openSheet(period)}
                  style={[styles.row, period.breakPeriod && styles.breakRow, clashing && styles.clashRow]}
                >
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{period.startTime}</Text>
                    <Text style={styles.timeEnd}>{period.endTime}</Text>
                  </View>
                  <View style={styles.bodyCol}>
                    {period.breakPeriod ? (
                      <Text style={styles.breakText}>{period.label ?? t('timetable.break')}</Text>
                    ) : cell ? (
                      <>
                        <Text style={styles.subject}>{names?.subjectName ?? t('common.emptyValue')}</Text>
                        <Text style={styles.detail}>{names?.teacherName ?? t('common.emptyValue')}</Text>
                        {!!roomName && <Text style={styles.room}>{t('timetable.room', { name: roomName })}</Text>}
                      </>
                    ) : (
                      <Text style={styles.free}>{t('timetable.free')}</Text>
                    )}
                  </View>
                  {!period.breakPeriod && <Text style={styles.chevron}>›</Text>}
                </Pressable>
              );
            })}

            {mode === 'draft' ? (
              <>
                <Text style={styles.unsaved}>{t('timetable.editor.unsaved')}</Text>
                <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{t('timetable.editor.save')}</Text>}
                </Pressable>
              </>
            ) : (
              <>
                {success && <Text style={styles.success}>{t('timetable.editor.saved')}</Text>}
                <Text style={styles.hint}>{t('timetable.editor.immediateHint')}</Text>
              </>
            )}
          </>
        )}
      </ScreenContainer>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={() => {}}>
            {sheet && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>
                  {t('timetable.editor.pickTitle', { day: dayName(day), n: sheet.period.periodNumber })}
                </Text>

                {assignments.map((item) => {
                  const selected = !sheet.other && currentSheetKey === assignmentKey(item);
                  return (
                    <Pressable
                      key={assignmentKey(item)}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() =>
                        setSheet({
                          ...sheet,
                          subjectId: item.subjectId,
                          teacherId: item.teacherId,
                          subjectName: item.subjectName,
                          teacherName: item.teacherName,
                          other: false,
                        })
                      }
                    >
                      <Text style={styles.optionTitle}>{item.subjectName}</Text>
                      <Text style={styles.optionDetail}>{item.teacherName}</Text>
                    </Pressable>
                  );
                })}

                {/* A pair the class doesn't have yet can't go into a whole-week draft (the week save
                    only takes assigned pairs), so it's offered only when saving one period. */}
                {mode === 'immediate' &&
                  (sheet.other ? (
                    <View style={styles.otherBox}>
                      <Text style={styles.fieldLabel}>{t('timetable.editor.subject')}</Text>
                      <SubjectPicker
                        schoolId={schoolId}
                        selectedId={sheet.subjectId}
                        onSelect={(subject) => setSheet({ ...sheet, subjectId: subject.id, subjectName: subject.name })}
                      />
                      <Text style={styles.fieldLabel}>{t('timetable.editor.teacher')}</Text>
                      <EmployeePicker
                        schoolId={schoolId}
                        selectedId={sheet.teacherId}
                        filter={(employee) => employee.employeeType !== 'NON_TEACHING'}
                        onSelect={(employee) => setSheet({ ...sheet, teacherId: employee.id, teacherName: employee.name })}
                      />
                    </View>
                  ) : (
                    <Pressable style={styles.otherLink} onPress={() => setSheet({ ...sheet, other: true })}>
                      <Text style={styles.linkText}>{t('timetable.editor.otherTeacher')}</Text>
                    </Pressable>
                  ))}

                <Text style={[styles.fieldLabel, styles.roomLabel]}>{t('timetable.editor.room')}</Text>
                <RoomPicker
                  rooms={rooms}
                  selectedId={sheet.roomId}
                  onSelect={(roomId) => setSheet({ ...sheet, roomId })}
                  onManageRooms={() => {
                    setSheet(null);
                    navigation.navigate('Rooms');
                  }}
                />

                {sheetError && <ErrorNotice message={sheetError} />}
                <ClashList clashes={sheetClashes} />

                <Pressable
                  style={[styles.saveButton, styles.sheetSave, sheetSaving && styles.disabled]}
                  onPress={() => saveSheet(sheet)}
                  disabled={sheetSaving}
                >
                  {sheetSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.saveText}>{t('timetable.editor.saveCell')}</Text>
                  )}
                </Pressable>
                <Pressable style={styles.clearOption} onPress={() => clearSheet(sheet)} disabled={sheetSaving}>
                  <Text style={styles.clearText}>{t('timetable.editor.clearCell')}</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  weekLink: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  weekLinkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  root: { flex: 1, backgroundColor: colors.background },
  pickerWrap: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  roomLabel: { marginTop: spacing.md },
  loading: { marginTop: spacing.xl },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  noticeText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  noticeButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  noticeButtonText: { color: colors.white, fontWeight: '700' },
  dayMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  metaText: { color: colors.textMuted, fontSize: 12 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...softShadow,
  },
  breakRow: { backgroundColor: colors.surfaceMuted },
  clashRow: { borderColor: colors.error },
  timeCol: { width: 56 },
  time: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  timeEnd: { fontSize: 12, color: colors.textMuted },
  bodyCol: { flex: 1, paddingHorizontal: spacing.sm },
  subject: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  detail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  room: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  free: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  breakText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textMuted },
  unsaved: { color: colors.warning, fontSize: 13, marginTop: spacing.sm },
  success: { color: colors.success, fontWeight: '600', marginTop: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.xl },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  sheetSave: { marginBottom: 0 },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
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
  otherLink: { paddingVertical: spacing.sm },
  otherBox: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  clearOption: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  clearText: { color: colors.error, fontWeight: '700' },
});
