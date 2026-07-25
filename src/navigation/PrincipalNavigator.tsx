import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
      </Stack.Navigator>
  );
}
