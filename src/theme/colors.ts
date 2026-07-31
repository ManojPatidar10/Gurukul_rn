export const colors = {
  primary: '#7C3AED',
  primaryLight: '#EFE8FC',
  background: '#F6F3FC',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EAFA',
  textPrimary: '#201A2B',
  textSecondary: '#5B5468',
  textMuted: '#9A93A8',
  success: '#2E7D32',
  warning: '#B45309',
  error: '#C62828',
  accent: '#7C3AED',
  border: '#E5DEF5',
  white: '#FFFFFF',
} as const;

export const gradients = {
  header: ['#7C3AED', '#C026D3'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: '#0F1E3D',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export const softShadow = {
  shadowColor: '#0F1E3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
} as const;

export type AccentKey = 'students' | 'employees' | 'vendors' | 'fees' | 'payroll' | 'infraExpenses' | 'classes' | 'chat' | 'calls';

export const accents: Record<AccentKey, { base: string; light: string }> = {
  students: { base: '#2563EB', light: '#E3ECFD' },
  employees: { base: '#7C3AED', light: '#EDE7FC' },
  vendors: { base: '#EA580C', light: '#FDEBE0' },
  fees: { base: '#059669', light: '#DFF5EC' },
  payroll: { base: '#DB2777', light: '#FBE5EF' },
  infraExpenses: { base: '#0891B2', light: '#DEF3F7' },
  classes: { base: '#CA8A04', light: '#FBF1D2' },
  chat: { base: '#0D9488', light: '#DAF3F0' },
  calls: { base: '#4338CA', light: '#E5E3FB' },
};
