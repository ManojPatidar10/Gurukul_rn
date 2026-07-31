import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AssessmentDetailScreen } from '../screens/principal/AssessmentDetailScreen';
import { AssessmentFormScreen } from '../screens/principal/AssessmentFormScreen';
import { AttendanceHistoryScreen } from '../screens/principal/AttendanceHistoryScreen';
import { AttendanceTakeScreen } from '../screens/principal/AttendanceTakeScreen';
import { ClassesListScreen } from '../screens/principal/ClassesListScreen';
import { ConversationThreadScreen } from '../screens/principal/ConversationThreadScreen';
import { ConversationsListScreen } from '../screens/principal/ConversationsListScreen';
import { NewConversationScreen } from '../screens/principal/NewConversationScreen';
import { HelpdeskBotScreen } from '../screens/principal/HelpdeskBotScreen';
import { CallHistoryScreen } from '../screens/principal/CallHistoryScreen';
import { AwardRecognitionScreen } from '../screens/principal/AwardRecognitionScreen';
import { GamificationHubScreen } from '../screens/principal/GamificationHubScreen';
import { HouseWarsScreen } from '../screens/principal/HouseWarsScreen';
import { InCallScreen } from '../screens/principal/InCallScreen';
import { LeaderboardScreen } from '../screens/principal/LeaderboardScreen';
import { PickCallTargetScreen } from '../screens/principal/PickCallTargetScreen';
import { ScheduleCallScreen } from '../screens/principal/ScheduleCallScreen';
import { ScheduledCallsScreen } from '../screens/principal/ScheduledCallsScreen';
import { VideoCallHubScreen } from '../screens/principal/VideoCallHubScreen';
import { EmployeeDetailScreen } from '../screens/principal/EmployeeDetailScreen';
import { EmployeeFormScreen } from '../screens/principal/EmployeeFormScreen';
import { EmployeesListScreen } from '../screens/principal/EmployeesListScreen';
import { FeeAssessmentDetailScreen } from '../screens/principal/FeeAssessmentDetailScreen';
import { FeeAssessmentsListScreen } from '../screens/principal/FeeAssessmentsListScreen';
import { FeeCategoriesListScreen } from '../screens/principal/FeeCategoriesListScreen';
import { FeePaymentFormScreen } from '../screens/principal/FeePaymentFormScreen';
import { FeeStructureDetailScreen } from '../screens/principal/FeeStructureDetailScreen';
import { FeeStructureFormScreen } from '../screens/principal/FeeStructureFormScreen';
import { FeeStructuresListScreen } from '../screens/principal/FeeStructuresListScreen';
import { FeesHubScreen } from '../screens/principal/FeesHubScreen';
import { InfraExpenseDetailScreen } from '../screens/principal/InfraExpenseDetailScreen';
import { InfraExpenseFormScreen } from '../screens/principal/InfraExpenseFormScreen';
import { InfraExpensesListScreen } from '../screens/principal/InfraExpensesListScreen';
import { PayrollHubScreen } from '../screens/principal/PayrollHubScreen';
import { PayrollRunScreen } from '../screens/principal/PayrollRunScreen';
import { PayslipDetailScreen } from '../screens/principal/PayslipDetailScreen';
import { PrincipalDashboardScreen } from '../screens/principal/PrincipalDashboardScreen';
import { SalaryHistoryScreen } from '../screens/principal/SalaryHistoryScreen';
import { SalaryStructureFormScreen } from '../screens/principal/SalaryStructureFormScreen';
import { SalaryStructuresListScreen } from '../screens/principal/SalaryStructuresListScreen';
import { SectionAssessmentsListScreen } from '../screens/principal/SectionAssessmentsListScreen';
import { SectionDetailScreen } from '../screens/principal/SectionDetailScreen';
import { SectionStudentsListScreen } from '../screens/principal/SectionStudentsListScreen';
import { SectionSubjectsListScreen } from '../screens/principal/SectionSubjectsListScreen';
import { SectionsListScreen } from '../screens/principal/SectionsListScreen';
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
        <Stack.Screen name="StudentsList" component={StudentsListScreen} />
        <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
        <Stack.Screen name="StudentForm" component={StudentFormScreen} />
        <Stack.Screen name="EmployeesList" component={EmployeesListScreen} />
        <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
        <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} />
        <Stack.Screen name="SalaryHistory" component={SalaryHistoryScreen} />
        <Stack.Screen name="VendorsList" component={VendorsListScreen} />
        <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
        <Stack.Screen name="VendorForm" component={VendorFormScreen} />
        <Stack.Screen name="FeesHub" component={FeesHubScreen} />
        <Stack.Screen name="FeeCategoriesList" component={FeeCategoriesListScreen} />
        <Stack.Screen name="FeeStructuresList" component={FeeStructuresListScreen} />
        <Stack.Screen name="FeeStructureForm" component={FeeStructureFormScreen} />
        <Stack.Screen name="FeeStructureDetail" component={FeeStructureDetailScreen} />
        <Stack.Screen name="FeeAssessmentsList" component={FeeAssessmentsListScreen} />
        <Stack.Screen name="FeeAssessmentDetail" component={FeeAssessmentDetailScreen} />
        <Stack.Screen name="FeePaymentForm" component={FeePaymentFormScreen} />
        <Stack.Screen name="PayrollHub" component={PayrollHubScreen} />
        <Stack.Screen name="SalaryStructuresList" component={SalaryStructuresListScreen} />
        <Stack.Screen name="SalaryStructureForm" component={SalaryStructureFormScreen} />
        <Stack.Screen name="PayrollRun" component={PayrollRunScreen} />
        <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} />
        <Stack.Screen name="InfraExpensesList" component={InfraExpensesListScreen} />
        <Stack.Screen name="InfraExpenseDetail" component={InfraExpenseDetailScreen} />
        <Stack.Screen name="InfraExpenseForm" component={InfraExpenseFormScreen} />
        <Stack.Screen name="ClassesList" component={ClassesListScreen} />
        <Stack.Screen name="SectionsList" component={SectionsListScreen} />
        <Stack.Screen name="SectionDetail" component={SectionDetailScreen} />
        <Stack.Screen name="SectionStudentsList" component={SectionStudentsListScreen} />
        <Stack.Screen name="SectionSubjectsList" component={SectionSubjectsListScreen} />
        <Stack.Screen name="SectionAssessmentsList" component={SectionAssessmentsListScreen} />
        <Stack.Screen name="AssessmentForm" component={AssessmentFormScreen} />
        <Stack.Screen name="AssessmentDetail" component={AssessmentDetailScreen} />
        <Stack.Screen name="AttendanceTake" component={AttendanceTakeScreen} />
        <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
        <Stack.Screen name="ConversationsList" component={ConversationsListScreen} />
        <Stack.Screen name="NewConversation" component={NewConversationScreen} />
        <Stack.Screen name="ConversationThread" component={ConversationThreadScreen} />
        <Stack.Screen name="HelpdeskBot" component={HelpdeskBotScreen} />
        <Stack.Screen name="VideoCallHub" component={VideoCallHubScreen} />
        <Stack.Screen name="PickCallTarget" component={PickCallTargetScreen} />
        <Stack.Screen name="ScheduleCall" component={ScheduleCallScreen} />
        <Stack.Screen name="ScheduledCalls" component={ScheduledCallsScreen} />
        <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
        <Stack.Screen name="InCall" component={InCallScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="GamificationHub" component={GamificationHubScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="HouseWars" component={HouseWarsScreen} />
        <Stack.Screen name="AwardRecognition" component={AwardRecognitionScreen} />
      </Stack.Navigator>
  );
}
