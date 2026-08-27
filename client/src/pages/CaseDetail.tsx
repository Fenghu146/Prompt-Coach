import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.ts";
import type { PromptCase, LearnedRule } from "@prompt-coach/shared";
import { OUTCOME_LABELS } from "@prompt-coach/shared";
import { CopyButton } from "../components/CopyButton.tsx";
import { ScoreCard } from "../components/ScoreCard.tsx";
import { RuleCard } from "../components/RuleCard.tsx";
import { ImproveResultCard } from "../components/ImproveResultCard.tsx";

export function CaseDetail() {
  const { id } = useParams();
  const [c, setC] = useState<PromptCase | null>(null);
  const [rules, setRules] = useState<LearnedRule[]>([]);
  const [allRules, setAllRules] = useState<LearnedRule[]>([]);
  const [logText, setLogText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [draftRule, setDraftRule] = useState<LearnedRule | null>(null);
  const [outcome, setOutcome] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retrievedIds, setRetrievedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError("");
    try {
      const cc = await api.getCase(id);
      setC(cc);
      setOutcome(cc.outcome || "");
      const all = await api.listRules({ status: "all" });
      setAllRules(all);
      setRules(all.filter((r) => r.sourceCaseIds.includes(cc.id)));
      const d = all.find((r) => r.sourceCaseIds.includes(cc.id) && r.status === "draft");
      setDraftRule(d || null);
    } catch (e: unknown) {
      setLoadError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-700">加载失败：{loadError}</p>
        <button onClick={load} className="mt-2 px-3 py-1.5 border border-red-200 rounded-lg text-sm">
          重试
        </button>
      </div>
    );
  }
  if (!c) return <p className="text-sm text-slate-500">加载中…</p>;

  async function act(fn: () => Promise<void>, key: string) {
    setBusy(key);
    setErr("");
    try {
      await fn();
      await load();
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const lowMaterial = c.debugLogs.length < 2 || !c.outcome;

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
        ← 返回
      </Link>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h1 className="text-lg font-bold text-slate-900">{c.title}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {c.domain} · {c.tags.join(", ")} · {new Date(c.createdAt).toLocaleString()}
        </p>
        {c.generatedFromRuleIds?.length ? (
          <p className="text-xs text-amber-700 mt-1">由 Generate 生成 · 引用规则：{c.generatedFromRuleIds.join(", ")}</p>
        ) : null}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-medium">问题</p>
            <p className="text-slate-700 whitespace-pre-wrap">{c.problem}</p>
          </div>
          <div>
            <p className="font-medium">原始提问（用户原始写法）</p>
            <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-2">{c.originalPrompt}</p>
          </div>
        </div>
        {c.context && (
          <p className="text-sm mt-2">
            <span className="font-medium">上下文：</span>
            {c.context}
          </p>
        )}
        {c.aiResult && (
          <p className="text-sm mt-1">
            <span className="font-medium">AI 结果：</span>
            {c.aiResult}
          </p>
        )}
        {c.improvedPrompt && (
          <p className="text-sm mt-1">
            <span className="font-medium">生成/优化 Prompt：</span>
            <span className="text-slate-600">已生成，可在下方查看详情</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
            <option value="">选择结果反馈</option>
            {(Object.entries(OUTCOME_LABELS) as [string, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v} ({k})
              </option>
            ))}
          </select>
          <button onClick={() => act(async () => { await api.patchCase(c.id, { outcome: outcome || undefined }); }, "outcome")} disabled={busy === "outcome"} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm">
            保存反馈
          </button>
          {c.outcome && <span className="text-xs text-slate-600">当前：{OUTCOME_LABELS[c.outcome as never] || c.outcome}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-900">优化 Prompt</h2>
          <p className="text-xs text-slate-500 mt-1">基于当前案例与已确认规则生成结构化 Prompt</p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={() => act(async () => {
                const r = await api.improve(c.id);
                setRetrievedIds(r.retrievedRuleIds || []);
              }, "improve")} disabled={busy === "improve"} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">
              {busy === "improve" ? "优化中…" : "优化 Prompt"}
            </button>
            <button onClick={() => act(() => api.judge(c.id).then(() => {}), "judge")} disabled={!c.improvedPrompt || busy === "judge"} className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50">
              {busy === "judge" ? "评分中…" : "对比评分"}
            </button>
            {c.judge && <button onClick={() => act(() => api.judge(c.id).then(() => {}), "rejude")} disabled={busy==="rejude"} className="px-3 py-2 border border-slate-200 rounded-lg text-xs">重新生成评分</button>}
            {c.improvedPrompt && <button onClick={() => act(async () => { await api.patchCase(c.id, { outcome: undefined } as never); setC({ ...c, judge: undefined } as never); }, "clearJudge")} className="px-3 py-2 border border-slate-200 rounded-lg text-xs">清除旧结果</button>}
          </div>
          {c.improvedPrompt ? (
            <div className="mt-4">
              <ImproveResultCard improved={c.improvedPrompt} retrievedRuleIds={retrievedIds.length ? retrievedIds : (c as unknown as { retrievedRuleIds?: string[] }).retrievedRuleIds || []} allRules={allRules} />
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-3">尚未优化 — 点击“优化 Prompt”生成</p>
          )}
        </div>

        <div className="space-y-3">
          {c.judge ? (
            <>
              <p className="text-xs text-slate-500">启发式对比 · 分数仅代表信息完整度</p>
              <ScoreCard title="优化前" score={c.judge.original} heuristic />
              <ScoreCard title="优化后" score={c.judge.improved} heuristic />
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500">评分将在优化后可用</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-slate-900">调试记录（时间线）</h2>
        <div className="mt-3 flex gap-2">
          <input value={logText} onChange={(e) => setLogText(e.target.value)} placeholder="追加一条调试记录…" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <button onClick={() => act(async () => { await api.addLog(c.id, logText); setLogText(""); }, "log")} disabled={!logText.trim() || busy === "log"} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">
            追加
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {c.debugLogs.length === 0 && <p className="text-xs text-slate-500">暂无记录 — 建议记录排查步骤与验证结果，越多越有助于提取有效规则</p>}
          {c.debugLogs.map((l) => (
            <div key={l.id} className="border-l-2 border-slate-200 pl-3 py-1">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{l.content}</p>
              <p className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-slate-900">提取经验规则</h2>
        {lowMaterial && <p className="text-xs text-amber-700 mt-1">当前材料较少（{c.debugLogs.length} 条记录，{c.outcome ? "已标记反馈" : "未标记反馈"}），规则可信度可能较低，建议补充后再提取</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() =>
              act(async () => {
                try {
                  await api.learn(c.id);
                } catch (e: unknown) {
                  const msg = (e as Error).message;
                  if (msg.includes("draft already exists")) {
                    setErr(`已存在草稿：${msg}。如需新版本，请先丢弃旧草稿或在服务端使用 forceNew。`);
                    throw e;
                  }
                  throw e;
                }
              }, "learn")
            }
            disabled={busy === "learn"}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {busy === "learn" ? "提取中…" : "提取规则草稿"}
          </button>
          <button
            onClick={() =>
              act(async () => {
                const res = await fetch(`/api/cases/${c.id}/learn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ forceNew: true }) });
                if (!res.ok) throw new Error(await res.text());
              }, "learnForce")
            }
            disabled={busy === "learnForce"}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
          >
            {busy === "learnForce" ? "生成中…" : "生成新版本"}
          </button>
        </div>
        {draftRule ? (
          <div className="mt-3">
            <RuleCard
              rule={draftRule}
              actions={
                <>
                  <button onClick={() => act(() => api.confirmRule(c.id, draftRule.id).then(() => {}), "confirm")} disabled={busy === "confirm"} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">
                    确认并保存
                  </button>
                  <button onClick={() => { if (!confirm("确定丢弃该草稿？")) return; act(() => api.discardRule(c.id, draftRule.id).then(() => {}), "discard"); }} disabled={busy === "discard"} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
                    丢弃
                  </button>
                  <CopyButton text={`${draftRule.title}\n\n经验：${draftRule.experience}\n\n规则：${draftRule.promptRule}`} />
                </>
              }
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500 mt-3">暂无草稿 — 点击提取生成一条规则（草稿需确认后才进入 Library）</p>
        )}
        {rules.filter((r) => r.status === "confirmed").length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">已确认规则</p>
            {rules
              .filter((r) => r.status === "confirmed")
              .map((r) => (
                <RuleCard key={r.id} rule={r} />
              ))}
          </div>
        )}
      </div>

      {err && <p className="text-sm text-red-600 whitespace-pre-wrap bg-red-50 border border-red-200 rounded-lg p-3">{err}</p>}
    </div>
  );
}
