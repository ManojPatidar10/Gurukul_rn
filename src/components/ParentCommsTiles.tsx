import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getUnreadNotificationCount } from '../api/notifications';
import { useSchoolId } from '../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

/**
 * Messages / Announcements / Alerts for a parent - not tied to one child, so shown on both the
 * children list and each child's dashboard. The Alerts badge refreshes whenever the screen regains focus.
 */
export function ParentCommsTiles() {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const navigation = useNavigation<NativeStackNavigationProp<PrincipalStackParamList>>();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    getUnreadNotificationCount(schoolId)
      .then((res) => setUnread(res.unread))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    refresh();
    return navigation.addListener('focus', refresh);
  }, [navigation, refresh]);

  const tiles = [
    { key: 'messages', title: t('parentComms.messages'), icon: 'comments', accentKey: 'chat' as const, screen: 'ConversationsList' as const, badge: 0 },
    { key: 'announcements', title: t('parentComms.announcements'), icon: 'bullhorn', accentKey: 'announcements' as const, screen: 'Announcements' as const, badge: 0 },
    { key: 'alerts', title: t('parentComms.alerts'), icon: 'bell', accentKey: 'alerts' as const, screen: 'Notifications' as const, badge: unread },
  ];

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const accent = accents[tile.accentKey];
        return (
          <Pressable key={tile.key} style={styles.tile} onPress={() => navigation.navigate(tile.screen)} accessibilityRole="button">
            <View style={[styles.iconCircle, { backgroundColor: accent.light }]}>
              <FontAwesome5 name={tile.icon} size={16} color={accent.base} />
              {tile.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tile.badge > 99 ? '99+' : tile.badge}</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {tile.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  tile: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  title: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
});
