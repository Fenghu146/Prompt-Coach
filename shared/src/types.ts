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

export const EMBEDDED_MODEL_ID = "__embedded__" as const;

export type Settings = {
  baseURL: string;
  apiKey: string;
  model: string;
  apiMode: "chat" | "responses" | "auto";
  timeoutMs: number;
  updatedAt: string;
};

export type SafeSettings = Omit<Settings, "apiKey"> & { apiKeyMasked: string; hasApiKey: boolean };

export const DEFAULT_SETTINGS: Settings = {
  baseURL: "https://api.openai.com/v1",
  apiKey: "",
  model: EMBEDDED_MODEL_ID,
  apiMode: "auto",
  timeoutMs: 30000,
  updatedAt: new Date().toISOString(),
};

export const CHAT_MODEL_OPTIONS = [
  { value: "__embedded__", label: "本地内嵌（离线/零 Token）", isEmbedded: true },
  { value: "deepseek-chat", label: "deepseek-chat" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner" },
  { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  { value: "gpt-4o", label: "gpt-4o" },
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
