import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import type { AppNotification } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { notificationTarget } from '../../utils/notificationRouting';
import { openNotificationTarget } from '../../utils/openNotificationTarget';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Notifications'>;

/** The Alerts inbox: every push the user was sent, newest first. Tapping marks it read and opens it. */
export function NotificationsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(() => {
    listNotifications(schoolId, 0)
      .then((res) => {
        setItems(res.notifications);
        setHasMore(res.hasMore);
        setPage(0);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = () => {
    setLoadingMore(true);
    listNotifications(schoolId, page + 1)
      .then((res) => {
        setItems((prev) => [...(prev ?? []), ...res.notifications]);
        setHasMore(res.hasMore);
        setPage(page + 1);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoadingMore(false));
  };

  const open = (item: AppNotification) => {
    if (!item.readAt) {
      const now = new Date().toISOString();
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)) ?? null);
      markNotificationRead(schoolId, item.id).catch(() => {});
    }
    const target = notificationTarget(item.data, session.role);
    if (target) {
      openNotificationTarget(schoolId, target, navigation.navigate).catch(() => {});
    }
  };

  const markAll = () => {
    const now = new Date().toISOString();
    setItems((prev) => prev?.map((n) => (n.readAt ? n : { ...n, readAt: now })) ?? null);
    markAllNotificationsRead(schoolId).catch((e) => setError(getErrorMessage(e)));
  };

  const hasUnread = items?.some((n) => !n.readAt) ?? false;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('alerts.title')}
        onBack={() => navigation.goBack()}
        rightAction={
          hasUnread ? (
            <Pressable onPress={markAll} accessibilityRole="button">
              <Text style={styles.markAll}>{t('alerts.markAllRead')}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScreenContainer>
        {error && <ErrorNotice message={error} />}
        {items === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {items?.length === 0 && <Text style={styles.empty}>{t('alerts.empty')}</Text>}
        {items?.map((item) => (
          <Pressable key={item.id} style={[styles.row, !item.readAt && styles.unreadRow]} onPress={() => open(item)}>
            {!item.readAt && <View style={styles.dot} />}
            <View style={styles.rowMain}>
              <Text style={[styles.rowTitle, !item.readAt && styles.unreadTitle]}>{item.title}</Text>
              <Text style={styles.rowBody}>{item.body}</Text>
              <Text style={styles.rowTime}>{new Date(item.createdAt).toLocaleString(i18n.language)}</Text>
            </View>
          </Pressable>
        ))}
        {hasMore && (
          <Pressable style={styles.moreButton} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.moreText}>{t('alerts.loadMore')}</Text>
            )}
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  markAll: { color: colors.white, fontWeight: '700', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  unreadRow: { backgroundColor: colors.primaryLight },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6, marginRight: spacing.sm },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  unreadTitle: { fontWeight: '800' },
  rowBody: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  rowTime: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  moreButton: { alignItems: 'center', paddingVertical: spacing.md },
  moreText: { color: colors.primary, fontWeight: '700' },
});
