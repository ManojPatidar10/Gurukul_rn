import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { PrincipalNavigator } from './src/navigation/PrincipalNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/colors';
import { SchoolContext } from './src/context/SchoolContext';
import { AuthContext } from './src/context/AuthContext';
import { getStoredSchoolId } from './src/api/schoolStorage';
import { getStoredSession, setStoredSession, clearStoredSession, type Session } from './src/api/authStorage';
import { setAuthToken } from './src/api/client';
import { disconnectChatSocket } from './src/api/chatSocket';
import { IncomingCallOverlay } from './src/components/IncomingCallOverlay';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import type { SchoolSearchResult } from './src/api/types';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SchoolSearchScreen from './src/screens/SchoolSearchScreen';
import SchoolSetupScreen from './src/screens/SchoolSetupScreen';
import OtpLoginScreen from './src/screens/OtpLoginScreen';
import LoginScreen from './src/screens/LoginScreen';

type PreAuthStep =
  | { name: 'welcome' }
  | { name: 'search' }
  | { name: 'register' }
  | { name: 'otpLogin'; schoolId: string; schoolName?: string }
  | { name: 'passwordLogin'; schoolId: string; schoolName?: string };

export default function App() {
  const [schoolId, setSchoolId] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [preAuthStep, setPreAuthStep] = useState<PreAuthStep>({ name: 'welcome' });

  useEffect(() => {
    getStoredSchoolId().then((storedSchoolId) => {
      setSchoolId(storedSchoolId);
      if (storedSchoolId) {
        setPreAuthStep({ name: 'otpLogin', schoolId: storedSchoolId });
      }
    });
  }, []);

  useEffect(() => {
    getStoredSession().then((stored) => {
      if (stored) setAuthToken(stored.token);
      setSession(stored);
    });
  }, []);

  useEffect(() => {
    setAuthToken(session?.token ?? null);
  }, [session]);

  usePushNotifications(schoolId ?? null, session?.token ?? null);

  const handleLoggedIn = (next: Session) => {
    setStoredSession(next);
    setSession(next);
  };

  const handleLogout = () => {
    disconnectChatSocket();
    setAuthToken(null);
    clearStoredSession();
    setSession(null);
    setPreAuthStep(schoolId ? { name: 'otpLogin', schoolId } : { name: 'welcome' });
  };

  const handleSchoolSelected = (school: SchoolSearchResult) => {
    setSchoolId(school.id);
    setPreAuthStep({ name: 'otpLogin', schoolId: school.id, schoolName: school.name });
  };

  const handleRegistered = (newSchoolId: string, admin: Session) => {
    setSchoolId(newSchoolId);
    handleLoggedIn(admin);
  };

  const loading = schoolId === undefined || session === undefined;

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
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !schoolId || !session ? (
        renderPreAuth()
      ) : (
        <SchoolContext.Provider value={schoolId}>
          <AuthContext.Provider value={{ session, logout: handleLogout }}>
            <NavigationContainer ref={navigationRef}>
              <PrincipalNavigator />
            </NavigationContainer>
            <IncomingCallOverlay session={session} schoolId={schoolId} />
          </AuthContext.Provider>
        </SchoolContext.Provider>
      )}
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
