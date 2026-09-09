export const API_BASE = (
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export type CognitiveMode = 'beginner' | 'intermediate' | 'expert';
export type AppView = 'dashboard' | 'run' | 'history' | 'profile' | 'chat';

export type AnalysisEvent = {
  id: number;
  kind: 'status' | 'progress' | 'complete' | 'error';
  stage: string;
  title: string;
  detail: string;
  content: string;
  timestamp: string;
};

export type AnalysisReport = {
  ticker: string;
  analysis_date: string;
  signal: string;
  summary: string;
  assistant_brief: string;
  sections: Record<string, string>;
};

export type AnalysisRun = {
  id: string;
  ticker: string;
  analysis_date: string;
  depth: string;
  cognitive_mode: CognitiveMode;
  analysts: string[];
  status: 'queued' | 'running' | 'completed' | 'failed';
  signal?: string;
  report?: AnalysisReport;
  error?: string;
  created_at: string;
  updated_at: string;
  events?: AnalysisEvent[];
};

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

export const tradingApi = {
  health: () => request<{ status: string; provider: string; api_key_configured: boolean }>('/health'),
  runs: () => request<AnalysisRun[]>('/api/runs'),
  run: (id: string) => request<AnalysisRun>(`/api/runs/${id}`),
  createRun: (payload: unknown) => request<{ id: string; status: string }>('/api/runs', { method: 'POST', body: JSON.stringify(payload) }),
  chat: (payload: unknown) => request<{ agent: string; answer: string }>('/api/chat', { method: 'POST', body: JSON.stringify(payload) }),
};
