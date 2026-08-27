import type { PromptCase, LearnedRule } from "@prompt-coach/shared";
import type { PromptCoachProvider, ImproveResult, JudgeResult, LearnResult, GenerateResult } from "./PromptCoachProvider.js";

function rid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function has(text: string, re: RegExp): boolean {
  return re.test(text);
}

function toScoreBreakdown(text: string, problem: string, ctx?: string): import("@prompt-coach/shared").ScoreBreakdown {
  const combined = `${text} ${problem} ${ctx || ""}`;

  // Context: chip/model/framework/OS/peripheral/buffer
  let contextScore = 5;
  if (has(combined, /stm32|f4\d+|f7\d+|h7\d+|c8t6|芯片|chip/i)) contextScore += 4;
  if (has(combined, /hal|ll库|freertos|rtos|bare metal|框架|framework|版本|v\d/i)) contextScore += 3;
  if (has(combined, /uart|dma|i2c|spi|buffer|fifo|中断|peripheral|外设/i)) contextScore += 3;
  if (has(combined, /波特率|baud|api|接收|发送|rx|tx/i)) contextScore += 2;
  contextScore = clamp(contextScore, 2, 20);
  if (text.trim().length < 30) contextScore = Math.min(contextScore, 10);
  if (text.trim().length < 15) contextScore = Math.min(contextScore, 6);

  // Specificity: Expected/Actual, repro steps, not vague
  let specificity = 5;
  if (has(combined, /expected|actual|期望|实际|现象|复现/i)) specificity += 5;
  if (has(combined, /步骤|复现|触发|条件|step|reproduce/i)) specificity += 3;
  if (has(text, /帮我看看|帮忙|看一下/)) specificity -= 4;
  if (text.trim().length > 40) specificity += 2;
  if (has(combined, /日志|log|数据|dump|trace/i)) specificity += 2;
  specificity = clamp(specificity, 2, 20);

  // Constraints: already investigated, forbidden
  let constraints = 5;
  if (has(combined, /已排查|已尝试|已检查|tried|investigated|排除/i)) constraints += 5;
  if (has(combined, /不要|禁止|不能|forbidden|must not|do not/i)) constraints += 3;
  if (has(combined, /约束|限制|边界|constraint/i)) constraints += 2;
  constraints = clamp(constraints, 2, 20);
  if (!has(combined, /已排查|tried|investigated|排除/)) constraints = Math.min(constraints, 10);

  // Task clarity: goal / priority / success criteria
  let taskClarity = 5;
  if (has(combined, /目标|目的|需要|要求|goal|task|任务/i)) taskClarity += 3;
  if (has(combined, /优先级|优先|排序|按可能性|priority/i)) taskClarity += 3;
  if (has(combined, /成功|验证|标准|success|criteria|验证方式/i)) taskClarity += 3;
  if (problem.trim().length > 15) taskClarity += 2;
  taskClarity = clamp(taskClarity, 2, 20);

  // Output format: desired format / verification
  let outputFormat = 5;
  if (has(combined, /输出|格式|json|表格|列表|format|output/i)) outputFormat += 4;
  if (has(combined, /验证|如何确认|check|verify/i)) outputFormat += 3;
  if (has(text, /角色|环境|任务|约束|结构|role|context|task/i)) outputFormat += 3;
  outputFormat = clamp(outputFormat, 2, 20);

  // Penalize long but empty structure: if no key fields, cap total
  const hasKeyField = has(combined, /stm32|芯片|f4\d+|uart|dma|i2c|spi/i) && has(combined, /expected|actual|期望|实际|已排查|验证/i);
  let totalScore = contextScore + specificity + constraints + taskClarity + outputFormat;
  if (!hasKeyField && totalScore > 70) totalScore = 70;
  const capped = hasKeyField ? totalScore : Math.min(totalScore, 70);
  if (capped !== totalScore) {
    const ratio = capped / totalScore;
    const adjust = (n: number) => clamp(Math.round(n * ratio), 2, 20);
    const adj = { context: adjust(contextScore), specificity: adjust(specificity), constraints: adjust(constraints), taskClarity: adjust(taskClarity), outputFormat: adjust(outputFormat) };
    const newTotal = adj.context + adj.specificity + adj.constraints + adj.taskClarity + adj.outputFormat;
    return { ...adj, total: newTotal, suggestions: buildSuggestions(adj, combined) };
  }

  return { context: contextScore, specificity, constraints, taskClarity, outputFormat, total: totalScore, suggestions: buildSuggestions({ context: contextScore, specificity, constraints, taskClarity, outputFormat }, combined) };
}

