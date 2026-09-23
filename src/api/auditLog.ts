import { api } from './client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

/** Field name to its before/after values. `old` is absent on CREATE, `new` on DELETE. */
export type AuditChanges = Record<string, { old?: unknown; new?: unknown }>;

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  changes: AuditChanges;
  actorOwnerId: string | null;
  actorOwnerType: string | null;
  actorRole: string;
  actorUsername: string;
  occurredAt: string;
}

export function listAuditLogs(
  schoolId: string,
  params: { entityType?: string; page?: number; size?: number } = {}
) {
  const query = new URLSearchParams();
  if (params.entityType) query.set('entityType', params.entityType);
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 50));
  return api.getPaginated<AuditLogEntry>(`/api/v1/audit-logs?${query.toString()}`, schoolId);
}

export function listAuditEntityTypes(schoolId: string) {
  return api.get<string[]>('/api/v1/audit-logs/entity-types', schoolId);
}
