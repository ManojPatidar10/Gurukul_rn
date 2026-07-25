import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdmissionsScreen } from '../screens/principal/AdmissionsScreen';
import { AIChatbotScreen } from '../screens/principal/AIChatbotScreen';
import { AttendanceScreen } from '../screens/principal/AttendanceScreen';
import { EmployeeDetailScreen } from '../screens/principal/EmployeeDetailScreen';
import { EmployeeFormScreen } from '../screens/principal/EmployeeFormScreen';
import { EmployeesListScreen } from '../screens/principal/EmployeesListScreen';
import { InventoryScreen } from '../screens/principal/InventoryScreen';
import { NoticeBoardScreen } from '../screens/principal/NoticeBoardScreen';
import { PaymentsScreen } from '../screens/principal/PaymentsScreen';
import { PrincipalDashboardScreen } from '../screens/principal/PrincipalDashboardScreen';
import { ProgressCardsScreen } from '../screens/principal/ProgressCardsScreen';
import { ScheduleScreen } from '../screens/principal/ScheduleScreen';
import { StudentDetailScreen } from '../screens/principal/StudentDetailScreen';
import { StudentFormScreen } from '../screens/principal/StudentFormScreen';
import { StudentsListScreen } from '../screens/principal/StudentsListScreen';
import { VendorDetailScreen } from '../screens/principal/VendorDetailScreen';
import { VendorFormScreen } from '../screens/principal/VendorFormScreen';
import { VendorsListScreen } from '../screens/principal/VendorsListScreen';
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
        <Stack.Screen name="StudentsList" component={StudentsListScreen} />
        <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
        <Stack.Screen name="StudentForm" component={StudentFormScreen} />
        <Stack.Screen name="EmployeesList" component={EmployeesListScreen} />
        <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
        <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} />
        <Stack.Screen name="VendorsList" component={VendorsListScreen} />
        <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
        <Stack.Screen name="VendorForm" component={VendorFormScreen} />
        <Stack.Screen name="AIChatbot" component={AIChatbotScreen} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} />
        <Stack.Screen name="Inventory" component={InventoryScreen} />
      </Stack.Navigator>
  );
}
