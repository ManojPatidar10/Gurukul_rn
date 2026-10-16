import { api } from './client';
import type {
  School,
  SchoolLocationUpdateRequest,
  SchoolRegistrationRequest,
  SchoolRegistrationResponse,
  SchoolSearchResult,
  SignupOtpVerifyResponse,
  SchoolUpdateRequest,
} from './types';

export function searchSchools(name?: string) {
  const query = name ? `?name=${encodeURIComponent(name)}` : '';
  return api.get<SchoolSearchResult[]>(`/api/v1/schools${query}`);
}

/** Sends a WhatsApp code to the mobile that will become the new school's principal login. */
export function requestSignupOtp(phone: string) {
  return api.post<void>('/api/v1/schools/signup/otp/request', { phone });
}

/** Checks the code; the token comes back as `signupToken` for registerSchool, bound to that phone. */
export function verifySignupOtp(phone: string, otp: string) {
  return api.post<SignupOtpVerifyResponse>('/api/v1/schools/signup/otp/verify', { phone, otp });
}

export function registerSchool(req: SchoolRegistrationRequest) {
  return api.post<SchoolRegistrationResponse>('/api/v1/schools', req);
}

export function getSchool(id: string) {
  return api.get<School>(`/api/v1/schools/${id}`, id);
}

export function updateSchool(id: string, req: SchoolUpdateRequest) {
  return api.put<School>(`/api/v1/schools/${id}`, req, id);
}

export function updateSchoolLocation(id: string, req: SchoolLocationUpdateRequest) {
  return api.put<School>(`/api/v1/schools/${id}/location`, req, id);
}
