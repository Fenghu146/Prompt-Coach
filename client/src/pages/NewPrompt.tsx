import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client.ts";
import type { PromptCase } from "@prompt-coach/shared";

export function NewPrompt() {
  const nav = useNavigate();
  const [cases, setCases] = useState<PromptCase[]>([]);
  const [form, setForm] = useState({ title: "", domain: "Embedded", problem: "", originalPrompt: "", context: "", aiResult: "", tags: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setCases(await api.listCases());
    } catch (e: unknown) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const tags = form.tags
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
      const c = await api.createCase({
        title: form.title || form.problem.slice(0, 40) || "未命名案例",
        domain: form.domain,
        problem: form.problem,
        originalPrompt: form.originalPrompt,
        context: form.context || undefined,
        aiResult: form.aiResult || undefined,
        tags,
      });
      nav(`/cases/${c.id}`);
    } catch (ex: unknown) {
      setErr((ex as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <h1 className="text-xl font-bold text-slate-900">新建案例</h1>
        <p className="text-sm text-slate-600 mt-1">记录真实问题与原始提问，默认面向嵌入式调试。提交后在详情页执行优化与评分。</p>
        <form onSubmit={submit} className="mt-4 space-y-3 bg-white border border-slate-200 rounded-xl p-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="标题（可选，未填则取问题前40字）" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="领域 默认 Embedded" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="标签 逗号分隔 最多6个" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <textarea value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="问题 * — 如：STM32 UART DMA 收不到数据" rows={2} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <textarea value={form.originalPrompt} onChange={(e) => setForm({ ...form, originalPrompt: e.target.value })} placeholder="原始提问 * — 你原本写下的提示词" rows={3} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="上下文（可选）— 芯片/框架/外设/驱动模式/Buffer/API" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <textarea value={form.aiResult} onChange={(e) => setForm({ ...form, aiResult: e.target.value })} placeholder="AI 结果（可选）" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}
          <button disabled={loading} className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
            {loading ? "提交中…" : "创建案例并去优化"}
          </button>
        </form>
      </div>
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">最近案例</h2>
          <button onClick={load} className="text-xs text-slate-500 hover:text-slate-700">刷新</button>
        </div>
        {loadError && <p className="text-xs text-red-600 mt-2">加载失败：{loadError}</p>}
        <div className="mt-3 space-y-2">
          {cases.length === 0 && !loadError && <p className="text-sm text-slate-500">暂无案例 — 创建第一条后将出现在这里</p>}
          {cases.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} className="block bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300">
              <p className="font-medium text-sm text-slate-900">{c.title}</p>
              <p className="text-xs text-slate-500 mt-1">
                {c.domain} · {c.tags.join(", ")} · {new Date(c.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{c.problem}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
