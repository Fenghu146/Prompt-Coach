import type { PromptCase, LearnedRule } from "@prompt-coach/shared";
import type { PromptCoachProvider, ImproveResult, JudgeResult, GenerateResult, LearnResult } from "./PromptCoachProvider.js";
import type { Settings } from "@prompt-coach/shared";
import { parseGenerateResult, parseImproveResult, parseJudgeResult, parseLearnResult } from "@prompt-coach/shared";

function rid(prefix = "") {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

async function callChat(settings: Settings, messages: { role: string; content: string }[], timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const isDeepSeek = /deepseek/i.test(settings.model);
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: 0.2,
      max_tokens: 1200,
    };
    if (isDeepSeek) {
      (body as Record<string, unknown>).top_p = 0.9;
    }
    const res = await fetch(`${settings.baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`chat/completions ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    return j.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(t);
  }
}

async function callResponses(settings: Settings, input: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${settings.baseURL.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({ model: settings.model, input, max_output_tokens: 1200 }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`responses ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { output_text?: string; output?: { content: { text: string }[] }[] };
    if (j.output_text) return j.output_text;
    const txt = j.output?.flatMap((o) => o.content || []).map((c) => c.text).join("\n");
    return txt || JSON.stringify(j);
  } finally {
    clearTimeout(t);
  }
}

async function callLLM(settings: Settings, systemPrompt: string, userPrompt: string): Promise<string> {
  const timeoutMs = settings.timeoutMs || 30000;
  if (/deepseek/i.test(settings.model)) {
    return callChat(settings, [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], timeoutMs);
  }
  if (settings.apiMode === "responses") return callResponses(settings, `${systemPrompt}\n\n${userPrompt}`, timeoutMs);
  if (settings.apiMode === "chat") return callChat(settings, [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], timeoutMs);
  try {
    return await callResponses(settings, `${systemPrompt}\n\n${userPrompt}`, timeoutMs);
  } catch {
    return await callChat(settings, [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], timeoutMs);
  }
}

const IMPROVE_SYSTEM = `你是 Prompt Coach 的优化助手。只使用用户提供的事实，不编造。输出严格 JSON：{"content":string, "reasons":string[<=5], "missingInformation":string[]}。content 需按 角色/环境/问题/已知信息/任务/约束/输出格式 结构化，控制在 800 字以内，简洁可执行。`;
const JUDGE_SYSTEM = `你是 Prompt 质量评分助手。按5维各0-20打分：context,specificity,constraints,taskClarity,outputFormat，total为5项之和。输出严格 JSON：{"original":{"context":n,"specificity":n,"constraints":n,"taskClarity":n,"outputFormat":n,"total":n,"suggestions":string[<=3]}, "improved":{...}}。建议简短。`;
const LEARN_SYSTEM = `你是 Prompt Coach 的规则提取助手。从案例归纳一条可复用规则，必须基于调试过程与实际结果。输出严格 JSON：{"title":string,"domain":string,"experience":string,"promptRule":string,"tags":string[<=6],"confidence":"low"|"medium"|"high"}。experience 150字以内，promptRule 描述未来 Prompt 如何写。`;
const GENERATE_SYSTEM = `你是 Prompt Coach 的生成助手。结合历史经验与当前问题生成最终可复制 Prompt，控制在 600 字以内。输出严格 JSON：{"prompt":string}`;

async function callWithRepair(
  settings: Settings,
  systemPrompt: string,
  userPrompt: string,
  parse: (raw: unknown, text: string) => unknown,
): Promise<unknown> {
  let text = await callLLM(settings, systemPrompt, userPrompt);
  let parsed = safeJsonParse(text);
  if (parsed !== null) {
    try {
      return parse(parsed, text);
    } catch {
      // fall through to repair
    }
  }
  text = await callLLM(settings, systemPrompt, `${userPrompt}\n请只输出合法 JSON，不要附加解释或 Markdown。`);
  parsed = safeJsonParse(text);
  if (parsed === null) throw new Error(`模型返回非 JSON: ${text.slice(0, 500)}`);
  return parse(parsed, text);
}

export class OpenAICompatibleProvider implements PromptCoachProvider {
  name = "openai-compatible";
  constructor(private settings: Settings) {}
  async improve(input: { promptCase: PromptCase; retrievedRules: LearnedRule[] }): Promise<ImproveResult> {
    const c = input.promptCase;
    const rulesHint = input.retrievedRules.length ? `历史规则：\n${input.retrievedRules.map((r) => `- ${r.title}: ${r.promptRule}`).join("\n")}` : "无历史规则";
    const user =
      `问题：${truncate(c.problem, 500)}\n原始Prompt：${truncate(c.originalPrompt, 600)}\n上下文：${truncate(c.context || "无", 400)}\nAI结果：${truncate(c.aiResult || "无", 400)}\n` +
      `优化后Prompt：${c.improvedPrompt?.content ? truncate(c.improvedPrompt.content, 400) : "无"}\n` +
      `Debug Logs：${c.debugLogs.length ? truncate(c.debugLogs.map((l) => `- ${l.content}`).join("\n"), 600) : "无"}\n` +
      `Outcome：${c.outcome || "无"}\n${truncate(rulesHint, 400)}`;
    const result = (await callWithRepair(this.settings, IMPROVE_SYSTEM, user, (raw) => parseImproveResult(raw))) as {
      content: string;
      reasons: string[];
      missingInformation: string[];
    };
    return {
      improvedPrompt: { content: result.content, reasons: result.reasons.slice(0, 5), missingInformation: result.missingInformation || [], createdAt: new Date().toISOString() },
      provider: this.name,
    };
  }
  async judge(input: { originalPrompt: string; improvedPrompt: string; problem: string; context?: string }): Promise<JudgeResult> {
    const user = `problem:${truncate(input.problem, 300)}\ncontext:${truncate(input.context || "无", 200)}\noriginalPrompt:${truncate(input.originalPrompt, 400)}\nimprovedPrompt:${truncate(input.improvedPrompt, 400)}`;
    const result = (await callWithRepair(this.settings, JUDGE_SYSTEM, user, (raw) => parseJudgeResult(raw))) as JudgeResult;
    return result;
  }
  async learn(input: { promptCase: PromptCase }): Promise<LearnResult> {
    const c = input.promptCase;
    const debugText = c.debugLogs.length ? truncate(c.debugLogs.map((l) => `- ${l.content}`).join("\n"), 600) : "（无调试记录）";
    const user =
      `标题：${c.title}\n领域：${c.domain || "Embedded"}\n问题：${truncate(c.problem, 400)}\n原始Prompt：${truncate(c.originalPrompt, 400)}\n上下文：${truncate(c.context || "无", 300)}\n` +
      `AI结果：${truncate(c.aiResult || "无", 300)}\n优化Prompt：${c.improvedPrompt?.content ? truncate(c.improvedPrompt.content, 400) : "无"}\n` +
      `Debug Logs：\n${debugText}\nOutcome：${c.outcome || "无"}\nJudge：${c.judge ? `Original ${c.judge.original.total} / Improved ${c.judge.improved.total}` : "无"}\n` +
      `tags:${c.tags.join(",")}\n请基于以上完整材料提取一条可复用规则，experience 必须概括本次实际发生了什么、什么信息有帮助，promptRule 需指导下次如何提问。`;
    const p = (await callWithRepair(this.settings, LEARN_SYSTEM, user, (raw) => parseLearnResult(raw))) as {
      title: string;
      domain?: string;
      experience: string;
      promptRule: string;
      tags: string[];
      confidence: "low" | "medium" | "high";
    };
    return {
      rule: {
        id: rid("rule-"),
        title: p.title,
        domain: p.domain || c.domain || "Embedded",
        experience: p.experience,
        promptRule: p.promptRule,
        tags: (p.tags || []).slice(0, 6),
        confidence: p.confidence || (c.debugLogs.length < 2 || !c.outcome ? "low" : "medium"),
        status: "draft",
        sourceCaseIds: [c.id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
  async generate(input: { problem: string; domain?: string; context?: string; retrievedRules: LearnedRule[] }): Promise<GenerateResult> {
    const hint = input.retrievedRules.length ? truncate(input.retrievedRules.map((r) => `- ${r.title}: ${r.promptRule}`).join("\n"), 500) : "无历史规则，请仍生成但提示未使用历史经验";
    const user = `问题：${truncate(input.problem, 400)}\n领域：${truncate(input.domain || "Embedded", 100)}\n上下文：${truncate(input.context || "无", 300)}\n历史经验：\n${hint}`;
    const p = (await callWithRepair(this.settings, GENERATE_SYSTEM, user, (raw, text) => parseGenerateResult(raw, text))) as { prompt: string };
    return { prompt: p.prompt, retrievedRuleIds: input.retrievedRules.map((r) => r.id), provider: this.name };
  }
}
