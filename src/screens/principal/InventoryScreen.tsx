import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatusChip } from '../../components/StatusChip';
import { inventoryItems } from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Inventory'>;

const categories = ['All', 'Stationery', 'Lab', 'Sports'];

export function InventoryScreen({ navigation }: Props) {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const category = categories[selectedCategory];
  const filtered =
    category === 'All' ? inventoryItems : inventoryItems.filter((i) => i.category === category);
  const lowStock = inventoryItems.filter((i) => i.quantity <= i.threshold);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Inventory" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {lowStock.length > 0 ? (
          <>
            <SectionTitle title="Low Stock Alerts" />
            {lowStock.map((item) => (
              <View key={item.id} style={styles.alertCard}>
                <Text style={styles.alertName}>{item.name}</Text>
                <Text style={styles.alertQty}>
                  {item.quantity} left (threshold: {item.threshold})
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {categories.map((cat, index) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === index && styles.filterChipActive]}
              onPress={() => setSelectedCategory(index)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === index && styles.filterTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <SectionTitle title="Stock List" />
        {filtered.map((item) => {
          const isLow = item.quantity <= item.threshold;
          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>{item.quantity}</Text>
                <StatusChip label={isLow ? 'Low' : 'OK'} variant={isLow ? 'error' : 'success'} />
              </View>
            </View>
          );
        })}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  alertCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alertName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  alertQty: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  filterScroll: {
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  itemMain: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemCategory: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  itemQty: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
});
