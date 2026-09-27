import { api, getRefreshToken } from './client';
import type {
  AuthProfile,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
  OtpRequest,
  OtpVerifyRequest,
  OtpVerifyResponse,
  SelectProfileRequest,
  SwitchProfileRequest,
} from './types';

export function login(schoolId: string, req: LoginRequest) {
  return api.post<LoginResponse>('/api/v1/auth/login', req, schoolId);
}

export function loginWithGoogle(schoolId: string, req: GoogleLoginRequest) {
  return api.post<LoginResponse>('/api/v1/auth/google', req, schoolId);
}

export function requestOtp(schoolId: string, req: OtpRequest) {
  return api.post<void>('/api/v1/auth/otp/request', req, schoolId);
}

export function verifyOtp(schoolId: string, req: OtpVerifyRequest) {
  return api.post<OtpVerifyResponse>('/api/v1/auth/otp/verify', req, schoolId);
}

export function selectProfile(schoolId: string, req: SelectProfileRequest) {
  return api.post<LoginResponse>('/api/v1/auth/otp/select-profile', req, schoolId);
}

export function listProfiles(schoolId: string) {
  return api.get<AuthProfile[]>('/api/v1/auth/profiles', schoolId);
}

/**
 * Sends the current refresh token so the backend ends the old profile's session. It's read lazily,
 * at send time, because the request may first refresh an about-to-expire access token - which
 * rotates the refresh token, and sending the old one would look like a replayed (stolen) token.
 */
export function switchProfile(schoolId: string, req: Omit<SwitchProfileRequest, 'refreshToken'>) {
  return api.post<LoginResponse>(
    '/api/v1/auth/profiles/switch',
    () => ({ ...req, refreshToken: getRefreshToken() ?? undefined }),
    schoolId
  );
}
