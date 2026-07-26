import { api } from './client';
import type { LoginRequest, LoginResponse, OtpRequest, OtpVerifyRequest } from './types';

export function login(schoolId: string, req: LoginRequest) {
  return api.post<LoginResponse>('/api/v1/auth/login', req, schoolId);
}

export function requestOtp(schoolId: string, req: OtpRequest) {
  return api.post<void>('/api/v1/auth/otp/request', req, schoolId);
}

export function verifyOtp(schoolId: string, req: OtpVerifyRequest) {
  return api.post<LoginResponse>('/api/v1/auth/otp/verify', req, schoolId);
}
