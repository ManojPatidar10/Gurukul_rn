import { api } from './client';
import type { Vendor, VendorPayments, VendorRequest, VendorSimilar } from './expenseTypes';

export function listVendors(schoolId: string) {
  return api.get<Vendor[]>('/api/v1/vendors', schoolId);
}

export function getVendor(schoolId: string, id: string) {
  return api.get<Vendor>(`/api/v1/vendors/${id}`, schoolId);
}

export function createVendor(schoolId: string, req: VendorRequest) {
  return api.post<Vendor>('/api/v1/vendors', req, schoolId);
}

export function updateVendor(schoolId: string, id: string, req: VendorRequest) {
  return api.put<Vendor>(`/api/v1/vendors/${id}`, req, schoolId);
}

/** Up to 5 vendors whose name is the same as `name`, ignoring case, spaces and punctuation. */
export function findSimilarVendors(schoolId: string, name: string, excludeId?: string) {
  const exclude = excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : '';
  return api.get<VendorSimilar[]>(`/api/v1/vendors/similar?name=${encodeURIComponent(name)}${exclude}`, schoolId);
}

/** What the school has paid this vendor (paid infra and event expenses), newest first. */
export function getVendorPayments(schoolId: string, id: string) {
  return api.get<VendorPayments>(`/api/v1/vendors/${id}/payments`, schoolId);
}
