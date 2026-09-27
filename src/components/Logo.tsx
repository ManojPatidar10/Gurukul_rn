import { Image } from 'react-native';

interface Props {
  width?: number;
  /** Uses the reversed (white text) lockup, for the violet/magenta gradient hero screens. */
  onDarkBackground?: boolean;
}

const ASPECT_RATIO = 600 / 383;

/** The Smart Gurukul stacked lockup (graduation-cap "G" mark over "Smart Gurukul") - already
 * includes the name, so screens using this generally shouldn't also render a separate title. */
export function Logo({ width = 180, onDarkBackground = false }: Props) {
  return (
    <Image
      source={
        onDarkBackground
          ? require('../../assets/logo-stacked-reversed.png')
          : require('../../assets/logo-stacked.png')
      }
      style={{ width, height: width / ASPECT_RATIO, marginBottom: onDarkBackground ? 8 : 0 }}
      resizeMode="contain"
      accessibilityLabel="Smart Gurukul"
    />
  );
}
