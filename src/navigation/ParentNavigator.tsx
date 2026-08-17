import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ParentHomeScreen } from '../screens/ParentHomeScreen';
import { AttendanceHistoryScreen } from '../screens/principal/AttendanceHistoryScreen';
import { ChildDashboardScreen } from '../screens/principal/ChildDashboardScreen';
import { ChildFeesScreen } from '../screens/principal/ChildFeesScreen';
import { ReportCardScreen } from '../screens/principal/ReportCardScreen';
import { colors } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

const Stack = createNativeStackNavigator<PrincipalStackParamList>();

export function ParentNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ParentHome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
      <Stack.Screen name="ChildDashboard" component={ChildDashboardScreen} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <Stack.Screen name="ChildFees" component={ChildFeesScreen} />
      <Stack.Screen name="ReportCard" component={ReportCardScreen} />
    </Stack.Navigator>
  );
}
