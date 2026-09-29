import type { AdmissionStage } from '../api/types';

/** Stage changes the backend allows via PATCH /stage (ENROLLED only comes from enrolment). */
export const STAGE_TRANSITIONS: Record<AdmissionStage, AdmissionStage[]> = {
  NEW: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['UNDER_REVIEW'],
  REJECTED: ['UNDER_REVIEW'],
  ENROLLED: [],
};

export const ADMISSION_STAGES: AdmissionStage[] = ['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ENROLLED'];

export function nextStages(stage: AdmissionStage): AdmissionStage[] {
  return STAGE_TRANSITIONS[stage] ?? [];
}

export function canEnrol(stage: AdmissionStage): boolean {
  return stage === 'APPROVED';
}

export function canEdit(stage: AdmissionStage): boolean {
  return stage !== 'ENROLLED';
}

export type StageVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

export function stageVariant(stage: AdmissionStage): StageVariant {
  switch (stage) {
    case 'NEW':
      return 'info';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'APPROVED':
    case 'ENROLLED':
      return 'success';
    case 'REJECTED':
      return 'error';
    default:
      return 'neutral';
  }
}

/** i18n key for the button that moves an application from `from` to `to`. */
export function transitionLabelKey(from: AdmissionStage, to: AdmissionStage): string {
  if (to === 'UNDER_REVIEW') {
    if (from === 'NEW') return 'admissions.actions.startReview';
    if (from === 'APPROVED') return 'admissions.actions.undoApproval';
    return 'admissions.actions.reopen';
  }
  if (to === 'APPROVED') return 'admissions.actions.approve';
  return 'admissions.actions.reject';
}
