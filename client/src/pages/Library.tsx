import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.ts";
import type { LearnedRule } from "@prompt-coach/shared";
import { RuleCard } from "../components/RuleCard.tsx";

type RuleWithMeta = LearnedRule & { _score?: number; _reasons?: string[] };

export function Library() {
  const [rules, setRules] = useState<RuleWithMeta[]>([]);
  const [q, setQ] = useState({ query: "", domain: "", tag: "" });
  const [status, setStatus] = useState<"default" | "confirmed" | "archived" | "draft" | "all">("default");
  const [busy, setBusy] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ title: "", promptRule: "", experience: "", tags: "", confidence: "medium" as LearnedRule["confidence"] });
  const [saveErr, setSaveErr] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const qs = { query: q.query || undefined, domain: q.domain || undefined, tag: q.tag || undefined, status: status === "default" ? undefined : status } as never;
      setRules(await api.listRules(qs));
    } catch (e: unknown) {
      setLoadError((e as Error).message);
    }
  }, [q.domain, q.query, q.tag, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">规则库</h1>
      <p className="text-sm text-slate-600 mt-1">默认仅显示已确认与已归档；草稿需在案例详情中查看或切换筛选后可见。Generate 仅使用已确认规则。</p>
      <div className="mt-3 flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3">
        <input value={q.query} onChange={(e) => setQ({ ...q, query: e.target.value })} placeholder="搜索" className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex-1 min-w-[160px]" />
        <input value={q.domain} onChange={(e) => setQ({ ...q, domain: e.target.value })} placeholder="领域 如 Embedded" className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-40" />
        <input value={q.tag} onChange={(e) => setQ({ ...q, tag: e.target.value })} placeholder="标签" className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32" />
        <select value={status} onChange={(e) => setStatus(e.target.value as never)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="default">已确认+已归档</option>
          <option value="confirmed">仅已确认</option>
          <option value="archived">仅已归档</option>
          <option value="draft">仅草稿</option>
          <option value="all">全部</option>
        </select>
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
                      setSaveErr("");
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
                      if (!confirm(`确定删除规则“${r.title}”？`)) return;
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
                <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="标题（1-200）" maxLength={200} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <p className="text-xs text-slate-400">{edit.title.length}/200 {edit.title.trim() ? "" : "· 标题不能为空"}</p>
                <textarea value={edit.experience} onChange={(e) => setEdit({ ...edit, experience: e.target.value })} placeholder="经验" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <textarea value={edit.promptRule} onChange={(e) => setEdit({ ...edit, promptRule: e.target.value })} placeholder="Prompt 规则" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="标签 逗号分隔 最多6个" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    <p className="text-xs text-slate-400 mt-1">{edit.tags.split(/[,，\s]+/).filter(Boolean).length}/6 标签 · 重复将自动去重</p>
                  </div>
                  <select value={edit.confidence} onChange={(e) => setEdit({ ...edit, confidence: e.target.value as never })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm h-[38px]">
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
                {saveErr && <p className="text-sm text-red-600 whitespace-pre-wrap">{saveErr}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSaveErr("");
                      const tags = [...new Set(edit.tags.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 6);
                      try {
                        await api.patchRule(r.id, {
                          title: edit.title,
                          experience: edit.experience,
                          promptRule: edit.promptRule,
                          tags,
                          confidence: edit.confidence,
                        });
                        setEditId(null);
                        await load();
                      } catch (e: unknown) {
                        setSaveErr((e as Error).message);
                      }
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
                  >
                    保存
                  </button>
                  <button onClick={() => { setEditId(null); setSaveErr(""); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm">
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
