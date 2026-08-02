import { api } from './client';
import type {
  Announcement,
  Conversation,
  CreateAnnouncementRequest,
  CreateConversationRequest,
  MessageHistoryResponse,
} from './types';

export function listConversations(schoolId: string) {
  return api.get<Conversation[]>('/api/v1/chat/conversations', schoolId);
}

export function createConversation(schoolId: string, req: CreateConversationRequest) {
  return api.post<Conversation>('/api/v1/chat/conversations', req, schoolId);
}

export function getConversationMessages(schoolId: string, conversationId: string, page = 0) {
  return api.get<MessageHistoryResponse>(`/api/v1/chat/conversations/${conversationId}/messages?page=${page}`, schoolId);
}

export function getOrCreateBotConversation(schoolId: string) {
  return api.post<Conversation>('/api/v1/chat/bot/conversation', {}, schoolId);
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
