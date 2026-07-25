import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatusChip } from '../../components/StatusChip';
import { subjectPerformance } from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ProgressCards'>;

const classes = ['Class 10', 'Class 9', 'Class 8', 'Class 7'];

export function ProgressCardsScreen({ navigation }: Props) {
  const [selectedClass, setSelectedClass] = useState(0);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Progress Cards" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.exportRow}>
          <SectionTitle title="Subject Performance" />
          <TouchableOpacity style={styles.exportButton} accessibilityRole="button">
            <Text style={styles.exportText}>Export PDF</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {classes.map((cls, index) => (
            <TouchableOpacity
              key={cls}
              style={[styles.classChip, selectedClass === index && styles.classChipActive]}
              onPress={() => setSelectedClass(index)}
            >
              <Text
                style={[styles.classChipText, selectedClass === index && styles.classChipTextActive]}
              >
                {cls}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHead, { flex: 2 }]}>Subject</Text>
          <Text style={[styles.tableCell, styles.tableHead]}>Avg %</Text>
          <Text style={[styles.tableCell, styles.tableHead, { flex: 1.2 }]}>Top Class</Text>
        </View>

        {subjectPerformance.map((item) => (
          <View key={item.subject} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{item.subject}</Text>
            <View style={[styles.tableCell, styles.avgCell]}>
              <StatusChip
                label={`${item.average}%`}
                variant={item.average >= 80 ? 'success' : item.average >= 70 ? 'warning' : 'error'}
              />
            </View>
            <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.topClass}</Text>
          </View>
        ))}

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Class Insight — {classes[selectedClass]}</Text>
          <Text style={styles.insightText}>
            Overall performance is above district average. Science and Social Studies show
            strongest results. English needs targeted intervention in sections B and C.
          </Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  exportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  exportText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  chipScroll: {
    marginBottom: spacing.lg,
  },
  classChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  classChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  classChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  classChipTextActive: {
    color: colors.white,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  tableHead: {
    fontWeight: '700',
    color: colors.primary,
  },
  avgCell: {
    alignItems: 'flex-start',
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  insightText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
