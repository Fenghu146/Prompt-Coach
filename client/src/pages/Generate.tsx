import { useState } from "react";
import { api } from "../api/client.ts";
import type { LearnedRule } from "@prompt-coach/shared";
import { CopyButton } from "../components/CopyButton.tsx";
import { RuleCard } from "../components/RuleCard.tsx";

type RetrievedRule = LearnedRule & { _reasons?: string[]; _score?: number };

export function Generate() {
  const [form, setForm] = useState({ problem: "", domain: "Embedded", context: "" });
  const [result, setResult] = useState<{ prompt: string; retrievedRules: RetrievedRule[]; provider: string; usedEmbeddedFallback: boolean; fallbackReason?: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function doGenerate() {
    setErr("");
    const trimmed = form.problem.trim();
    const domainTrim = form.domain.trim();
    const ctxTrim = form.context.trim();
    if (!trimmed) { setErr("请输入问题"); return; }
    if (form.domain && form.domain.length > 40) { setErr("领域过长（≤40）"); return; }
    setBusy(true);
    try {
      const r = await api.generate({ problem: trimmed, domain: domainTrim || undefined, context: ctxTrim || undefined });
      setResult(r as never);
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAsCase() {
    if (!result) return;
    setErr("");
    try {
      const c = await api.createCase({
        title: form.problem.slice(0, 40),
        domain: form.domain.trim() || "Embedded",
        problem: form.problem.trim(),
        originalPrompt: form.problem.trim(),
        improvedPrompt: {
          content: result.prompt,
          reasons: result.retrievedRules.length ? [`应用了 ${result.retrievedRules.length} 条历史经验`] : ["基于当前问题生成，未命中历史经验"],
          missingInformation: [],
          createdAt: new Date().toISOString(),
        },
        generatedFromRuleIds: result.retrievedRules.map((r) => r.id),
        context: form.context.trim() || undefined,
        tags: [],
      });
      setErr(`已保存为新案例：${c.id}（原始提问保留在 Original Prompt，生成结果在优化 Prompt，可继续补充 AI 结果与调试记录）`);
    } catch (e: unknown) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">生成 Prompt</h1>
      <p className="text-sm text-slate-600">输入新问题，系统检索已确认规则后生成可复制 Prompt，并可保存为新案例继续完善。</p>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <textarea value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="输入新问题 — 如：STM32 I2C 读从机无响应" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" maxLength={500} />
        <p className="text-xs text-slate-400">{form.problem.length}/500</p>
        <div className="flex gap-2">
          <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="领域" maxLength={40} className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-40" />
          <input value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="上下文（可选）" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <button onClick={doGenerate} disabled={!form.problem.trim() || busy} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">
          {busy ? "生成中…" : "生成 Prompt"}
        </button>
      </div>

      {result && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold text-slate-900">命中的历史规则（{result.retrievedRules.length}）</h2>
            {result.retrievedRules.length === 0 ? (
              <p className="text-sm text-amber-700 mt-2">本次未使用历史经验 — 积累案例并确认规则后将自动命中</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {result.retrievedRules.map((r) => (
                  <RuleCard key={r.id} rule={r} />
                ))}
              </div>
            )}
            {result.usedEmbeddedFallback && <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">已回退到内嵌模型：{result.fallbackReason || "未配置或 OpenAI 失败"} — 生成仍可用，但可能不如线上模型精准</p>}
            <details className="mt-2"><summary className="text-xs text-slate-400 cursor-pointer">调试信息</summary><p className="text-xs text-slate-400 mt-1">provider: {result.provider}</p></details>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">最终 Prompt</h2>
              <div className="flex gap-2">
                <CopyButton text={result.prompt} />
                <button onClick={saveAsCase} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm">
                  保存为新案例
                </button>
              </div>
            </div>
            <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-96 overflow-auto">{result.prompt}</pre>
            <p className="text-xs text-slate-500 mt-2">保存后可在案例详情中补充 AI 结果、Debug Log 与结果反馈，形成闭环</p>
          </div>
        </>
      )}
      {err && <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-3">{err}</p>}
    </div>
  );
}
