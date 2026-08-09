import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { publishReportCards } from '../../api/reportCards';
import type { ReportCardPublication } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PublishReportCards'>;

export function PublishReportCardsScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;
  const [term, setTerm] = useState('Term 1');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportCardPublication | null>(null);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    setResult(null);
    try {
      const publication = await publishReportCards(schoolId, classSection.id, term.trim());
      setResult(publication);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Publish report cards"
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.description}>
          Publishing makes this term&apos;s report card visible to every student in this section
          and locks further marks entry for any assessment in this term. This can be re-run later
          if marks need correcting - publishing again just refreshes the timestamp.
        </Text>

        <Text style={styles.label}>Term</Text>
        <TextInput
          style={styles.input}
          value={term}
          onChangeText={setTerm}
          placeholder="e.g. Term 1"
          placeholderTextColor={colors.textMuted}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {result && (
          <Text style={styles.success}>
            Published &quot;{result.term}&quot; for this section — by {result.publishedByEmployeeName}.
          </Text>
        )}

        <Pressable
          style={[styles.publishButton, (!term.trim() || publishing) && styles.disabled]}
          onPress={handlePublish}
          disabled={!term.trim() || publishing}
        >
          {publishing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.publishButtonText}>Publish report cards</Text>
          )}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  description: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  publishButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  publishButtonText: { color: colors.white, fontWeight: '700' },
});
