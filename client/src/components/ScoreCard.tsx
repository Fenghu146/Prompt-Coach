import type { ScoreBreakdown } from "@prompt-coach/shared";

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-slate-600">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-slate-900" style={{ width: `${(value / 20) * 100}%` }} />
      </div>
      <span className="w-8 text-xs font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function ScoreCard({ title, score, heuristic }: { title: string; score: ScoreBreakdown; heuristic?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-lg font-bold text-slate-900">
          {score.total}
          <span className="text-sm font-normal text-slate-500">/100</span>
        </span>
      </div>
      {heuristic && <p className="text-xs text-slate-500 mb-3">启发式评分 · 仅代表 Prompt 信息完整度，非问题解决概率</p>}
      <div className="space-y-1.5">
        <Bar label="Context" value={score.context} />
        <Bar label="Specificity" value={score.specificity} />
        <Bar label="Constraints" value={score.constraints} />
        <Bar label="Task clarity" value={score.taskClarity} />
        <Bar label="Output format" value={score.outputFormat} />
      </div>
      {score.suggestions.length > 0 && (
        <ul className="mt-3 text-xs text-slate-600 list-disc pl-4 space-y-1">
          {score.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
