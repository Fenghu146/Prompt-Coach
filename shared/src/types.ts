export type Outcome = "unverified" | "helpful" | "partially_solved" | "solved" | "not_helpful";

export type DebugLog = {
  id: string;
  content: string;
  createdAt: string;
};

export type ImprovedPrompt = {
  content: string;
  reasons: string[];
  missingInformation: string[];
  createdAt: string;
};

export type ScoreBreakdown = {
  context: number;
  specificity: number;
  constraints: number;
  taskClarity: number;
  outputFormat: number;
  total: number;
  suggestions: string[];
};

export type JudgeComparison = {
  original: ScoreBreakdown;
  improved: ScoreBreakdown;
  createdAt: string;
};

export type PromptCase = {
  id: string;
  title: string;
  domain?: string;
  problem: string;
  originalPrompt: string;
  context?: string;
  aiResult?: string;
  debugLogs: DebugLog[];
  outcome?: Outcome;
  improvedPrompt?: ImprovedPrompt;
  judge?: JudgeComparison;
  learnedRuleId?: string;
  generatedFromRuleIds?: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type LearnedRule = {
  id: string;
  title: string;
  domain?: string;
  experience: string;
  promptRule: string;
  tags: string[];
  confidence: "low" | "medium" | "high";
  status: "draft" | "confirmed" | "archived";
  sourceCaseIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  baseURL: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
  apiMode: "chat" | "responses" | "auto";
  timeoutMs: number;
  updatedAt: string;
};

export type SafeSettings = Omit<Settings, "apiKey"> & { apiKeyMasked: string; hasApiKey: boolean };

export const DEFAULT_SETTINGS: Settings = {
  baseURL: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  apiMode: "auto",
  timeoutMs: 30000,
  updatedAt: new Date().toISOString(),
};

export const CHAT_MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  { value: "gpt-4o", label: "gpt-4o" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "gpt-4.1", label: "gpt-4.1" },
  { value: "o4-mini", label: "o4-mini" },
] as const;

export const EMBEDDING_MODEL_OPTIONS = [
  { value: "text-embedding-3-small", label: "text-embedding-3-small" },
  { value: "text-embedding-3-large", label: "text-embedding-3-large" },
  { value: "text-embedding-ada-002", label: "text-embedding-ada-002" },
] as const;

export const OUTCOME_LABELS: Record<Outcome, string> = {
  unverified: "未验证",
  helpful: "有帮助",
  partially_solved: "部分解决",
  solved: "已解决",
  not_helpful: "无帮助",
};

export const CONFIDENCE_LABELS: Record<LearnedRule["confidence"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};
