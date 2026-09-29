import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listProfiles, switchProfile as switchProfileRequest } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { AuthProfile } from '../../api/types';
import { ProfileCard } from '../../components/ProfileCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SwitchChild'>;

export function SwitchChildScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { switchProfile } = useAuth();
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProfiles(schoolId)
      .then(setProfiles)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSwitch = async (profile: AuthProfile) => {
    if (profile.current) return;
    setSwitchingId(profile.ownerId);
    setError(null);
    try {
      const session = await switchProfileRequest(schoolId, { ownerType: profile.ownerType, ownerId: profile.ownerId });
      switchProfile(session);
      navigation.reset({ index: 0, routes: [{ name: 'PrincipalDashboard' }] });
    } catch (e) {
      setError(e instanceof ApiError ? t('switchChild.switchFailed') : getErrorMessage(e));
      setSwitchingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('switchChild.title')} subtitle={t('switchChild.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <ErrorNotice message={error} />}
        {!loading && profiles.length <= 1 && !error && <Text style={styles.empty}>{t('switchChild.noOtherProfiles')}</Text>}
        {!loading &&
          profiles.map((profile) => (
            <ProfileCard
              key={`${profile.ownerType}:${profile.ownerId}`}
              profile={profile}
              onPress={() => handleSwitch(profile)}
              disabled={switchingId !== null || profile.current}
            />
          ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
