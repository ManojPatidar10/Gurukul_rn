import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VideoCallHub'>;

const actions: { icon: string; title: string; description: string; route: keyof PrincipalStackParamList }[] = [
  { icon: 'video', title: 'Start a call now', description: 'Ring someone right away', route: 'PickCallTarget' },
  { icon: 'calendar-plus', title: 'Schedule a call', description: 'Pick a time and send an invite', route: 'ScheduleCall' },
  { icon: 'calendar-check', title: 'Scheduled calls', description: 'Hosted by me and calls I’m invited to', route: 'ScheduledCalls' },
  { icon: 'history', title: 'Call history', description: 'Past calls and outcomes', route: 'CallHistory' },
];

export function VideoCallHubScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Video Calls" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {actions.map((action) => (
          <Pressable key={action.route} style={styles.card} onPress={() => navigation.navigate(action.route as never)}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name={action.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardDescription}>{action.description}</Text>
            </View>
          </Pressable>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardDescription: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
