import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';

export type RegistrationRole = 'student' | 'teacher' | 'parent';

interface Props {
  schoolName?: string;
  onBack: () => void;
  onSelectRole: (role: RegistrationRole) => void;
}

const ROLES: { role: RegistrationRole; title: string; description: string }[] = [
  { role: 'student', title: "I'm a student", description: 'Register with your roll number and class' },
  { role: 'teacher', title: "I'm a teacher", description: 'Requires an invite code from your admin' },
  { role: 'parent', title: "I'm a parent", description: "Link to your child's roll number" },
];

export default function RoleSelectScreen({ schoolName, onBack, onSelectRole }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>G</Text>
        </View>
        <Text style={styles.title}>{schoolName ?? 'Create an account'}</Text>
        <Text style={styles.subtitle}>Who are you registering as?</Text>
      </LinearGradient>

      <View style={styles.form}>
        {ROLES.map((item) => (
          <Pressable key={item.role} style={styles.roleCard} onPress={() => onSelectRole(item.role)}>
            <Text style={styles.roleTitle}>{item.title}</Text>
            <Text style={styles.roleDescription}>{item.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow,
  },
  backButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeText: { color: colors.white, fontSize: 28, fontWeight: '800' },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  form: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  roleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  roleTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  roleDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
