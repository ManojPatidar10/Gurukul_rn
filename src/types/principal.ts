import type {
  Employee,
  FeeAssessment,
  FeeStructure,
  InfraExpenseRequest,
  PayrollLine,
  Student,
  Vendor,
} from '../api/types';

export type FeatureId = 'students' | 'employees' | 'vendors' | 'fees' | 'payroll' | 'infraExpenses';

export interface FeatureAction {
  id: FeatureId;
  title: string;
  icon: string;
  description: string;
}

export type PrincipalStackParamList = {
  PrincipalDashboard: undefined;
  StudentsList: undefined;
  StudentDetail: { student: Student };
  StudentForm: { student?: Student };
  EmployeesList: undefined;
  EmployeeDetail: { employee: Employee };
  EmployeeForm: { employee?: Employee };
  SalaryHistory: { employee: Employee };
  VendorsList: undefined;
  VendorDetail: { vendor: Vendor };
  VendorForm: { vendor?: Vendor };
  FeesHub: undefined;
  FeeCategoriesList: undefined;
  FeeStructuresList: undefined;
  FeeStructureForm: undefined;
  FeeStructureDetail: { feeStructure: FeeStructure };
  FeeAssessmentsList: undefined;
  FeeAssessmentDetail: { assessment: FeeAssessment };
  FeePaymentForm: { assessment: FeeAssessment };
  PayrollHub: undefined;
  SalaryStructuresList: undefined;
  SalaryStructureForm: undefined;
  PayrollRun: undefined;
  PayslipDetail: { payrollLine: PayrollLine };
  InfraExpensesList: undefined;
  InfraExpenseDetail: { request: InfraExpenseRequest };
  InfraExpenseForm: undefined;
};
