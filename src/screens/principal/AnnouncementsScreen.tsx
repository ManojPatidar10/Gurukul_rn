import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listAnnouncements } from '../../api/chat';
import { getMyChildren } from '../../api/parents';
import type { Announcement } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Announcements'>;

/**
 * A parent's announcements: school-wide, plus each linked child's section and grade. The backend
 * checks each section/grade against the parent's own children, so this only asks for theirs.
 */
async function fetchParentAnnouncements(schoolId: string) {
  const children = await getMyChildren(schoolId);
  const lists = await Promise.all(
    children.length === 0
      ? [listAnnouncements(schoolId)]
      : children.map((c) => listAnnouncements(schoolId, c.classSectionId, c.className))
  );
  const byId = new Map<string, Announcement>();
  lists.flat().forEach((a) => byId.set(a.id, a));
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function AnnouncementsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchParentAnnouncements(schoolId)
      .then((rows) => !cancelled && setAnnouncements(rows))
      .catch((e) => !cancelled && setError(getErrorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const scopeLabel = (a: Announcement) =>
    a.scope === 'SCHOOL'
      ? t('announcements.scopeSchool')
      : a.scope === 'GRADE'
        ? t('announcements.scopeGrade', { className: a.className })
        : t('announcements.scopeClass');

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('announcements.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error && <Text style={styles.error}>{error}</Text>}
        {announcements === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {announcements?.length === 0 && <Text style={styles.empty}>{t('announcements.empty')}</Text>}
        {announcements?.map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.meta}>
              {scopeLabel(a)} · {new Date(a.createdAt).toLocaleDateString(i18n.language)}
            </Text>
            <Text style={styles.title}>{a.title}</Text>
            <Text style={styles.body}>{a.body}</Text>
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 },
});
