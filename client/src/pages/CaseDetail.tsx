import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.ts";
import type { PromptCase, LearnedRule } from "@prompt-coach/shared";
import { OUTCOME_LABELS } from "@prompt-coach/shared";
import { CopyButton } from "../components/CopyButton.tsx";
import { ScoreCard } from "../components/ScoreCard.tsx";
import { RuleCard } from "../components/RuleCard.tsx";

export function CaseDetail(){
  const { id }=useParams();
  const [c,setC]=useState<PromptCase|null>(null);
  const [rules,setRules]=useState<LearnedRule[]>([]);
  const [logText,setLogText]=useState("");
  const [busy,setBusy]=useState("");
  const [err,setErr]=useState("");
  const [draftRule,setDraftRule]=useState<LearnedRule|null>(null);
  const [outcome,setOutcome]=useState("");

  async function load(){
    if(!id) return;
    const cc = await api.getCase(id);
    setC(cc);
    setOutcome(cc.outcome||"");
    const all = await api.listRules();
    setRules(all.filter(r=>r.sourceCaseIds.includes(cc.id)));
    const d = all.find(r=>r.sourceCaseIds.includes(cc.id) && r.status==="draft");
    setDraftRule(d||null);
  }
  useEffect(()=>{ load(); },[id]);

  if(!c) return <p className="text-sm text-slate-500">加载中…</p>;

  async function act(fn:()=>Promise<void>, key:string){
    setBusy(key); setErr("");
    try{ await fn(); await load(); } catch(e:unknown){ setErr((e as Error).message); } finally{ setBusy(""); }
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">← 返回</Link>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h1 className="text-lg font-bold text-slate-900">{c.title}</h1>
        <p className="text-xs text-slate-500 mt-1">{c.domain} · {c.tags.join(", ")} · {new Date(c.createdAt).toLocaleString()}</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><p className="font-medium">问题</p><p className="text-slate-700 whitespace-pre-wrap">{c.problem}</p></div>
          <div><p className="font-medium">Original Prompt</p><p className="text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-2">{c.originalPrompt}</p></div>
        </div>
        {c.context && <p className="text-sm mt-2"><span className="font-medium">上下文：</span>{c.context}</p>}
        {c.aiResult && <p className="text-sm mt-1"><span className="font-medium">AI 结果：</span>{c.aiResult}</p>}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select value={outcome} onChange={e=>setOutcome(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
            <option value="">选择 Outcome</option>
            {(Object.entries(OUTCOME_LABELS) as [string,string][]).map(([k,v])=><option key={k} value={k}>{v} ({k})</option>)}
          </select>
          <button onClick={()=>act(async()=>{ await api.patchCase(c.id,{outcome: outcome||undefined}); }, "outcome")} disabled={busy==="outcome"} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm">保存 Outcome</button>
          {c.outcome && <span className="text-xs text-slate-600">当前：{OUTCOME_LABELS[c.outcome as never]||c.outcome}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-900">Improve Prompt</h2>
          <div className="mt-3 flex gap-2">
            <button onClick={()=>act(()=>api.improve(c.id).then(()=>{}),"improve")} disabled={busy==="improve"} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">{busy==="improve"?"优化中…":"Improve Prompt"}</button>
            <button onClick={()=>act(()=>api.judge(c.id).then(()=>{}),"judge")} disabled={!c.improvedPrompt || busy==="judge"} className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50">{busy==="judge"?"评分中…":"Judge"}</button>
          </div>
          {c.improvedPrompt ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between"><p className="font-medium text-sm">优化后 Prompt</p><CopyButton text={c.improvedPrompt.content}/></div>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">{c.improvedPrompt.content}</pre>
              {c.improvedPrompt.reasons.length>0 && <div><p className="text-xs font-medium">改动原因</p><ul className="text-xs text-slate-600 list-disc pl-4">{c.improvedPrompt.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></div>}
              {c.improvedPrompt.missingInformation.length>0 && <div><p className="text-xs font-medium">缺失信息</p><ul className="text-xs text-amber-700 list-disc pl-4">{c.improvedPrompt.missingInformation.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
            </div>
          ) : <p className="text-xs text-slate-500 mt-3">尚未优化 — 点击 Improve Prompt 生成</p>}
        </div>

        <div className="space-y-3">
          {c.judge ? (
            <div className="grid grid-cols-1 gap-3">
              <ScoreCard title="Original" score={c.judge.original}/>
              <ScoreCard title="Improved" score={c.judge.improved}/>
            </div>
          ) : <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-500">Judge 评分将在 Improve 后可用</div>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-slate-900">Debug Log（时间线）</h2>
        <div className="mt-3 flex gap-2">
          <input value={logText} onChange={e=>setLogText(e.target.value)} placeholder="追加一条调试记录…" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"/>
          <button onClick={()=>act(async()=>{ await api.addLog(c.id, logText); setLogText(""); },"log")} disabled={!logText.trim()||busy==="log"} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">追加</button>
        </div>
        <div className="mt-3 space-y-2">
          {c.debugLogs.length===0 && <p className="text-xs text-slate-500">暂无记录 — 追加至少 3 条后可 Learn</p>}
          {c.debugLogs.map(l=>(
            <div key={l.id} className="border-l-2 border-slate-200 pl-3 py-1">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{l.content}</p>
              <p className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-slate-900">Learn</h2>
        <div className="mt-3 flex gap-2">
          <button onClick={()=>act(()=>api.learn(c.id).then(()=>{}),"learn")} disabled={busy==="learn"} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50">{busy==="learn"?"提取中…":"Learn — 提取规则草稿"}</button>
        </div>
        {draftRule ? (
          <div className="mt-3">
            <RuleCard rule={draftRule} actions={
              <>
                <button onClick={()=>act(()=>api.confirmRule(c.id, draftRule.id).then(()=>{}),"confirm")} disabled={busy==="confirm"} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">确认保存</button>
                <button onClick={()=>act(()=>api.discardRule(c.id, draftRule.id).then(()=>{}),"discard")} disabled={busy==="discard"} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">丢弃</button>
              </>
            }/>
          </div>
        ) : <p className="text-xs text-slate-500 mt-3">暂无草稿 — 点击 Learn 生成一条规则（草稿需确认后才进入 Library）</p>}
        {rules.filter(r=>r.status==="confirmed").length>0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">已确认规则</p>
            {rules.filter(r=>r.status==="confirmed").map(r=><RuleCard key={r.id} rule={r}/>)}
          </div>
        )}
      </div>

      {err && <p className="text-sm text-red-600 whitespace-pre-wrap bg-red-50 border border-red-200 rounded-lg p-3">{err}</p>}
    </div>
  );
}
