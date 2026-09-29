import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { PrincipalNavigator } from './src/navigation/PrincipalNavigator';
import { ParentNavigator } from './src/navigation/ParentNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/colors';
import { SchoolContext } from './src/context/SchoolContext';
import { AuthContext } from './src/context/AuthContext';
import { ToastProvider, useToast } from './src/context/ToastContext';
import { getStoredSchoolId, setStoredSchoolId } from './src/api/schoolStorage';
import { getStoredSession, setStoredSession, clearStoredSession, type Session } from './src/api/authStorage';
import {
  getAuthToken,
  getRefreshToken,
  onSessionExpired,
  onSessionRefreshed,
  refreshSession,
  revokeSession,
  SessionExpiredError,
  setAuthSession,
} from './src/api/client';
import { disconnectChatSocket } from './src/api/chatSocket';
import { IncomingCallOverlay } from './src/components/IncomingCallOverlay';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { clearPushRegistration, getLastExpoPushToken } from './src/push/pushStatus';
import type { AuthProfile, SchoolSearchResult } from './src/api/types';
import { initI18n } from './src/i18n';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SchoolSearchScreen from './src/screens/SchoolSearchScreen';
import SchoolSetupScreen from './src/screens/SchoolSetupScreen';
import OtpLoginScreen from './src/screens/OtpLoginScreen';
import ProfileSelectScreen from './src/screens/ProfileSelectScreen';
import LoginScreen from './src/screens/LoginScreen';
import RoleSelectScreen, { type RegistrationRole } from './src/screens/RoleSelectScreen';
import RegisterStudentScreen from './src/screens/RegisterStudentScreen';
import RegisterTeacherScreen from './src/screens/RegisterTeacherScreen';
import RegisterParentScreen from './src/screens/RegisterParentScreen';
import RegistrationSubmittedScreen from './src/screens/RegistrationSubmittedScreen';

type PreAuthStep =
  | { name: 'welcome' }
  | { name: 'search' }
  | { name: 'register' }
  | { name: 'otpLogin'; schoolId: string; schoolName?: string }
  | { name: 'profileSelect'; schoolId: string; schoolName?: string; selectionToken: string; profiles: AuthProfile[] }
  | { name: 'passwordLogin'; schoolId: string; schoolName?: string }
  | { name: 'roleSelect'; schoolId: string; schoolName?: string }
  | { name: 'registerRole'; schoolId: string; schoolName?: string; role: RegistrationRole }
  | { name: 'registrationSubmitted'; schoolId: string; schoolName?: string; message: string };

function hasPassed(isoTime?: string) {
  return !!isoTime && new Date(isoTime).getTime() <= Date.now();
}

/** Lives inside ToastProvider (which App itself renders) so it can show the session-expired toast. */
function SessionExpiredToast({ notice }: { notice: number }) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    if (notice > 0) showToast(t('auth.sessionExpired'), 'info');
  }, [notice, showToast, t]);
  return null;
}

