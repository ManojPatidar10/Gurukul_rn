import { api } from './client';
import type { Vendor, VendorRequest } from './types';

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
