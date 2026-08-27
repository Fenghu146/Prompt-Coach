import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.ts";
import type { SafeSettings } from "@prompt-coach/shared";
import { CHAT_MODEL_OPTIONS, EMBEDDED_MODEL_ID } from "@prompt-coach/shared";

export function Settings() {
  const [s, setS] = useState<SafeSettings | null>(null);
  const [form, setForm] = useState({ baseURL: "", apiKey: "", model: "", apiMode: "auto" as SafeSettings["apiMode"], timeoutMs: 30000 });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [loadError, setLoadError] = useState("");
  const [remote, setRemote] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const cur = await api.getSettings();
      setS(cur);
      setForm({ baseURL: cur.baseURL, apiKey: "", model: cur.model, apiMode: cur.apiMode, timeoutMs: cur.timeoutMs });
    } catch (e: unknown) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fetchModels() {
    setModelsLoading(true);
    try {
      const r = await api.listModels();
      setRemote(r.chat);
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    if (s?.hasApiKey) fetchModels();
  }, [s?.hasApiKey]);

  async function save() {
    setBusy("save");
    setMsg("");
    try {
      const body: Record<string, unknown> = { baseURL: form.baseURL, model: form.model, apiMode: form.apiMode, timeoutMs: form.timeoutMs };
      if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
      const cur = await api.saveSettings(body);
      setS(cur);
      setForm((f) => ({ ...f, apiKey: "" }));
      setMsg("已保存");
      if (cur.hasApiKey) fetchModels();
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function test() {
    setBusy("test");
    setMsg("");
    try {
      const r = await api.testSettings();
      setMsg(r.ok ? `连接成功 provider=${r.provider}` : `失败：${r.error}`);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const presetValues: string[] = CHAT_MODEL_OPTIONS.map((o) => o.value);
  const remoteExtra = remote.filter((id) => !presetValues.includes(id));
  const isCustom = form.model !== "" && !presetValues.includes(form.model) && !remote.includes(form.model);

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-700">加载失败：{loadError}</p>
        <button onClick={load} className="mt-2 px-3 py-1.5 border border-red-200 rounded-lg text-sm">重试</button>
      </div>
    );
  }
  if (!s) return <p className="text-sm text-slate-500">加载中…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">设置</h1>
      <p className="text-sm text-slate-600 mt-1">配置 OpenAI 兼容接口，未配置时自动使用内嵌模型；支持 DeepSeek（chat/completions）。</p>
      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-700">baseURL</label>
          <input value={form.baseURL} onChange={(e) => setForm({ ...form, baseURL: e.target.value })} placeholder="https://api.openai.com/v1 或 https://api.deepseek.com" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">
            apiKey {s.hasApiKey && <span className="text-slate-500">（已配置：{s.apiKeyMasked}，留空不改）</span>}
          </label>
          <input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={s.hasApiKey ? "留空保留原 Key" : "sk-..."} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">对话模型（chat）</label>
          <div className="relative mt-1">
            <select
              value={isCustom ? "__custom__" : form.model}
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "__custom__") setForm({ ...form, model: v });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white appearance-none pr-8"
            >
              <option value="">选择或输入</option>
              {CHAT_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {o.value === EMBEDDED_MODEL_ID ? " — 零 Token/离线可用" : ""}
                </option>
              ))}
              {remoteExtra.map((id) => (
                <option key={id} value={id}>
                  {id}（来自 API）
                </option>
              ))}
              {isCustom && <option value="__custom__">{form.model}（自定义）</option>}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
          </div>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="可手动输入模型名，如 deepseek-chat / gpt-4o-mini" className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          {form.model === EMBEDDED_MODEL_ID && <p className="text-xs text-slate-500 mt-1">已选择本地内嵌，不消耗 Token，离线可用</p>}
          {/deepseek/i.test(form.model) && <p className="text-xs text-slate-500 mt-1">DeepSeek 仅支持 chat/completions，已自动优化为低延迟/低 Token 配置</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchModels} disabled={modelsLoading || !s.hasApiKey} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs disabled:opacity-50">
            {modelsLoading ? "拉取中…" : "刷新模型列表"}
          </button>
          <span className="text-xs text-slate-500">通过 GET /v1/models 拉取，未配置 Key 时显示本地预设</span>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">apiMode</label>
          <select value={form.apiMode} onChange={(e) => setForm({ ...form, apiMode: e.target.value as never })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="auto">auto（DeepSeek 自动走 chat）</option>
            <option value="chat">chat</option>
            <option value="responses">responses</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">timeoutMs</label>
          <input type="number" value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy === "save"} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">
            {busy === "save" ? "保存中…" : "保存"}
          </button>
          <button onClick={test} disabled={busy === "test"} className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50">
            {busy === "test" ? "测试中…" : "测试连接"}
          </button>
        </div>
        {msg && <p className="text-sm whitespace-pre-wrap p-3 rounded-lg border bg-slate-50 border-slate-200">{msg}</p>}
        <p className="text-xs text-amber-700">Key 将明文写入本地文件 server/data/settings.json（已在 .gitignore 中排除），请勿提交到仓库。未配置或测试失败时将自动回退内嵌模型。</p>
      </div>
    </div>
  );
}
