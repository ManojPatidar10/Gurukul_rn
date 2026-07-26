import { createContext, useContext } from 'react';
import type { Session } from '../api/authStorage';

interface AuthContextValue {
  session: Session;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() called outside of an AuthContext.Provider');
  }
  return ctx;
}
