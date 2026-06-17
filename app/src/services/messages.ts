import { api } from '../lib/api';

/**
 * Messages / conversations service — backs Messages.tsx (unified inbox).
 */
export type ConvChannel = 'whatsapp' | 'sms' | 'instagram' | 'webchat';
export type ConvStatus = 'open' | 'pending' | 'resolved';
export type MsgSender = 'customer' | 'agent' | 'bot';

export type ConvMessage = {
  id: string;
  sender: MsgSender;
  body: string;
  attachments: { url: string; kind: string }[] | null;
  read: boolean;
  at: string;
};

export type Conversation = {
  id: string;
  customer: string;
  customerId: string | null;
  phone: string;
  initials: string;
  channel: ConvChannel;
  channelCode: string;
  status: ConvStatus;
  statusCode: string;
  unread: number;
  lastAt: string;
  lastSnippet: string;
  tags: string[];
  starred: boolean;
  agent: string | null;
  agentId: string | null;
  branchId: string | null;
  messages?: ConvMessage[];
};

export type ConversationStats = { open: number; pending: number; resolved: number; unread: number };

export const messagesApi = {
  async listWithStats(query: { status?: ConvStatus; channel?: ConvChannel; search?: string } = {}): Promise<{ conversations: Conversation[]; stats: ConversationStats }> {
    const { data, meta } = await api.getWithMeta<Conversation[]>('/v1/conversations', { query });
    return { conversations: data, stats: (meta?.stats as ConversationStats) ?? { open: 0, pending: 0, resolved: 0, unread: 0 } };
  },
  get(id: string): Promise<Conversation> {
    return api.get<Conversation>(`/v1/conversations/${id}`);
  },
  reply(id: string, body: string): Promise<ConvMessage> {
    return api.post<ConvMessage>(`/v1/conversations/${id}/messages`, { body });
  },
  assign(id: string, agentId: string | null): Promise<Conversation> {
    return api.post<Conversation>(`/v1/conversations/${id}/assign`, { agentId });
  },
  setStatus(id: string, status: ConvStatus): Promise<Conversation> {
    return api.patch<Conversation>(`/v1/conversations/${id}/status`, { status });
  },
  setTags(id: string, tags: string[]): Promise<Conversation> {
    return api.patch<Conversation>(`/v1/conversations/${id}/tags`, { tags });
  },
  star(id: string, starred?: boolean): Promise<Conversation> {
    return api.patch<Conversation>(`/v1/conversations/${id}/star`, { starred });
  },
};
