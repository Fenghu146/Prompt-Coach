import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.ts";
import type { LearnedRule } from "@prompt-coach/shared";
import { RuleCard } from "../components/RuleCard.tsx";

export function Library() {
  const [rules, setRules] = useState<LearnedRule[]>([]);
  const [q, setQ] = useState({ query: "", domain: "", tag: "" });
  const [busy, setBusy] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ title: "", promptRule: "", experience: "", tags: "", confidence: "medium" as LearnedRule["confidence"] });
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setRules(await api.listRules({ query: q.query || undefined, domain: q.domain || undefined, tag: q.tag || undefined }));
    } catch (e: unknown) {
      setLoadError((e as Error).message);
    }
  }, [q.domain, q.query, q.tag]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">规则库</h1>
      <p className="text-sm text-slate-600 mt-1">已确认规则可被生成时检索，未确认草稿仅在案例详情中可见</p>
      <div className="mt-3 flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3">
        <input value={q.query} onChange={(e) => setQ({ ...q, query: e.target.value })} placeholder="搜索" className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex-1 min-w-[160px]" />
        <input value={q.domain} onChange={(e) => setQ({ ...q, domain: e.target.value })} placeholder="领域 如 Embedded" className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-40" />
        <input value={q.tag} onChange={(e) => setQ({ ...q, tag: e.target.value })} placeholder="标签" className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32" />
        <button onClick={load} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm">
          筛选
        </button>
      </div>
      {loadError && <p className="text-sm text-red-600 mt-2">加载失败：{loadError}</p>}
      <div className="mt-4 grid gap-3">
        {rules.length === 0 && !loadError && <p className="text-sm text-slate-500">暂无规则 — 从案例提取并确认后将出现在这里</p>}
        {rules.map((r) => (
          <div key={r.id}>
            <RuleCard
              rule={r}
              actions={
                <>
                  <button
                    onClick={() => {
                      setEditId(r.id);
                      setEdit({ title: r.title, promptRule: r.promptRule, experience: r.experience, tags: r.tags.join(", "), confidence: r.confidence });
                    }}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                  >
                    编辑
                  </button>
                  {r.status === "draft" && (
                    <button
                      onClick={async () => {
                        setBusy(r.id);
                        await api.patchRule(r.id, { status: "confirmed" });
                        await load();
                        setBusy("");
                      }}
                      disabled={busy === r.id}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm"
                    >
                      确认
                    </button>
                  )}
                  {r.status === "confirmed" && (
                    <button
                      onClick={async () => {
                        setBusy(r.id);
                        await api.patchRule(r.id, { status: "archived" });
                        await load();
                        setBusy("");
                      }}
                      disabled={busy === r.id}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                    >
                      归档
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      setBusy(r.id);
                      await api.deleteRule(r.id);
                      await load();
                      setBusy("");
                    }}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm"
                  >
                    删除
                  </button>
                </>
              }
            />
            {editId === r.id && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="标题" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <textarea value={edit.experience} onChange={(e) => setEdit({ ...edit, experience: e.target.value })} placeholder="经验" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <textarea value={edit.promptRule} onChange={(e) => setEdit({ ...edit, promptRule: e.target.value })} placeholder="Prompt 规则" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <div className="flex gap-2">
                  <input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="标签 逗号分隔" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  <select value={edit.confidence} onChange={(e) => setEdit({ ...edit, confidence: e.target.value as never })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await api.patchRule(r.id, {
                        title: edit.title,
                        experience: edit.experience,
                        promptRule: edit.promptRule,
                        tags: edit.tags
                          .split(/[,，\s]+/)
                          .filter(Boolean)
                          .slice(0, 6),
                        confidence: edit.confidence,
                      });
                      setEditId(null);
                      await load();
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
                  >
                    保存
                  </button>
                  <button onClick={() => setEditId(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
