import { z } from "zod";

export const outcomeSchema = z.enum(["unverified", "helpful", "partially_solved", "solved", "not_helpful"]);

export const debugLogSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.string().min(1),
});

export const improvedPromptSchema = z.object({
  content: z.string().min(1),
  reasons: z.array(z.string().min(1)).max(5),
  missingInformation: z.array(z.string()),
  createdAt: z.string().min(1),
});

export const scoreBreakdownSchema = z.object({
  context: z.number().min(0).max(20),
  specificity: z.number().min(0).max(20),
  constraints: z.number().min(0).max(20),
  taskClarity: z.number().min(0).max(20),
  outputFormat: z.number().min(0).max(20),
  total: z.number().min(0).max(100),
  suggestions: z.array(z.string()),
}).refine((s) => s.total === s.context + s.specificity + s.constraints + s.taskClarity + s.outputFormat, {
  message: "total must equal sum of 5 dimensions",
  path: ["total"],
});

export const judgeComparisonSchema = z.object({
  original: scoreBreakdownSchema,
  improved: scoreBreakdownSchema,
  createdAt: z.string().min(1),
});

export const promptCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  domain: z.string().optional(),
  problem: z.string().min(1),
  originalPrompt: z.string().min(1),
  context: z.string().optional(),
  aiResult: z.string().optional(),
  debugLogs: z.array(debugLogSchema),
  outcome: outcomeSchema.optional(),
  improvedPrompt: improvedPromptSchema.optional(),
  judge: judgeComparisonSchema.optional(),
  learnedRuleId: z.string().optional(),
  generatedFromRuleIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).max(6),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const learnedRuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  domain: z.string().optional(),
  experience: z.string().min(1),
  promptRule: z.string().min(1),
  tags: z.array(z.string()).max(6),
  confidence: z.enum(["low", "medium", "high"]),
  status: z.enum(["draft", "confirmed", "archived"]),
  sourceCaseIds: z.array(z.string().min(1)).min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const settingsSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  embeddingModel: z.string().min(1),
  apiMode: z.enum(["chat", "responses", "auto"]),
  timeoutMs: z.number().min(1000).max(120000),
  updatedAt: z.string().min(1),
});

export const createCaseInputSchema = z.object({
  title: z.string().min(1).max(200),
  domain: z.string().optional(),
  problem: z.string().min(1),
  originalPrompt: z.string().min(1),
  context: z.string().optional(),
  aiResult: z.string().optional(),
  tags: z.array(z.string()).max(6).default([]),
  improvedPrompt: improvedPromptSchema.optional(),
  generatedFromRuleIds: z.array(z.string()).optional(),
});

export const patchCaseInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  domain: z.string().optional(),
  problem: z.string().min(1).optional(),
  originalPrompt: z.string().min(1).optional(),
  context: z.string().optional(),
  aiResult: z.string().optional(),
  tags: z.array(z.string()).max(6).optional(),
  outcome: outcomeSchema.optional(),
});

export const generateInputSchema = z.object({
  problem: z.string().min(1),
  domain: z.string().optional(),
  tags: z.array(z.string()).optional(),
  context: z.string().optional(),
});

export const improveResultRawSchema = z.object({
  content: z.string().min(1),
  reasons: z.array(z.string()).max(5),
  missingInformation: z.array(z.string()).default([]),
});

export const learnResultRawSchema = z.object({
  title: z.string().min(1),
  domain: z.string().optional(),
  experience: z.string().min(1),
  promptRule: z.string().min(1),
  tags: z.array(z.string()).max(6).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

export const generateResultRawSchema = z.object({
  prompt: z.string().min(1),
});

export const judgeSingleRawSchema = z.object({
  context: z.number().min(0).max(20),
  specificity: z.number().min(0).max(20),
  constraints: z.number().min(0).max(20),
  taskClarity: z.number().min(0).max(20),
  outputFormat: z.number().min(0).max(20),
  total: z.number().min(0).max(100).optional(),
  suggestions: z.array(z.string()).default([]),
});

export const judgeResultRawSchema = z.object({
  original: judgeSingleRawSchema,
  improved: judgeSingleRawSchema,
});

export function parseImproveResult(raw: unknown): { content: string; reasons: string[]; missingInformation: string[] } {
  const parsed = improveResultRawSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Improve 解析失败: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return parsed.data;
}

export function parseLearnResult(raw: unknown): z.infer<typeof learnResultRawSchema> {
  const parsed = learnResultRawSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Learn 解析失败: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return parsed.data;
}

export function parseGenerateResult(raw: unknown, fallbackText: string): { prompt: string } {
  if (raw && typeof raw === "object" && "prompt" in (raw as Record<string, unknown>)) {
    const parsed = generateResultRawSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  if (fallbackText.trim()) return { prompt: fallbackText.trim() };
  throw new Error("Generate 解析失败: 缺少 prompt 字段");
}

export function parseJudgeResult(raw: unknown): { original: z.infer<typeof judgeSingleRawSchema>; improved: z.infer<typeof judgeSingleRawSchema> } {
  const parsed = judgeResultRawSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Judge 解析失败: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const fix = (s: z.infer<typeof judgeSingleRawSchema>) => ({
    ...s,
    total: s.context + s.specificity + s.constraints + s.taskClarity + s.outputFormat,
  });
  return { original: fix(parsed.data.original), improved: fix(parsed.data.improved) };
}
