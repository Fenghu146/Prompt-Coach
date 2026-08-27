import { useState } from "react";
import type { ImprovedPrompt, LearnedRule } from "@prompt-coach/shared";
import { CopyButton } from "./CopyButton.tsx";
import { RuleCard } from "./RuleCard.tsx";

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg">
        <span>{title}</span>
        <span className="text-xs text-slate-500">{open ? "收起" : "展开"}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function splitPrompt(content: string): { label: string; body: string }[] {
  const parts = content.split(/^#\s+/m).filter(Boolean);
  if (parts.length <= 1) return [{ label: "Prompt", body: content }];
  return parts.map((p) => {
    const lines = p.split("\n");
    const label = lines[0]?.trim() || "段落";
    const body = lines.slice(1).join("\n").trim();
    return { label, body };
  });
}

export function ImproveResultCard({
  improved,
  retrievedRuleIds,
  allRules,
}: {
  improved: ImprovedPrompt;
  retrievedRuleIds: string[];
  allRules: LearnedRule[];
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const sections = splitPrompt(improved.content);
  const usedRules = retrievedRuleIds.map((id) => allRules.find((r) => r.id === id)).filter(Boolean) as LearnedRule[];
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-3">
      {usedRules.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-900">已使用 {usedRules.length} 条历史经验</p>
          <div className="mt-2 grid gap-2">
            {usedRules.map((r) => (
              <RuleCard key={r.id} rule={r} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">本次未使用历史经验 · 积累并确认规则后将自动命中</p>
      )}

      <div className="flex items-center justify-between">
        <p className="font-medium text-sm">优化后 Prompt</p>
        <CopyButton text={improved.content} />
      </div>

      <div className="space-y-2">
        {(showAll ? sections : sections.slice(0, 3)).map((s, i) => (
          <div key={i} className="border border-slate-200 rounded-lg">
            <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50">
              <span className="text-sm font-medium text-slate-900">{s.label}</span>
              <span className="text-xs text-slate-500">{expandedIdx === i ? "收起" : "展开"}</span>
            </button>
            {expandedIdx === i && <pre className="px-3 pb-3 text-xs bg-slate-50 rounded-b-lg whitespace-pre-wrap">{s.body || "（空）"}</pre>}
          </div>
        ))}
      </div>
      {sections.length > 3 && (
        <button onClick={() => setShowAll((v) => !v)} className="text-xs text-slate-600 hover:text-slate-900">
          {showAll ? "收起" : `展开全部（${sections.length} 段）`}
        </button>
      )}

      <Section title={`改动原因（${improved.reasons.length}）`} defaultOpen>
        <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
          {improved.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Section>

      {improved.missingInformation.length > 0 && (
        <Section title={`缺失信息（${improved.missingInformation.length}）`} defaultOpen>
          <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
            {improved.missingInformation.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-xs font-medium text-slate-700">下一步</p>
        <p className="text-xs text-slate-600 mt-1">补充缺失信息 → 重新优化 → 复制 Prompt → 开始实际调试 → 回来追加 Debug Log 与结果反馈</p>
      </div>
    </div>
  );
}
