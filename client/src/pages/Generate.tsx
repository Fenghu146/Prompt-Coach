import { useState } from "react";
import { api } from "../api/client.ts";
import type { LearnedRule } from "@prompt-coach/shared";
import { CopyButton } from "../components/CopyButton.tsx";
import { RuleCard } from "../components/RuleCard.tsx";

export function Generate(){
  const [form,setForm]=useState({ problem:"", domain:"Embedded", context:"" });
  const [result,setResult]=useState<{prompt:string,retrievedRules:LearnedRule[],provider:string,usedEmbeddedFallback:boolean}|null>(null);
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  async function doGenerate(){
    setErr(""); setBusy(true);
    try{
      const r = await api.generate({ problem: form.problem, domain: form.domain||undefined, context: form.context||undefined });
      setResult(r);
    }catch(e:unknown){ setErr((e as Error).message); } finally{ setBusy(false); }
  }
  async function saveAsCase(){
    if(!result) return;
    setErr("");
    try{
      const c = await api.createCase({ title: form.problem.slice(0,40), domain: form.domain, problem: form.problem, originalPrompt: result.prompt, context: form.context||undefined, tags: [] });
      setErr(`已保存为新案例：${c.id}`);
    }catch(e:unknown){ setErr((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Generate</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <textarea value={form.problem} onChange={e=>setForm({...form,problem:e.target.value})} placeholder="输入新问题 — 如：STM32 I2C 读从机无响应" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
        <div className="flex gap-2">
          <input value={form.domain} onChange={e=>setForm({...form,domain:e.target.value})} placeholder="领域" className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-40"/>
          <input value={form.context} onChange={e=>setForm({...form,context:e.target.value})} placeholder="上下文（可选）" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <button onClick={doGenerate} disabled={!form.problem.trim()||busy} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">{busy?"生成中…":"生成 Prompt"}</button>
      </div>

      {result && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold text-slate-900">命中的历史规则（{result.retrievedRules.length}）</h2>
            {result.retrievedRules.length===0 ? <p className="text-sm text-amber-700 mt-2">本次未使用历史经验 — 积累案例并确认规则后将自动命中</p> : (
              <div className="mt-3 grid gap-2">
                {result.retrievedRules.map(r=><RuleCard key={r.id} rule={r}/>)}
              </div>
            )}
            {result.usedEmbeddedFallback && <p className="text-xs text-slate-500 mt-2">当前使用内嵌模型生成（未配置或 OpenAI 失败已回退）</p>}
            <p className="text-xs text-slate-400 mt-2">provider: {result.provider}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">最终 Prompt</h2>
              <div className="flex gap-2"><CopyButton text={result.prompt}/><button onClick={saveAsCase} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">保存为新案例</button></div>
            </div>
            <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">{result.prompt}</pre>
          </div>
        </>
      )}
      {err && <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-3">{err}</p>}
    </div>
  );
}
