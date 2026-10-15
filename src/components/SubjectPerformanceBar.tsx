import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CATEGORICAL_PALETTE, SINGLE_SERIES_COLOR } from '../theme/chartPalette';
import { colors, radius, spacing } from '../theme/colors';

const BELOW_AVERAGE_COLOR = CATEGORICAL_PALETTE[7]; // red, the diverging partner of slot 0

type Props = {
  /** 0-100. Null when every result in the subject was excused, in which case nothing is drawn. */
  percentage: number | null;
  /** Null when no classmate has a result in this subject - then no comparison is shown. */
  classAverage?: number | null;
  /** Percentage points above or below the class. Null alongside a null classAverage. */
  delta?: number | null;
};

/**
 * One subject's score as a bar, with the class average marked on the same track.
 *
 * <p>A mark on its own says little - 62 is a poor score in a class averaging 85 and a strong one
 * in a class averaging 48 - so the marker is what turns the bar into a judgement a parent can
 * read. One track rather than two charts: on a phone, a second chart below would push the
 * comparison off screen, and the comparison is the point.
 */
export function SubjectPerformanceBar({ percentage, classAverage, delta }: Props) {
  const { t } = useTranslation();
  if (percentage == null) {
    return null;
  }

  const scored = clamp(percentage);
  const hasComparison = classAverage != null && delta != null;
  const above = hasComparison && delta > 0;
  // Within a point either way is noise. Calling a 0.4 gap a strength teaches a parent to read
  // meaning into numbers that have none.
  const notable = hasComparison && Math.abs(delta) > 1;

  return (
    <View style={styles.root}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${scored}%`, backgroundColor: notable && !above ? BELOW_AVERAGE_COLOR : SINGLE_SERIES_COLOR },
          ]}
        />
        {hasComparison && (
          // The marker sits on top of the fill, so the bar reads as "how far past the class line".
          // Its colour flips with what is behind it: a dark tick vanishes against a filled bar,
          // which is exactly the case where the student is ahead and the line matters most.
          <View
            style={[
              styles.marker,
              {
                left: `${clamp(classAverage)}%`,
                backgroundColor: clamp(classAverage) < scored ? colors.white : colors.textSecondary,
              },
            ]}
          />
        )}
      </View>
      {hasComparison && (
        <Text
          style={[
            styles.delta,
            // Text never wears the data colour unless it IS the status being reported; here the
            // sign is the message, so it carries it.
            { color: !notable ? colors.textMuted : above ? SINGLE_SERIES_COLOR : BELOW_AVERAGE_COLOR },
          ]}
        >
          {notable
            ? t('reportCardDetail.vsClass', {
                delta: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`,
                average: classAverage.toFixed(1),
              })
            : t('reportCardDetail.atClassAverage', { average: classAverage.toFixed(1) })}
        </Text>
      )}
    </View>
  );
}

function clamp(value: number) {
  // Bonus marks can push a percentage past 100; a 120%-wide bar would overflow its row.
  return Math.max(0, Math.min(100, value));
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.xs },
  track: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { height: 8, borderRadius: radius.sm },
  marker: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 8,
  },
  delta: { fontSize: 11, marginTop: 3, fontWeight: '600' },
});
