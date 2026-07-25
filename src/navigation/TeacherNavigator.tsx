import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TeacherDashboardScreen } from '../screens/teacher/TeacherDashboardScreen';
import { StudentAttendanceScreen } from '../screens/teacher/StudentAttendanceScreen';
import { QuizAssistantScreen } from '../screens/teacher/QuizAssistantScreen';
import { TeacherScheduleScreen } from '../screens/teacher/TeacherScheduleScreen';
import { DigitalLibraryScreen } from '../screens/teacher/DigitalLibraryScreen';
import { colors } from '../theme/colors';
import type { TeacherStackParamList } from '../types/teacher';

const Stack = createNativeStackNavigator<TeacherStackParamList>();

export function TeacherNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="TeacherDashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="TeacherDashboard" component={TeacherDashboardScreen} />
      <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} />
      <Stack.Screen name="QuizAssistant" component={QuizAssistantScreen} />
      <Stack.Screen name="TeacherSchedule" component={TeacherScheduleScreen} />
      <Stack.Screen name="DigitalLibrary" component={DigitalLibraryScreen} />
    </Stack.Navigator>
  );
}
