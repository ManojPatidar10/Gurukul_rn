import { createContext, useContext } from 'react';

export const SchoolContext = createContext<string | null>(null);

export function useSchoolId(): string {
  const schoolId = useContext(SchoolContext);
  if (!schoolId) {
    throw new Error('useSchoolId() called outside of a SchoolContext.Provider');
  }
  return schoolId;
}
