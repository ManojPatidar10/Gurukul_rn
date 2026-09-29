import { canEdit, canEnrol, nextStages, stageVariant, transitionLabelKey } from '../utils/admissionStages';

describe('admission stages', () => {
  it('mirrors the backend pipeline', () => {
    expect(nextStages('NEW')).toEqual(['UNDER_REVIEW', 'REJECTED']);
    expect(nextStages('UNDER_REVIEW')).toEqual(['APPROVED', 'REJECTED']);
    expect(nextStages('APPROVED')).toEqual(['UNDER_REVIEW']);
    expect(nextStages('REJECTED')).toEqual(['UNDER_REVIEW']);
    expect(nextStages('ENROLLED')).toEqual([]);
  });

  it('only allows enrolling an approved application, and freezes an enrolled one', () => {
    expect(canEnrol('APPROVED')).toBe(true);
    expect(canEnrol('UNDER_REVIEW')).toBe(false);
    expect(canEnrol('ENROLLED')).toBe(false);
    expect(canEdit('ENROLLED')).toBe(false);
    expect(canEdit('REJECTED')).toBe(true);
  });

  it('labels each transition', () => {
    expect(transitionLabelKey('NEW', 'UNDER_REVIEW')).toBe('admissions.actions.startReview');
    expect(transitionLabelKey('APPROVED', 'UNDER_REVIEW')).toBe('admissions.actions.undoApproval');
    expect(transitionLabelKey('REJECTED', 'UNDER_REVIEW')).toBe('admissions.actions.reopen');
    expect(transitionLabelKey('UNDER_REVIEW', 'APPROVED')).toBe('admissions.actions.approve');
    expect(transitionLabelKey('NEW', 'REJECTED')).toBe('admissions.actions.reject');
    expect(stageVariant('REJECTED')).toBe('error');
  });
});
