import { FontAwesome5 } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { IdCard } from '../api/idCards';
import { colors, radius, softShadow, spacing } from '../theme/colors';

interface Props {
  card: IdCard;
  /** A locally picked photo not yet uploaded, shown instead of the stored one. */
  previewPhotoUri?: string | null;
}

/** The digital ID card: the same data and QR as the printed PDF card. */
export function IdCardView({ card, previewPhotoUri }: Props) {
  const { t } = useTranslation();
  const isStudent = card.ownerType === 'STUDENT';
  const photoUri = previewPhotoUri ?? card.photoUrl ?? null;
  const rows: { label: string; value: string | null | undefined }[] = isStudent
    ? [
        { label: t('idCard.fields.class'), value: card.classSectionLabel },
        { label: t('idCard.fields.rollNo'), value: card.rollNumber },
        { label: t('idCard.fields.parent'), value: card.parentName },
        { label: t('idCard.fields.bloodGroup'), value: card.bloodGroup },
        { label: t('idCard.fields.phone'), value: card.cardPhone },
      ]
    : [
        { label: t('idCard.fields.designation'), value: card.designation },
        { label: t('idCard.fields.bloodGroup'), value: card.bloodGroup },
        { label: t('idCard.fields.phone'), value: card.cardPhone },
      ];

  return (
    <View style={styles.card}>
      <View style={styles.band}>
        <View style={styles.bandText}>
          <Text style={styles.school} numberOfLines={1}>
            {card.schoolName}
          </Text>
          {!!card.schoolAddress && (
            <Text style={styles.address} numberOfLines={1}>
              {card.schoolAddress}
            </Text>
          )}
        </View>
        <Text style={styles.kind}>{isStudent ? t('idCard.kind.student') : t('idCard.kind.staff')}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.photo}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
          ) : (
            <FontAwesome5 name="user" size={40} color="#B9B3D6" solid />
          )}
        </View>
        <View style={styles.details}>
          <Text style={styles.name} numberOfLines={2}>
            {card.name}
          </Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {row.value || '-'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.qrRow}>
        {card.qrImage ? (
          <Image source={{ uri: card.qrImage }} style={styles.qr} accessibilityLabel={t('idCard.qrLabel')} />
        ) : null}
        <Text style={styles.qrCaption}>{t('idCard.qrCaption')}</Text>
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText}>{card.status}</Text>
        {!!card.academicYear && <Text style={styles.footText}>{t('idCard.valid', { year: card.academicYear })}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...softShadow,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bandText: { flex: 1 },
  school: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  address: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  kind: {
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginLeft: spacing.sm,
  },
  body: { flexDirection: 'row', padding: spacing.lg, gap: spacing.lg },
  photo: {
    width: 84,
    height: 108,
    borderRadius: radius.sm,
    backgroundColor: '#E8E6F3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: { width: 84, height: 108 },
  details: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', paddingVertical: 2 },
  label: { width: 88, fontSize: 12, color: colors.textMuted },
  value: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  qrRow: { alignItems: 'center', paddingBottom: spacing.md },
  qr: { width: 150, height: 150 },
  qrCaption: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  footText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
