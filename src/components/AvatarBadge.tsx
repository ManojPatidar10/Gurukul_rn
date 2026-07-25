import { StyleSheet, Text, View } from 'react-native';

import { accents, radius, type AccentKey } from '../theme/colors';

interface Props {
  name: string;
  accentKey: AccentKey;
  size?: number;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) ?? '?';
  return initials.toUpperCase();
}

export function AvatarBadge({ name, accentKey, size = 44 }: Props) {
  const accent = accents[accentKey];

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius.lg, backgroundColor: accent.light },
      ]}
    >
      <Text style={[styles.text, { color: accent.base, fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
  },
});