function buildSuggestions(scores: Record<string, number>, combined: string): string[] {
  const s: string[] = [];
  if (scores.context < 12) s.push("补充硬件/芯片/框架/操作系统等背景信息（需具体型号与版本）");
  if (scores.specificity < 12) s.push("明确 Expected 与 Actual 的具体差异及复现步骤");
  if (scores.constraints < 12) s.push("说明已排查内容与禁止事项，避免重复建议");
  if (scores.taskClarity < 12) s.push("明确任务目标、优先级与成功标准");
  if (scores.outputFormat < 12) s.push("指定期望的输出格式与验证方式");
  if (!/芯片|stm32|f4\d+/i.test(combined)) s.push("补充芯片型号与关键版本信息");
  if (!/expected|actual|期望|实际/i.test(combined)) s.push("补充 Expected / Actual 对比");
  return [...new Set(s)].slice(0, 4);
}

export class LocalEmbeddedProvider implements PromptCoachProvider {
  name = "local-embedded";

  async improve(input: { promptCase: PromptCase; retrievedRules: LearnedRule[] }): Promise<ImproveResult> {
    const { promptCase, retrievedRules } = input;
    const rulesHint = retrievedRules.length
      ? `\n\n[历史经验参考]\n${retrievedRules.map((r, i) => `${i + 1}. ${r.title}: ${r.promptRule}`).join("\n")}`
      : "";
    const content = [
      `# 角色`,
      `你是一名嵌入式开发助手，专注 STM32/UART/DMA/I2C 等调试。`,
      ``,
      `# 环境`,
      promptCase.context ? promptCase.context : "（请补充：芯片型号/框架/操作系统/外设与驱动模式）",
      ``,
      `# 问题`,
      promptCase.problem,
      ``,
      `# 已知信息`,
      `- 原始请求：${promptCase.originalPrompt}`,
      promptCase.aiResult ? `- 已有 AI 结果：${promptCase.aiResult.slice(0, 300)}` : `- 尚无 AI 结果`,
      ...(promptCase.debugLogs.length ? [`- 调试记录：${promptCase.debugLogs.map((l) => l.content).join("；").slice(0, 300)}`] : []),
      ...(promptCase.outcome ? [`- 结果反馈：${promptCase.outcome}`] : []),
      ...(retrievedRules.length ? [`- 已命中 ${retrievedRules.length} 条历史规则（见下方参考）`] : []),
      ``,
      `# 任务`,
      `1. 按可能性排序分析可能原因；2. 给出最小可验证的排查步骤与日志埋点；3. 再给出修复建议。`,
      ``,
      `# 约束`,
      `- 仅使用用户提供的事实，不编造硬件/版本信息`,
      `- 先诊断再改代码`,
      `- 区分 Expected 与 Actual`,
      ``,
      `# 输出格式`,
      `1) 可能原因（按概率排序，含依据） 2) 排查清单（可执行命令/日志点） 3) 修复建议（代码片段注明文件位置） 4) 验证方式`,
      rulesHint,
    ].join("\n");

    const reasons: string[] = [];
    if (!has(promptCase.originalPrompt, /角色|环境|任务|约束|输出|role|context|task|constraint|output/)) reasons.push("补充角色/环境/问题/任务/约束/输出格式的清晰结构");
    if (!has(promptCase.originalPrompt, /不要|禁止|约束|必须|不能|constraint|forbidden|must not/)) reasons.push("明确已排查内容与约束，避免重复建议");
    if (!has(promptCase.originalPrompt, /输出|格式|json|列表|表格|format|output/)) reasons.push("指定期望输出格式与验证方式，便于直接执行");
    if (!promptCase.context) reasons.push("补齐上下文（芯片/外设/驱动模式/Buffer/API）");
    if (retrievedRules.length) reasons.push(`融入 ${retrievedRules.length} 条历史经验，提升提问针对性`);
    while (reasons.length < 2) reasons.push("细化问题描述，区分 Expected/Actual");

    const missing: string[] = [];
    if (!promptCase.context) missing.push("芯片型号/时钟/框架/操作系统");
    if (!/uart|dma|i2c|spi/i.test(promptCase.problem + promptCase.originalPrompt)) missing.push("外设与驱动模式、Buffer 大小、接收 API");
    if (promptCase.debugLogs.length < 2) missing.push("调试过程与关键日志（当前仅 " + promptCase.debugLogs.length + " 条）");
    if (!promptCase.outcome) missing.push("结果反馈（是否已解决/部分解决）");
    missing.push("Expected 与 Actual 的具体差异、已排查步骤");

    return {
      improvedPrompt: {
        content,
        reasons: reasons.slice(0, 5),
        missingInformation: [...new Set(missing)].slice(0, 6),
        createdAt: new Date().toISOString(),
      },
      provider: this.name,
    };
  }

