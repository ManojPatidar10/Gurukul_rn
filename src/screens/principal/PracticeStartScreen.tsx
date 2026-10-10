import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { createPracticeSession } from '../../api/practice';
import type { Subject } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PracticeStart'>;

export function PracticeStartScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!subject) return;
    setStarting(true);
    setError(null);
    try {
      const session = await createPracticeSession(schoolId, { subjectId: subject.id });
      navigation.replace('PracticeSession', { sessionId: session.id });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('games.practice.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.intro}>{t('games.practice.intro')}</Text>

        <SubjectPicker schoolId={schoolId} selectedId={subject?.id ?? null} onSelect={setSubject} />

        {error && <ErrorNotice message={error} />}

        <Pressable
          style={[styles.startButton, !subject && styles.disabled]}
          onPress={handleStart}
          disabled={!subject || starting}
        >
          {starting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <FontAwesome5 name="graduation-cap" size={16} color={colors.white} />
              <Text style={styles.startButtonText}>{t('games.practice.start')}</Text>
            </>
          )}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.md },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    ...softShadow,
  },
  startButtonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
