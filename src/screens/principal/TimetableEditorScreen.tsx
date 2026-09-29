import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listSectionSubjects } from '../../api/sectionSubjects';
import {
  clashesFromError,
  getSectionTimetable,
  saveSectionTimetable,
  type DayOfWeek,
  type Period,
  type TimetableClash,
} from '../../api/timetable';
import type { ClassSection, SubjectAssignment } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TimetableDayTabs } from '../../components/TimetableDayTabs';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { cellsToSlotRequests, defaultDay, slotKey, slotsToCells, type CellAssignment } from '../../utils/timetable';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TimetableEditor'>;

const assignmentKey = (a: CellAssignment) => `${a.subjectId}|${a.teacherId}`;

/**
 * Admin-only weekly timetable editor for one class-section: day tabs, one row per period, tap a
 * row to pick one of the section's subject+teacher assignments. Save sends the whole week; the
 * server rejects clashes (a teacher already teaching elsewhere then) and they're listed here.
 */
export function TimetableEditorScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [classSection, setClassSection] = useState<ClassSection | null>(route.params?.classSection ?? null);
  const [days, setDays] = useState<DayOfWeek[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [cells, setCells] = useState<Record<string, CellAssignment>>({});
  const [day, setDay] = useState<DayOfWeek>('MONDAY');
  const [picking, setPicking] = useState<Period | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [success, setSuccess] = useState(false);

  const load = useCallback(() => {
    if (!classSection) return;
    setLoading(true);
    setError(null);
    setClashes([]);
    setSuccess(false);
    Promise.all([getSectionTimetable(schoolId, classSection.id), listSectionSubjects(schoolId, classSection.id)])
      .then(([tt, subjects]) => {
        setDays(tt.days);
        setPeriods(tt.periods);
        setCells(slotsToCells(tt.slots));
        setAssignments(subjects);
        setDay((current) => (tt.days.includes(current) ? current : defaultDay(tt.days)));
        setDirty(false);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, classSection]);

  useEffect(load, [load]);

  // Coming back from the bell schedule or subject assignments: reload, unless there are unsaved edits.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    let first = true;
    return navigation.addListener('focus', () => {
      if (first) {
        first = false;
        return;
      }
      if (!dirtyRef.current) load();
    });
  }, [load, navigation]);

  const assignmentByKey = useMemo(() => {
    const map = new Map<string, SubjectAssignment>();
    for (const a of assignments) map.set(assignmentKey(a), a);
    return map;
  }, [assignments]);

  const clashKeys = useMemo(() => new Set(clashes.map((c) => slotKey(c.dayOfWeek, c.periodNumber))), [clashes]);

  const teachablePeriods = periods.filter((p) => !p.breakPeriod);
  const filledToday = teachablePeriods.filter((p) => cells[slotKey(day, p.periodNumber)]).length;

  const setCell = (period: Period, value: CellAssignment | null) => {
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
    setPicking(null);
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

  const dayName = (d: DayOfWeek) => t(`timetable.days.${d}`);

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
                setDirty(false);
              }}
            />
          </View>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {!loading && error && <ErrorNotice message={error} />}
        {!loading && clashes.length > 0 && (
          <View style={styles.clashBox}>
            <Text style={styles.clashTitle}>{t('timetable.editor.clashTitle')}</Text>
            {clashes.map((c) => (
              <Text key={`${c.dayOfWeek}-${c.periodNumber}-${c.teacherId}`} style={styles.clashLine}>
                {t('timetable.editor.clashLine', {
                  day: dayName(c.dayOfWeek),
                  n: c.periodNumber,
                  teacher: c.teacherName,
                  section: c.conflictingSectionLabel,
                })}
              </Text>
            ))}
          </View>
        )}

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

        {!loading && classSection && periods.length > 0 && assignments.length > 0 && (
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
              const assignment = cell ? assignmentByKey.get(assignmentKey(cell)) : undefined;
              const clashing = clashKeys.has(slotKey(day, period.periodNumber));
              return (
                <Pressable
                  key={period.periodNumber}
                  disabled={period.breakPeriod}
                  onPress={() => setPicking(period)}
                  style={[styles.row, period.breakPeriod && styles.breakRow, clashing && styles.clashRow]}
                >
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{period.startTime}</Text>
                    <Text style={styles.timeEnd}>{period.endTime}</Text>
                  </View>
                  <View style={styles.bodyCol}>
                    {period.breakPeriod ? (
                      <Text style={styles.breakText}>{period.label ?? t('timetable.break')}</Text>
                    ) : assignment ? (
                      <>
                        <Text style={styles.subject}>{assignment.subjectName}</Text>
                        <Text style={styles.detail}>{assignment.teacherName}</Text>
                      </>
                    ) : (
                      <Text style={styles.free}>{t('timetable.free')}</Text>
                    )}
                  </View>
                  {!period.breakPeriod && <Text style={styles.chevron}>›</Text>}
                </Pressable>
              );
            })}

            {dirty && <Text style={styles.unsaved}>{t('timetable.editor.unsaved')}</Text>}
            {success && <Text style={styles.success}>{t('timetable.editor.saved')}</Text>}
            <Pressable
              style={[styles.saveButton, (saving || !dirty) && styles.disabled]}
              onPress={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{t('timetable.editor.save')}</Text>}
            </Pressable>
          </>
        )}
      </ScreenContainer>

      <Modal visible={!!picking} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {picking && (
              <>
                <Text style={styles.sheetTitle}>
                  {t('timetable.editor.pickTitle', { day: dayName(day), n: picking.periodNumber })}
                </Text>
                <FlatList
                  data={assignments}
                  keyExtractor={(a) => assignmentKey(a)}
                  renderItem={({ item }) => {
                    const current = cells[slotKey(day, picking.periodNumber)];
                    const selected = !!current && assignmentKey(current) === assignmentKey(item);
                    return (
                      <Pressable
                        style={[styles.option, selected && styles.optionSelected]}
                        onPress={() => setCell(picking, { subjectId: item.subjectId, teacherId: item.teacherId })}
                      >
                        <Text style={styles.optionTitle}>{item.subjectName}</Text>
                        <Text style={styles.optionDetail}>{item.teacherName}</Text>
                      </Pressable>
                    );
                  }}
                />
                <Pressable style={styles.clearOption} onPress={() => setCell(picking, null)}>
                  <Text style={styles.clearText}>{t('timetable.editor.clearCell')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pickerWrap: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  clashBox: {
    backgroundColor: '#FDECEC',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  clashTitle: { color: colors.error, fontWeight: '700', marginBottom: spacing.xs },
  clashLine: { color: colors.textPrimary, fontSize: 13, marginTop: 2 },
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
  free: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  breakText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textMuted },
  unsaved: { color: colors.warning, fontSize: 13, marginTop: spacing.sm },
  success: { color: colors.success, fontWeight: '600', marginTop: spacing.sm },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
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
  clearOption: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  clearText: { color: colors.error, fontWeight: '700' },
});
