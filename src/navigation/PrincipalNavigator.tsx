import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdmissionsScreen } from '../screens/principal/AdmissionsScreen';
import { AIChatbotScreen } from '../screens/principal/AIChatbotScreen';
import { AttendanceScreen } from '../screens/principal/AttendanceScreen';
import { InventoryScreen } from '../screens/principal/InventoryScreen';
import { NoticeBoardScreen } from '../screens/principal/NoticeBoardScreen';
import { PaymentsScreen } from '../screens/principal/PaymentsScreen';
import { PrincipalDashboardScreen } from '../screens/principal/PrincipalDashboardScreen';
import { ProgressCardsScreen } from '../screens/principal/ProgressCardsScreen';
import { ScheduleScreen } from '../screens/principal/ScheduleScreen';
import { colors } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

const Stack = createNativeStackNavigator<PrincipalStackParamList>();

export function PrincipalNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PrincipalDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
        <Stack.Screen name="PrincipalDashboard" component={PrincipalDashboardScreen} />
        <Stack.Screen name="Attendance" component={AttendanceScreen} />
        <Stack.Screen name="Payments" component={PaymentsScreen} />
        <Stack.Screen name="ProgressCards" component={ProgressCardsScreen} />
        <Stack.Screen name="NoticeBoard" component={NoticeBoardScreen} />
        <Stack.Screen name="Admissions" component={AdmissionsScreen} />
        <Stack.Screen name="AIChatbot" component={AIChatbotScreen} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} />
        <Stack.Screen name="Inventory" component={InventoryScreen} />
      </Stack.Navigator>
  );
}
