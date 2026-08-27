import type { LearnedRule } from "@prompt-coach/shared";
import { CONFIDENCE_LABELS } from "@prompt-coach/shared";
export function RuleCard({ rule, actions, reasons }: { rule: LearnedRule & { _reasons?: string[]; _score?: number }; actions?: React.ReactNode; reasons?: string[] }){
  const showReasons = reasons ?? (rule as unknown as { _reasons?: string[] })._reasons;
  const score = (rule as unknown as { _score?: number })._score;
  const badge = rule.status==="confirmed"?"bg-emerald-100 text-emerald-700":rule.status==="draft"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{rule.title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${badge}`}>{rule.status}{typeof score==="number"?` · ${score}分`:""}</span>
      </div>
      {rule.domain && <p className="text-xs text-slate-500 mt-1">{rule.domain} · 置信度 {CONFIDENCE_LABELS[rule.confidence]}</p>}
      <p className="text-sm text-slate-700 mt-2"><span className="font-medium">经验：</span>{rule.experience}</p>
      <p className="text-sm text-slate-700 mt-1"><span className="font-medium">Prompt 规则：</span>{rule.promptRule}</p>
      {showReasons && showReasons.length>0 && (
        <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">命中原因：{showReasons.join(" · ")}</p>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {rule.tags.map(t=><span key={t} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{t}</span>)}
      </div>
      <details className="mt-2">
        <summary className="text-xs text-slate-400 cursor-pointer">调试信息</summary>
        <p className="text-xs text-slate-400 mt-1">来源 {rule.sourceCaseIds.join(", ")} · {new Date(rule.createdAt).toLocaleString()} · id {rule.id}</p>
      </details>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
