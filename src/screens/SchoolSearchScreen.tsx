import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { searchSchools } from '../api/schools';
import type { SchoolSearchResult } from '../api/types';
import LabeledInput from '../components/LabeledInput';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, softShadow, spacing } from '../theme/colors';

interface Props {
  onBack: () => void;
  onSelect: (school: SchoolSearchResult) => void;
}

export default function SchoolSearchScreen({ onBack, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (name: string) => {
    setLoading(true);
    setError(null);
    searchSchools(name || undefined)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Find your school" onBack={onBack} />
      <View style={styles.body}>
        <LabeledInput label="Search by name" value={query} onChangeText={setQuery} placeholder="e.g. Gurukul" />

        {loading && <ActivityIndicator style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !loading ? <Text style={styles.empty}>No schools found.</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onSelect(item)}>
              <View>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.city}, {item.state}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loading: { marginVertical: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