export default function App() {
  const [schoolId, setSchoolId] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [preAuthStep, setPreAuthStep] = useState<PreAuthStep>({ name: 'welcome' });
  const [i18nReady, setI18nReady] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(0);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    getStoredSchoolId().then((storedSchoolId) => {
      setSchoolId(storedSchoolId);
      if (storedSchoolId) {
        setPreAuthStep({ name: 'otpLogin', schoolId: storedSchoolId });
      }
    });
  }, []);

  // The client module owns the live session once it's set (it rotates the tokens on every silent
  // refresh), so App only hands it a new session at login/switch/logout and follows its refreshes -
  // never the other way round, which could put back an already-used refresh token.
  const sessionExpiredRef = useRef<() => void>(() => {});
  useEffect(() => {
    onSessionRefreshed(setSession);
    onSessionExpired(() => sessionExpiredRef.current());
    return () => {
      onSessionRefreshed(null);
      onSessionExpired(null);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getStoredSession().catch(() => null);
      if (!stored) {
        setSession(null);
        return;
      }
      if (stored.refreshToken && hasPassed(stored.refreshTokenExpiresAt)) {
        await clearStoredSession();
        setSession(null);
        setSessionExpiredNotice((n) => n + 1);
        return;
      }
      setAuthSession(stored);
      // Access token already expired: renew it behind the splash so home doesn't open onto a wall
      // of failing requests. Offline is fine - keep the stored session, the next request retries.
      if (stored.refreshToken && hasPassed(stored.accessTokenExpiresAt)) {
        try {
          setSession(await refreshSession());
          return;
        } catch (e) {
          if (e instanceof SessionExpiredError) return; // handleSessionExpired has already run
        }
      }
      setSession(stored);
    })();
  }, []);

  usePushNotifications(schoolId ?? null, session ?? null);

  const handleLoggedIn = (next: Session) => {
    setAuthSession(next);
    setStoredSession(next);
    setSession(next);
  };

  const endSession = () => {
    disconnectChatSocket();
    setAuthSession(null);
    clearStoredSession();
    setSession(null);
    setPreAuthStep(schoolId ? { name: 'otpLogin', schoolId } : { name: 'welcome' });
  };

  const handleLogout = () => {
    const refreshToken = getRefreshToken();
    // The token lookup may read storage, so the request goes out a moment later - it needs no auth
    // header, so clearing the session meanwhile is fine.
    getLastExpoPushToken().then((expoPushToken) => {
      revokeSession({ refreshToken, expoPushToken });
      clearPushRegistration();
    });
    endSession();
  };

  // Several requests can fail on the same dead session at once - only the first one logs out.
  const handleSessionExpired = () => {
    if (!getAuthToken()) return;
    endSession();
    setSessionExpiredNotice((n) => n + 1);
  };
  useEffect(() => {
    sessionExpiredRef.current = handleSessionExpired;
  });

  // Switching to a sibling/self profile keeps the same phone-number login but swaps identity - the
  // old socket connection was authenticated as the previous owner, so it must be torn down before
  // usePushNotifications (keyed on the session's owner) re-registers the device under the new one.
  const handleSwitchProfile = (next: Session) => {
    disconnectChatSocket();
    setAuthSession(next);
    setStoredSession(next);
    setSession(next);
  };

  const handleSchoolSelected = (school: SchoolSearchResult) => {
    setSchoolId(school.id);
    // Persist it like SchoolSetupScreen does - otherwise an app restart has a stored session but no
    // school, and drops the user back on the pre-login screens.
    setStoredSchoolId(school.id);
    setPreAuthStep({ name: 'otpLogin', schoolId: school.id, schoolName: school.name });
  };

  const handleRegistered = (newSchoolId: string, admin: Session) => {
    setSchoolId(newSchoolId);
    handleLoggedIn(admin);
  };

  const loading = schoolId === undefined || session === undefined || !i18nReady;

  const renderPreAuth = () => {
    switch (preAuthStep.name) {
      case 'welcome':
        return (
          <WelcomeScreen
            onFindSchool={() => setPreAuthStep({ name: 'search' })}
            onRegisterSchool={() => setPreAuthStep({ name: 'register' })}
          />
        );
      case 'search':
        return (
          <SchoolSearchScreen
            onBack={() => setPreAuthStep({ name: 'welcome' })}
            onSelect={handleSchoolSelected}
          />
        );
      case 'register':
        return (
          <SchoolSetupScreen
            onBack={() => setPreAuthStep({ name: 'welcome' })}
            onRegistered={handleRegistered}
          />
        );
      case 'otpLogin':
        return (
          <OtpLoginScreen
            schoolId={preAuthStep.schoolId}
            schoolName={preAuthStep.schoolName}
            onBack={() => setPreAuthStep({ name: 'search' })}
            onUsePassword={() =>
              setPreAuthStep({
                name: 'passwordLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
            onLoggedIn={handleLoggedIn}
            onProfileSelectionRequired={(selectionToken, profiles) =>
              setPreAuthStep({
                name: 'profileSelect',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
                selectionToken,
                profiles,
              })
            }
            onRegister={() =>
              setPreAuthStep({
                name: 'roleSelect',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
      case 'profileSelect':
        return (
          <ProfileSelectScreen
            schoolId={preAuthStep.schoolId}
            schoolName={preAuthStep.schoolName}
            selectionToken={preAuthStep.selectionToken}
            profiles={preAuthStep.profiles}
            onSelected={handleLoggedIn}
            onBack={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
      case 'passwordLogin':
        return (
          <LoginScreen
            schoolId={preAuthStep.schoolId}
            onBack={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
            onLoggedIn={handleLoggedIn}
            onRegister={() =>
              setPreAuthStep({
                name: 'roleSelect',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
      case 'roleSelect':
        return (
          <RoleSelectScreen
            schoolName={preAuthStep.schoolName}
            onBack={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
            onSelectRole={(role) =>
              setPreAuthStep({
                name: 'registerRole',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
                role,
              })
            }
          />
        );
      case 'registerRole': {
        const { schoolId: regSchoolId, schoolName, role } = preAuthStep;
        const onBack = () => setPreAuthStep({ name: 'roleSelect', schoolId: regSchoolId, schoolName });
        const onSubmitted = (message: string) =>
          setPreAuthStep({ name: 'registrationSubmitted', schoolId: regSchoolId, schoolName, message });
        if (role === 'student') {
          return <RegisterStudentScreen schoolId={regSchoolId} onBack={onBack} onSubmitted={onSubmitted} />;
        }
        if (role === 'teacher') {
          return <RegisterTeacherScreen schoolId={regSchoolId} onBack={onBack} onSubmitted={onSubmitted} />;
        }
        return <RegisterParentScreen schoolId={regSchoolId} onBack={onBack} onSubmitted={onSubmitted} />;
      }
      case 'registrationSubmitted':
        return (
          <RegistrationSubmittedScreen
            message={preAuthStep.message}
            onDone={() =>
              setPreAuthStep({
                name: 'otpLogin',
                schoolId: preAuthStep.schoolId,
                schoolName: preAuthStep.schoolName,
              })
            }
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SessionExpiredToast notice={sessionExpiredNotice} />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !schoolId || !session ? (
          renderPreAuth()
        ) : (
          <SchoolContext.Provider value={schoolId}>
            <AuthContext.Provider value={{ session, logout: handleLogout, switchProfile: handleSwitchProfile }}>
              <NavigationContainer ref={navigationRef}>
                {session.ownerType === 'PARENT' ? <ParentNavigator /> : <PrincipalNavigator />}
              </NavigationContainer>
              <IncomingCallOverlay session={session} schoolId={schoolId} />
            </AuthContext.Provider>
          </SchoolContext.Provider>
        )}
      </ToastProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
