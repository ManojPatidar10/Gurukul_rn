import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../api/errorMessage';
import { getMyChildren, linkChild } from '../api/parents';
import type { Student } from '../api/types';
import { ErrorNotice } from '../components/ErrorNotice';
import LabeledInput from '../components/LabeledInput';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSchoolId } from '../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';
import { linkChildNumber, linkedChildSummary, type LinkedChildSummary } from '../utils/linkChild';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'LinkChild'>;

/**
 * A parent links another child (a brother or sister at the same school) by the child's
 * registration number. The backend links only a child whose record carries this parent's phone
 * as the parent contact, and locks a number for 15 minutes after 5 mismatches; its refusals come
 * with LINK_CHILD_* codes, worded in the app's language by getErrorMessage. Opened from ParentHome
 * and from ChildDashboard (a one-child parent's home). Linking moves the child's absence and fee
 * alerts from the child's own login to this account, so the confirmation says so.
 */
export function LinkChildScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();

  const [children, setChildren] = useState<Student[] | null>(null);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  // Only the latest load may update the list, so a slow earlier reply can't overwrite a newer one.
  const latestLoad = useRef(0);

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set after a successful link: who was linked (null when the backend didn't say).
  const [linked, setLinked] = useState<{ child: LinkedChildSummary | null } | null>(null);

  const loadChildren = useCallback(() => {
    const request = ++latestLoad.current;
    getMyChildren(schoolId)
      .then((rows) => {
        if (request !== latestLoad.current) return;
        setChildren(rows);
        setChildrenError(null);
      })
      .catch((e) => {
        if (request === latestLoad.current) setChildrenError(getErrorMessage(e));
      });
  }, [schoolId]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const retryChildren = () => {
    setChildrenError(null);
    loadChildren();
  };

  const number = linkChildNumber(registrationNumber);
  const canSubmit = number.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const child = await linkChild(schoolId, { studentRegistrationNumber: number });
      setLinked({ child: linkedChildSummary(child) });
      loadChildren();
    } catch (e) {
      // The typed number stays, so a typo can be corrected.
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const linkAnother = () => {
    setRegistrationNumber('');
    setError(null);
    setLinked(null);
  };

  // A reset rather than navigate: ParentHome reloads the children (a one-child parent goes on to
  // ChildDashboard as usual), and Back can't return to this confirmation.
  const done = () => navigation.reset({ index: 0, routes: [{ name: 'ParentHome' }] });

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('linkChild.title')} subtitle={t('linkChild.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('linkChild.linkedHeading')}</Text>
          {childrenError ? (
            <View>
              <ErrorNotice message={childrenError} />
              <Pressable onPress={retryChildren} style={styles.textButton} accessibilityRole="button">
                <Text style={styles.textButtonText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : children === null ? (
            <ActivityIndicator color={colors.primary} style={styles.cardLoading} />
          ) : children.length === 0 ? (
            <Text style={styles.muted}>{t('linkChild.noneLinked')}</Text>
          ) : (
            children.map((child) => (
              <View key={child.id} style={styles.childRow}>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.muted}>
                  {t('parentHome.rollAndClass', { roll: child.rollNumber, classSection: child.classSectionLabel })}
                </Text>
              </View>
            ))
          )}
        </View>

        {linked ? (
          <View style={styles.card} accessibilityLiveRegion="polite">
            <View style={styles.successTitleRow}>
              <FontAwesome5 name="check-circle" size={18} color={colors.success} />
              <Text style={styles.successTitle}>{t('linkChild.successTitle')}</Text>
            </View>
            <Text style={styles.successText}>
              {linked.child
                ? t('linkChild.successNamed', { name: linked.child.name, classSection: linked.child.classSection })
                : t('linkChild.successGeneric')}
            </Text>
            <Pressable style={styles.submit} onPress={done} accessibilityRole="button">
              <Text style={styles.submitText}>{t('common.done')}</Text>
            </Pressable>
            <Pressable onPress={linkAnother} style={styles.textButtonCentered} accessibilityRole="button">
              <Text style={styles.textButtonText}>{t('linkChild.linkAnother')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <LabeledInput
              label={t('linkChild.numberLabel')}
              placeholder={t('linkChild.numberPlaceholder')}
              value={registrationNumber}
              onChangeText={setRegistrationNumber}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!submitting}
            />
            <Text style={styles.hint}>{t('linkChild.hint')}</Text>
            {error && <ErrorNotice message={error} />}
            <Pressable
              style={[styles.submit, !canSubmit && styles.disabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            >
              <Text style={styles.submitText}>{submitting ? t('linkChild.submitting') : t('linkChild.submit')}</Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  cardLoading: { marginVertical: spacing.sm, alignSelf: 'flex-start' },
  muted: { fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  childRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  childName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  form: { marginTop: spacing.sm },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: -spacing.xs, marginBottom: spacing.sm },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  textButton: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  textButtonCentered: { alignSelf: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  textButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  successTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  successTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  successText: { fontSize: 14.5, color: colors.textPrimary, lineHeight: 21 },
});
