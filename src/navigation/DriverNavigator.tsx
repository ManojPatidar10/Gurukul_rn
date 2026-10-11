import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PayslipDetailScreen } from '../screens/principal/PayslipDetailScreen';
import { PushDebugScreen } from '../screens/principal/PushDebugScreen';
import { SalaryHistoryScreen } from '../screens/principal/SalaryHistoryScreen';
import { DriverHomeScreen } from '../screens/transport/DriverHomeScreen';
import { DriverPastTripsScreen } from '../screens/transport/DriverPastTripsScreen';
import { DriverTripScreen } from '../screens/transport/DriverTripScreen';
import { colors } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

const Stack = createNativeStackNavigator<PrincipalStackParamList>();

/** A bus driver's login only runs bus trips and reads its own payslips - the server refuses everything else to it. */
export function DriverNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="DriverHome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
      <Stack.Screen name="DriverTrip" component={DriverTripScreen} />
      <Stack.Screen name="DriverPastTrips" component={DriverPastTripsScreen} />
      <Stack.Screen name="SalaryHistory" component={SalaryHistoryScreen} />
      <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} />
      <Stack.Screen name="PushDebug" component={PushDebugScreen} />
    </Stack.Navigator>
  );
}
