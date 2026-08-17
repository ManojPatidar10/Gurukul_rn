import { Image, StyleSheet, View } from 'react-native';

interface Props {
  width?: number;
  /** Wraps the logo in a frosted-glass card, matching the old badge look - needed on the
   * violet/magenta gradient hero where the logo's own pink tones would otherwise blend in. */
  onDarkBackground?: boolean;
}

const ASPECT_RATIO = 1200 / 689;

/** The Gurukul wordmark (graduation cap + "Gurukul" text) - already includes the name, so
 * screens using this generally shouldn't also render a separate literal "Gurukul" title. */
export function Logo({ width = 180, onDarkBackground = false }: Props) {
  const image = (
    <Image
      source={require('../../assets/logo-wordmark.png')}
      style={{ width, height: width / ASPECT_RATIO }}
      resizeMode="contain"
      accessibilityLabel="Gurukul"
    />
  );

  if (!onDarkBackground) return image;

  return <View style={styles.card}>{image}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
