import { api } from './client';
import type {
  Announcement,
  ChatContact,
  Conversation,
  CreateAnnouncementRequest,
  CreateConversationRequest,
  MessageHistoryResponse,
  PresignChatAttachmentRequest,
  PresignChatAttachmentResponse,
} from './types';

export function listConversations(schoolId: string) {
  return api.get<Conversation[]>('/api/v1/chat/conversations', schoolId);
}

/**
 * Who the caller may start a parent-staff chat with: for a parent, their children's teachers and
 * the school's admins; for staff, parents of their students (any parent, for an admin).
 */
export function listChatContacts(schoolId: string) {
  return api.get<ChatContact[]>('/api/v1/chat/contacts', schoolId);
}

export function createConversation(schoolId: string, req: CreateConversationRequest) {
  return api.post<Conversation>('/api/v1/chat/conversations', req, schoolId);
}

/** Gets (or creates, on first use) the caller's own private Helpdesk BOT conversation. */
export function getOrCreateBotConversation(schoolId: string) {
  return api.post<Conversation>('/api/v1/chat/bot/conversation', {}, schoolId);
}

export function getConversationMessages(schoolId: string, conversationId: string, page = 0) {
  return api.get<MessageHistoryResponse>(`/api/v1/chat/conversations/${conversationId}/messages?page=${page}`, schoolId);
}

export function presignChatAttachment(
  schoolId: string,
  conversationId: string,
  req: PresignChatAttachmentRequest
) {
  return api.post<PresignChatAttachmentResponse>(
    `/api/v1/chat/conversations/${conversationId}/attachments/presign`,
    req,
    schoolId
  );
}

export function createAnnouncement(schoolId: string, req: CreateAnnouncementRequest) {
  return api.post<Announcement>('/api/v1/chat/announcements', req, schoolId);
}

export function listAnnouncements(schoolId: string, sectionId?: string, className?: string) {
  const params = new URLSearchParams();
  if (sectionId) params.set('sectionId', sectionId);
  if (className) params.set('className', className);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<Announcement[]>(`/api/v1/chat/announcements${query}`, schoolId);
}
