import { useState } from "react";
export function CopyButton({ text }: { text: string }){
  const [ok,setOk]=useState(false);
  return (
    <button
      onClick={async()=>{ await navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false),1500); }}
      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
    >{ok?"已复制":"复制"}</button>
  );
}
