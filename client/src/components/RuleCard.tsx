import type { LearnedRule } from "@prompt-coach/shared";
import { CONFIDENCE_LABELS } from "@prompt-coach/shared";
export function RuleCard({ rule, actions }: { rule: LearnedRule; actions?: React.ReactNode }){
  const badge = rule.status==="confirmed"?"bg-emerald-100 text-emerald-700":rule.status==="draft"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{rule.title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${badge}`}>{rule.status}</span>
      </div>
      {rule.domain && <p className="text-xs text-slate-500 mt-1">{rule.domain} · 置信度 {CONFIDENCE_LABELS[rule.confidence]}</p>}
      <p className="text-sm text-slate-700 mt-2"><span className="font-medium">经验：</span>{rule.experience}</p>
      <p className="text-sm text-slate-700 mt-1"><span className="font-medium">Prompt 规则：</span>{rule.promptRule}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {rule.tags.map(t=><span key={t} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{t}</span>)}
      </div>
      <p className="text-xs text-slate-400 mt-2">来源 {rule.sourceCaseIds.join(", ")} · {new Date(rule.createdAt).toLocaleString()}</p>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
