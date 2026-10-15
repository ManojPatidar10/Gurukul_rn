import { FontAwesome5 } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { accents, colors, radius, softShadow, spacing } from '../theme/colors';
import type { SetupStep, SetupStepId } from '../utils/setupChecklist';

interface Props {
  steps: SetupStep[];
  onStep: (id: SetupStepId) => void;
  onDismiss: () => void;
}

const ICONS: Record<SetupStepId, string> = {
  classes: 'chalkboard',
  students: 'user-graduate',
  teachers: 'id-badge',
  location: 'map-marked-alt',
  parents: 'share-alt',
};

/**
 * "Get your school running" - the list a newly registered school works through from the home
 * screen. Each row opens the screen that does that step; done rows get a tick. A principal who
 * set up by other means can dismiss it.
 */
export function SetupChecklistCard({ steps, onStep, onDismiss }: Props) {
  const { t } = useTranslation();
  const done = steps.filter((s) => s.done).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('setup.title')}</Text>
          <Text style={styles.progress}>{t('setup.progress', { done, total: steps.length })}</Text>
        </View>
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={t('setup.dismiss')} hitSlop={12}>
          <FontAwesome5 name="times" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.round((done / steps.length) * 100)}%` }]} />
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.id}
          style={styles.row}
          onPress={() => onStep(step.id)}
          accessibilityRole="button"
          accessibilityState={{ checked: step.done }}
        >
          <View style={[styles.icon, step.done ? styles.iconDone : styles.iconOpen]}>
            <FontAwesome5 name={step.done ? 'check' : ICONS[step.id]} size={14} color={step.done ? colors.white : accents.schoolLocation.base} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, step.done && styles.rowTitleDone]}>{t(`setup.steps.${step.id}.title`)}</Text>
            {!step.done && <Text style={styles.rowDescription}>{t(`setup.steps.${step.id}.description`)}</Text>}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: accents.schoolLocation.base,
    ...softShadow,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  progress: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: accents.schoolLocation.light, marginVertical: spacing.md, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: accents.schoolLocation.base },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  iconOpen: { backgroundColor: accents.schoolLocation.light },
  iconDone: { backgroundColor: colors.success },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  rowDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: spacing.sm },
});
