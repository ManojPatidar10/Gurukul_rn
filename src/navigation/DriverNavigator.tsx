import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PushDebugScreen } from '../screens/principal/PushDebugScreen';
import { DriverHomeScreen } from '../screens/transport/DriverHomeScreen';
import { DriverTripScreen } from '../screens/transport/DriverTripScreen';
import { colors } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';

const Stack = createNativeStackNavigator<PrincipalStackParamList>();

/** A bus driver's login only runs bus trips - the server refuses everything else to it. */
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
      <Stack.Screen name="PushDebug" component={PushDebugScreen} />
    </Stack.Navigator>
  );
}
