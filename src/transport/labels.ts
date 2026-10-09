import type { TFunction } from 'i18next';

import type { NotBoardedReason, TripStudent } from '../api/types';

export const NOT_BOARDED_REASONS: NotBoardedReason[] = ['PICKED_UP_BY_PARENT', 'LEFT_EARLY', 'OTHER_BUS', 'OTHER'];

/** "just now", "3 min ago", "1 h ago". */
export function formatAgo(iso: string, t: TFunction): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 30) return t('transport.time.justNow');
  if (seconds < 90) return t('transport.time.minute');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('transport.time.minutes', { count: minutes });
  return t('transport.time.hours', { count: Math.round(minutes / 60) });
}

export function formatTime(iso: string | null, language: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' });
}

/** "Boarded", "Not boarded - left school early", or "Not marked yet". */
export function boardingLabel(row: TripStudent, t: TFunction): string {
  if (row.status === 'BOARDED') return t('transport.boarding.boarded');
  if (row.status === 'NOT_BOARDED') {
    const reason = row.reason === 'OTHER' && row.note ? row.note : row.reason ? t(`transport.reasons.${row.reason}`) : '';
    return reason ? `${t('transport.boarding.notBoarded')} · ${reason}` : t('transport.boarding.notBoarded');
  }
  return t('transport.boarding.unmarked');
}

export function classLabel(row: { className: string; section: string }): string {
  return row.section ? `${row.className} ${row.section}` : row.className;
}
