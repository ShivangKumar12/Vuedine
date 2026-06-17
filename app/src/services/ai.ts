import { api } from '../lib/api';

/**
 * Vuedine AI service — backs the AI Helper FAB/panel.
 * Chat is context-grounded on the tenant's data and consumes AI quota
 * (Phase K); suggestions + usage are free reads.
 */

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type AiUsage = { used: number; limit: number; remaining: number };

export type ChatResult = {
  reply: string;
  engine: 'openai' | 'local';
  context: string;
  usage: AiUsage;
};

export type AiSuggestion = {
  id: string;
  kind: 'pricing' | 'inventory' | 'staffing' | 'menu';
  title: string;
  detail: string;
  impact: string;
  confidence: 'High' | 'Medium' | 'Low';
};

export type SuggestionsResult = {
  suggestions: AiSuggestion[];
  context: {
    totalSales: number;
    orderCount: number;
    avgOrderValue: number;
    topItems: { name: string; sold: number; emoji: string }[];
    peakHour: number | null;
    rangeDays: number;
  };
};

export const aiApi = {
  chat(body: { message: string; branchId?: string; history?: ChatMessage[] }): Promise<ChatResult> {
    return api.post<ChatResult>('/v1/ai/chat', body);
  },

  suggestions(branchId?: string): Promise<SuggestionsResult> {
    return api.get<SuggestionsResult>('/v1/ai/suggestions', { query: { branchId } });
  },

  usage(): Promise<AiUsage> {
    return api.get<AiUsage>('/v1/ai/usage');
  },
};
