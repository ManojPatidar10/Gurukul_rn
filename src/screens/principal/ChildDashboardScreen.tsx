import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChildDashboard'>;

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
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={student.name} onBack={() => navigation.navigate('ParentHome')} />
      <ScreenContainer>
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
  logoutButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 14 },
});
