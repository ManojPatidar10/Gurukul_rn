import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { PrincipalNavigator } from './src/navigation/PrincipalNavigator';
import { colors } from './src/theme/colors';
import { SchoolContext } from './src/context/SchoolContext';
import { getStoredSchoolId } from './src/api/schoolStorage';
import SchoolSetupScreen from './src/screens/SchoolSetupScreen';

export default function App() {
  const [schoolId, setSchoolId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getStoredSchoolId().then(setSchoolId);
  }, []);

  return (
    <SafeAreaProvider>
      {schoolId === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : schoolId === null ? (
        <SchoolSetupScreen onRegistered={setSchoolId} />
      ) : (
        <SchoolContext.Provider value={schoolId}>
          <NavigationContainer>
            <PrincipalNavigator />
          </NavigationContainer>
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
