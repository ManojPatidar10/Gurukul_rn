import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AuthProfile } from '../api/types';
import { colors, radius, softShadow, spacing } from '../theme/colors';

interface Props {
  profile: AuthProfile;
  onPress: () => void;
  disabled?: boolean;
}

export function ProfileCard({ profile, onPress, disabled }: Props) {
  const { t } = useTranslation();
  const isStaff = profile.ownerType === 'EMPLOYEE';
  const roleLabel = !isStaff
    ? null
    : profile.role === 'ADMIN'
      ? t('auth.adminRole')
      : profile.role === 'DRIVER'
        ? t('auth.driverRole')
        : t('auth.teacherRole');
  const statusBadge =
    profile.status === 'ALUMNI' ? t('auth.alumniBadge') : profile.status === 'WITHDRAWN' ? t('auth.withdrawnBadge') : null;

  return (
    <Pressable
      style={[styles.card, profile.current && styles.cardCurrent, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{profile.name.trim().charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{profile.name}</Text>
        {isStaff ? (
          <Text style={styles.meta}>{roleLabel}</Text>
        ) : (
          <Text style={styles.meta}>
            {t('auth.classAndSection', { className: profile.className, section: profile.section })}
            {profile.rollNumber ? `  ·  ${t('auth.rollNumber', { rollNumber: profile.rollNumber })}` : ''}
          </Text>
        )}
        {statusBadge && <Text style={styles.statusBadge}>{statusBadge}</Text>}
      </View>
      {profile.current && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>{t('switchChild.currentBadge')}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow,
  },
  cardCurrent: { borderColor: colors.primary, borderWidth: 2 },
  cardDisabled: { opacity: 0.6 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  currentBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  currentBadgeText: { color: colors.primary, fontWeight: '700', fontSize: 11 },
});
