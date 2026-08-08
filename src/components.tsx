import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radius } from './theme';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'light';
};

export function Button({ title, onPress, variant = 'primary' }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`${variant}Button`],
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, variant !== 'primary' && styles.darkButtonText]}>
        {title}
      </Text>
    </Pressable>
  );
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  back?: () => void;
};

export function Header({ title, subtitle, back }: HeaderProps) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable onPress={back} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.bell}>
        <Text style={styles.bellText}>!</Text>
      </View>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
};

export function Field({ label, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        style={[styles.field, props.multiline && styles.textArea]}
        {...props}
      />
    </View>
  );
}

type CardProps = {
  children: ReactNode;
  style?: object;
};

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type StatCardProps = {
  label: string;
  value: string;
  tone?: 'blue' | 'green' | 'orange' | 'gray';
};

export function StatCard({ label, value, tone = 'gray' }: StatCardProps) {
  return (
    <View style={[styles.stat, styles[`${tone}Stat`]]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

type BottomTabsProps = {
  active: string;
  onChange: (screen: string) => void;
};

const tabs = [
  ['Dashboard', 'Home'],
  ['Schools', 'Schools'],
  ['Teachers', 'Teachers'],
  ['Settings', 'Settings'],
  ['Profile', 'Profile'],
];

export function BottomTabs({ active, onChange }: BottomTabsProps) {
  return (
    <View style={styles.tabs}>
      {tabs.map(([screen, label]) => {
        const selected = active === screen;
        return (
          <Pressable key={screen} onPress={() => onChange(screen)} style={styles.tab}>
            <View style={[styles.tabIcon, selected && styles.tabIconActive]}>
              <Text style={[styles.tabIconText, selected && styles.tabIconTextActive]}>
                {label.slice(0, 1)}
              </Text>
            </View>
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
    width: 36,
  },
  backText: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  bell: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bellText: {
    color: colors.primary,
    fontWeight: '900',
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.sm,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
  },
  dangerButton: {
    backgroundColor: '#FEE2E2',
  },
  lightButton: {
    backgroundColor: colors.primarySoft,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  darkButtonText: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.82,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  label: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  field: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  stat: {
    borderRadius: radius.md,
    flex: 1,
    minHeight: 82,
    padding: 14,
  },
  blueStat: {
    backgroundColor: '#EAF2FF',
  },
  greenStat: {
    backgroundColor: '#ECFDF5',
  },
  orangeStat: {
    backgroundColor: '#FFF7ED',
  },
  grayStat: {
    backgroundColor: colors.soft,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  tabs: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 76,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
  },
  tabIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  tabIconActive: {
    backgroundColor: colors.primarySoft,
  },
  tabIconText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  tabIconTextActive: {
    color: colors.primary,
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  tabTextActive: {
    color: colors.primary,
  },
});
