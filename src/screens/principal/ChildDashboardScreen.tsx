import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listSectionAssessments } from '../../api/assessments';
import { getErrorMessage } from '../../api/errorMessage';
import type { Assessment } from '../../api/types';
import { toIsoDate } from '../../components/DatePickerField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ParentCommsTiles } from '../../components/ParentCommsTiles';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { upcomingCardState } from '../../utils/upcomingAssessments';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChildDashboard'>;

/**
 * The child's next tests and exams, read-only: families can't open an assessment (that screen is
 * for staff), and marks are never in this list. A failed load says so with a retry rather than
 * looking like there's nothing coming up.
 *
 * For a parent with one child this is their home screen and stays mounted under Attendance, Fees
 * and the rest, so the list reloads whenever the screen regains focus or the app comes back to the
 * foreground on it: new assessments show up, and ones whose day has passed drop off.
 */
function UpcomingAssessmentsCard({ classSectionId }: { classSectionId: string }) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [list, setList] = useState<Assessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => toIsoDate(new Date()));
  // Only the latest request may update the card, so a slow earlier reply can't overwrite it.
  const latestRequest = useRef(0);

  const fetchUpcoming = useCallback(() => {
    const request = ++latestRequest.current;
    setToday(toIsoDate(new Date()));
    listSectionAssessments(schoolId, classSectionId)
      .then((rows) => {
        if (request !== latestRequest.current) return;
        setList(rows);
        setError(null);
      })
      .catch((e) => {
        if (request === latestRequest.current) setError(getErrorMessage(e));
      });
  }, [schoolId, classSectionId]);

  useFocusEffect(
    useCallback(() => {
      fetchUpcoming();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') fetchUpcoming();
      });
      return () => subscription.remove();
    }, [fetchUpcoming])
  );

  const retry = () => {
    setError(null);
    fetchUpcoming();
  };

  const card = upcomingCardState(list, error, today);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('childDashboard.upcoming.title')}</Text>
      {card.kind === 'loading' ? (
        <ActivityIndicator color={colors.primary} style={styles.cardLoading} />
      ) : card.kind === 'error' ? (
        <View>
          <ErrorNotice message={card.message} />
          <Pressable onPress={retry} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : card.kind === 'empty' ? (
        <Text style={styles.cardEmpty}>{t('childDashboard.upcoming.empty')}</Text>
      ) : (
        <>
          {card.items.map((item) => (
            <View key={item.id} style={styles.assessmentRow}>
              <Text style={styles.assessmentTitle}>{item.title}</Text>
              <Text style={styles.assessmentMeta}>
                {[item.subjectName, t(`childDashboard.upcoming.types.${item.type}`, { defaultValue: item.type }), item.assessmentDate]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ))}
          {card.moreCount > 0 && (
            <Text style={styles.more}>{t('childDashboard.upcoming.more', { count: card.moreCount })}</Text>
          )}
        </>
      )}
    </View>
  );
}

export function ChildDashboardScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const student = route.params.student;

  const tiles: { key: string; title: string; icon: string; accentKey: keyof typeof accents; onPress: () => void }[] = [
    {
      key: 'attendance',
      title: t('childDashboard.attendance'),
      icon: 'calendar-check',
      accentKey: 'myAttendance',
      onPress: () => navigation.navigate('AttendanceHistory', { student }),
    },
    {
      key: 'schoolBus',
      title: t('childDashboard.schoolBus'),
      icon: 'bus',
      accentKey: 'schoolBus',
      onPress: () => navigation.navigate('MyBus'),
    },
    {
      key: 'fees',
      title: t('childDashboard.fees'),
      icon: 'file-invoice-dollar',
      accentKey: 'fees',
      onPress: () => navigation.navigate('ChildFees', { student }),
    },
    {
      key: 'reportCard',
      title: t('childDashboard.reportCard'),
      icon: 'file-alt',
      accentKey: 'reportCard',
      onPress: () => navigation.navigate('ReportCard', { student }),
    },
    {
      key: 'idCard',
      title: t('childDashboard.idCard'),
      icon: 'id-badge',
      accentKey: 'idCards',
      onPress: () => navigation.navigate('IdCard', { kind: 'STUDENT', id: student.id, name: student.name }),
    },
    {
      key: 'timetable',
      title: t('childDashboard.timetable'),
      icon: 'clock',
      accentKey: 'myTimetable',
      onPress: () => navigation.navigate('MyTimetable', { student }),
    },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={student.name} onBack={() => navigation.navigate('ParentHome')} />
      <ScreenContainer>
        <ParentCommsTiles />
        <View style={styles.tileGrid}>
          {tiles.map((tile) => {
            const accent = accents[tile.accentKey];
            return (
              <Pressable key={tile.key} style={styles.tile} onPress={tile.onPress}>
                <View style={[styles.iconCircle, { backgroundColor: accent.light }]}>
                  <FontAwesome5 name={tile.icon} size={18} color={accent.base} />
                </View>
                <Text style={styles.tileTitle}>{tile.title}</Text>
              </Pressable>
            );
          })}
        </View>

        {!!student.classSectionId && (
          <UpcomingAssessmentsCard key={student.classSectionId} classSectionId={student.classSectionId} />
        )}

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>{t('common.logOut')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    ...softShadow,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  cardLoading: { marginVertical: spacing.md },
  cardEmpty: { color: colors.textMuted, fontSize: 14 },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
  assessmentRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  assessmentTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  assessmentMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  more: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, fontWeight: '600' },
  logoutButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 14 },
});
