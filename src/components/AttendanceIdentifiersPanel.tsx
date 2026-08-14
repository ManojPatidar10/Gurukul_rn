import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  enrollEmployeeAttendanceIdentifier,
  enrollStudentAttendanceIdentifier,
  listEmployeeAttendanceIdentifiers,
  listStudentAttendanceIdentifiers,
  removeAttendanceIdentifier,
} from '../api/attendanceDevices';
import type { AttendanceIdentifier, AttendanceMethod } from '../api/types';
import { useSchoolId } from '../context/SchoolContext';
import { useToast } from '../context/ToastContext';
import { colors, radius, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';

const METHODS: AttendanceMethod[] = ['RFID', 'FINGERPRINT', 'FACE'];

interface Props {
  ownerType: 'STUDENT' | 'EMPLOYEE';
  ownerId: string;
}

export function AttendanceIdentifiersPanel({ ownerType, ownerId }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();

  const [identifiers, setIdentifiers] = useState<AttendanceIdentifier[]>([]);
  const [method, setMethod] = useState<AttendanceMethod>('RFID');
  const [externalId, setExternalId] = useState('');
  const [saving, setSaving] = useState(false);

  const list = ownerType === 'STUDENT' ? listStudentAttendanceIdentifiers : listEmployeeAttendanceIdentifiers;
  const enroll = ownerType === 'STUDENT' ? enrollStudentAttendanceIdentifier : enrollEmployeeAttendanceIdentifier;

  const load = useCallback(() => {
    list(schoolId, ownerId)
      .then(setIdentifiers)
      .catch((e) => showToast((e as Error).message, 'error'));
  }, [list, schoolId, ownerId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnroll = async () => {
    if (!externalId.trim()) {
      showToast(t('attendanceIdentifiers.errors.externalId'), 'error');
      return;
    }
    setSaving(true);
    try {
      await enroll(schoolId, ownerId, method, externalId.trim());
      setExternalId('');
      await load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (identifierId: string) => {
    try {
      await removeAttendanceIdentifier(schoolId, identifierId);
      await load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('attendanceIdentifiers.title')}</Text>
      <Text style={styles.subtitle}>{t('attendanceIdentifiers.subtitle')}</Text>

      {identifiers.map((identifier) => (
        <View key={identifier.id} style={styles.row}>
          <View>
            <Text style={styles.rowMethod}>{t(`attendanceDevices.method.${identifier.method}`)}</Text>
            <Text style={styles.rowExternalId}>{identifier.externalId}</Text>
          </View>
          <Pressable onPress={() => handleRemove(identifier.id)}>
            <Text style={styles.remove}>{t('common.remove')}</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.typeRow}>
        {METHODS.map((m) => (
          <Pressable
            key={m}
            style={[styles.typeChip, method === m && styles.typeChipActive]}
            onPress={() => setMethod(m)}
          >
            <Text style={[styles.typeChipText, method === m && styles.typeChipTextActive]}>
              {t(`attendanceDevices.method.${m}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <LabeledInput
        label={t('attendanceIdentifiers.externalId')}
        value={externalId}
        onChangeText={setExternalId}
        placeholder={t('attendanceIdentifiers.externalIdPlaceholder')}
        autoCapitalize="characters"
      />
      <Pressable style={styles.addButton} onPress={handleEnroll} disabled={saving}>
        <Text style={styles.addButtonText}>{saving ? t('common.saving') : t('attendanceIdentifiers.enrollButton')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowMethod: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  rowExternalId: { fontSize: 14, color: colors.textPrimary },
  remove: { fontSize: 13, color: colors.error, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  typeChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typeChipActive: { backgroundColor: colors.primary },
  typeChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  typeChipTextActive: { color: colors.white },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
});
