import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getMyChildren } from '../api/parents';
import type { Student } from '../api/types';
import { AvatarBadge } from '../components/AvatarBadge';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useSchoolId } from '../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ParentHome'>;

export function ParentHomeScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const [children, setChildren] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyChildren(schoolId)
      .then((rows) => {
        setChildren(rows);
        if (rows.length === 1) {
          navigation.replace('ChildDashboard', { student: rows[0] });
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [schoolId, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getMyChildren(schoolId)
        .then(setChildren)
        .catch(() => {});
    });
    return unsubscribe;
  }, [navigation, schoolId]);

  if (error) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="My Children" subtitle={session.username} />
        <ScreenContainer>
          <Text style={styles.error}>{error}</Text>
        </ScreenContainer>
      </View>
    );
  }

  if (children === null) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="My Children" subtitle={session.username} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Children" subtitle={session.username} />
      <ScreenContainer>
        {children.length === 0 && <Text style={styles.empty}>No children linked to your account yet.</Text>}
        {children.map((child) => (
          <Pressable key={child.id} style={styles.row} onPress={() => navigation.navigate('ChildDashboard', { student: child })}>
            <AvatarBadge name={child.name} accentKey="students" />
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{child.name}</Text>
              <Text style={styles.rowMeta}>
                Roll {child.rollNumber} · {child.classSectionLabel}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  logoutButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 14 },
});