  async judge(input: { originalPrompt: string; improvedPrompt: string; problem: string; context?: string }): Promise<JudgeResult> {
    return {
      original: toScoreBreakdown(input.originalPrompt, input.problem, input.context),
      improved: toScoreBreakdown(input.improvedPrompt, input.problem, input.context),
    };
  }

  async learn(input: { promptCase: PromptCase }): Promise<LearnResult> {
    const c = input.promptCase;
    const domain = c.domain || "Embedded";
    const tags = [...new Set([...(c.tags || []), domain.toLowerCase(), "prompt-style"])].slice(0, 6);
    const debugSummary = c.debugLogs.length ? c.debugLogs.map((l) => l.content).join("；").slice(0, 300) : "无调试记录";
    const outcomeText = c.outcome ? `结果为 ${c.outcome}` : "尚未标记结果";
    const hasDma = /dma/i.test(c.problem + c.originalPrompt + (c.context || "") + debugSummary);
    const hasOutcomeSolved = c.outcome === "solved" || c.outcome === "helpful";

    let title: string;
    let promptRule: string;
    let experience: string;

    if (hasDma) {
      title = c.debugLogs.length ? "UART DMA 排查需结合已验证步骤" : "UART DMA 接收需明确外设与排查信息";
      experience = `在案例“${c.title}”中，问题为“${c.problem}”。调试过程：${debugSummary}。${outcomeText}。原始 Prompt 缺少结构化约束，补充后更易定位。`;
      promptRule = hasOutcomeSolved
        ? "下次提问 UART/DMA 相关问题时，明确芯片/外设/驱动模式/Buffer/API，并按时间线列出已排查项与日志，要求模型先基于已有排查给出诊断再改代码。"
        : "下次提问 UART/DMA 相关问题时，明确芯片/外设/驱动模式/Buffer/API，并列出 Expected/Actual 与已排查项，要求按可能性排序输出。";
    } else {
      const keyFromLogs = c.debugLogs.find((l) => /dma|uart|i2c|spi|时钟|配置|normal|circular/i.test(l.content));
      title = keyFromLogs ? `嵌入式排查：${keyFromLogs.content.slice(0, 24)}` : "嵌入式提问需结构化上下文与约束";
      experience = `在案例“${c.title}”中，问题“${c.problem}”，调试记录：${debugSummary}，${outcomeText}。${c.aiResult ? `AI 曾建议：${c.aiResult.slice(0, 120)}。` : ""}该信息帮助缩小了排查范围。`;
      promptRule = "下次提问时按 角色/环境/问题/已知信息/任务/约束/输出格式 组织，附上已排查项与 Expected/Actual，并要求先诊断再改代码。";
    }

    const confidence: LearnedRule["confidence"] = c.debugLogs.length >= 3 && hasOutcomeSolved ? "high" : c.debugLogs.length >= 2 && c.outcome ? "medium" : "low";

    const rule: LearnedRule = {
      id: rid("rule-"),
      title,
      domain,
      experience,
      promptRule,
      tags,
      confidence,
      status: "draft",
      sourceCaseIds: [c.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { rule };
  }

  async generate(input: { problem: string; domain?: string; context?: string; retrievedRules: LearnedRule[] }): Promise<GenerateResult> {
    const rules = input.retrievedRules;
    const hint = rules.length
      ? rules.map((r) => `- [${r.title}] ${r.promptRule}`).join("\n")
      : "（本次未使用历史经验 — 建议先积累案例后将自动命中）";
    const prompt = [
      `# 角色`,
      `嵌入式开发助手`,
      ``,
      `# 环境`,
      input.context || input.domain || "Embedded（请补充芯片/框架/外设）",
      ``,
      `# 问题`,
      input.problem,
      ``,
      `# 历史经验`,
      hint,
      ``,
      `# 任务`,
      `结合历史经验与当前事实，按可能性排序分析并给出可验证的排查与修复步骤。`,
      ``,
      `# 约束`,
      `仅使用用户事实；不编造；先诊断再改代码；区分 Expected/Actual`,
      ``,
      `# 输出格式`,
      `可能原因(排序) / 排查清单 / 修复建议 / 验证方式`,
    ].join("\n");
    return { prompt, retrievedRuleIds: rules.map((r) => r.id), provider: this.name };
  }
}
