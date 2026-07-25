import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { PrincipalNavigator } from './src/navigation/PrincipalNavigator';
import { TeacherNavigator } from './src/navigation/TeacherNavigator';
import { colors } from './src/theme/colors';

export default function App() {
  const [userRole, setUserRole] = useState<'principal' | 'teacher'>('principal');

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <View style={styles.container}>
          {userRole === 'principal' ? <PrincipalNavigator /> : <TeacherNavigator />}

          {/* Role Switcher for Demo Purposes */}
          <View style={styles.roleSwitcher}>
            <TouchableOpacity
              style={[styles.roleBtn, userRole === 'principal' && styles.roleBtnActive]}
              onPress={() => setUserRole('principal')}
            >
              <Text style={[styles.roleText, userRole === 'principal' && styles.roleTextActive]}>Principal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, userRole === 'teacher' && styles.roleBtnActive]}
              onPress={() => setUserRole('teacher')}
            >
              <Text style={[styles.roleText, userRole === 'teacher' && styles.roleTextActive]}>Teacher</Text>
            </TouchableOpacity>
          </View>
        </View>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  roleSwitcher: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    padding: 4,
    zIndex: 1000,
  },
  roleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  roleTextActive: {
    fontWeight: '700',
  },
});
