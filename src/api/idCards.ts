import { File, Paths } from 'expo-file-system';

import { idCardFileName, sectionIdSheetFileName, STAFF_ID_SHEET_FILE_NAME } from '../utils/idCard';
import { api, BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';
import { pickedFileSize, putToPresignedUrl } from './presignedUpload';

export type IdCardOwnerType = 'STUDENT' | 'EMPLOYEE';

/** Everything an ID card shows, plus what's still missing from the profile (GET /api/v1/id-cards/...). */
export interface IdCard {
  ownerType: IdCardOwnerType;
  ownerId: string;
  name: string;
  classSectionLabel?: string | null;
  rollNumber?: string | null;
  academicYear?: string | null;
  parentName?: string | null;
  designation?: string | null;
  bloodGroup?: string | null;
  emergencyContactName?: string | null;
  emergencyPhone?: string | null;
  /** The phone printed on the card (emergency phone, else parent/own phone). */
  cardPhone?: string | null;
  photoUrl?: string | null;
  hasPhoto: boolean;
  missing: string[];
  canEdit: boolean;
  status: string;
  schoolName: string;
  schoolAddress?: string | null;
  qrCode: string;
  /** PNG data URI of the QR code. */
  qrImage?: string | null;
}

export interface IdCardDetailsInput {
  bloodGroup: string | null;
  emergencyContactName: string | null;
  emergencyPhone: string | null;
}

export interface PickedPhoto {
  uri: string;
  contentType: string;
  sizeBytes: number;
}

interface PhotoPresignResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

const segment = (type: IdCardOwnerType) => (type === 'STUDENT' ? 'students' : 'employees');

/** The caller's own card, or one per linked child for a parent. */
export function getMyIdCards(schoolId: string) {
  return api.get<IdCard[]>('/api/v1/id-cards/me', schoolId);
}

export function getIdCard(schoolId: string, type: IdCardOwnerType, id: string) {
  return api.get<IdCard>(`/api/v1/id-cards/${segment(type)}/${id}`, schoolId);
}

export function updateIdCardDetails(schoolId: string, type: IdCardOwnerType, id: string, details: IdCardDetailsInput) {
  return api.put<IdCard>(`/api/v1/id-cards/${segment(type)}/${id}/profile`, details, schoolId);
}

export function removeIdCardPhoto(schoolId: string, type: IdCardOwnerType, id: string) {
  return api.delete<IdCard>(`/api/v1/id-cards/${segment(type)}/${id}/photo`, schoolId);
}

/** Presign -> PUT the bytes straight to S3 -> confirm. Resolves with the updated card. */
export async function uploadIdCardPhoto(schoolId: string, type: IdCardOwnerType, id: string, photo: PickedPhoto) {
  const base = `/api/v1/id-cards/${segment(type)}/${id}/photo`;
  // The picker doesn't always report a size - the presign needs the exact byte count S3 will receive.
  const fileSizeBytes = await pickedFileSize(photo.uri, photo.sizeBytes);
  const presigned = await api.post<PhotoPresignResponse>(
    `${base}/presign`,
    { contentType: photo.contentType, fileSizeBytes },
    schoolId
  );
  await putToPresignedUrl(presigned.uploadUrl, photo.uri, photo.contentType);
  return api.put<IdCard>(base, { objectKey: presigned.objectKey }, schoolId);
}

async function download(schoolId: string, path: string, fileName: string): Promise<File> {
  await ensureFreshAccessToken();
  const headers: Record<string, string> = { 'X-School-Id': schoolId };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const destination = new File(Paths.cache, fileName);
  // Rejects on any non-2xx response, so an error body is never saved as a .pdf.
  return File.downloadFileAsync(`${BASE_URL}${path}`, destination, { headers, idempotent: true });
}

/** One card, 85.6 x 54 mm. Missing details print as placeholders. */
export function downloadIdCardPdf(schoolId: string, card: Pick<IdCard, 'ownerType' | 'ownerId' | 'name'>) {
  return download(schoolId, `/api/v1/id-cards/${segment(card.ownerType)}/${card.ownerId}/card.pdf`, idCardFileName(card.name));
}

/** Admin only: A4 sheets, 10 cards per page, for every active student of a section. */
export function downloadSectionIdSheet(schoolId: string, section: { id: string; className: string; section: string }) {
  return download(
    schoolId,
    `/api/v1/id-cards/class-sections/${section.id}/sheet.pdf`,
    sectionIdSheetFileName(section.className, section.section)
  );
}

/** Admin only: A4 sheets for every active staff member. */
export function downloadStaffIdSheet(schoolId: string) {
  return download(schoolId, '/api/v1/id-cards/staff/sheet.pdf', STAFF_ID_SHEET_FILE_NAME);
}
