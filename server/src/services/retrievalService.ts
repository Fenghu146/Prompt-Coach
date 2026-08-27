import type { LearnedRule } from "@prompt-coach/shared";

function normalize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g," ").trim().split(/\s+/).filter(Boolean);
}
const STOP = new Set(["the","a","an","is","are","of","to","and","in","on","for","with","de","le","la","的","了","是","在","和","与","我","你","他"]);

export function scoreRule(rule: LearnedRule, query: string, domain?: string, tag?: string): number {
  let score = 0;
  const qTokens = normalize(query).filter(t=>!STOP.has(t));
  const ruleText = `${rule.title} ${rule.experience} ${rule.promptRule} ${rule.tags.join(" ")} ${rule.domain||""}`.toLowerCase();
  for (const t of qTokens) if (ruleText.includes(t)) score += 3;
  if (domain && rule.domain && rule.domain.toLowerCase()===domain.toLowerCase()) score += 5;
  if (tag && rule.tags.some(x=>x.toLowerCase()===tag.toLowerCase())) score += 4;
  if (rule.status==="confirmed") score += 1;
  // prefer higher confidence slightly
  if (rule.confidence==="high") score+=1;
  return score;
}

export function retrieveRules(rules: LearnedRule[], opts: { query?: string; domain?: string; tag?: string; limit?: number; onlyConfirmed?: boolean }): LearnedRule[] {
  let list = rules;
  if (opts.onlyConfirmed) list = list.filter(r=>r.status==="confirmed");
  if (!opts.query && !opts.domain && !opts.tag) return list.slice(0, opts.limit??7);
  const scored = list.map(r=>({ r, s: scoreRule(r, opts.query||"", opts.domain, opts.tag)}));
  scored.sort((a,b)=>b.s - a.s);
  const filtered = opts.query || opts.domain || opts.tag ? scored.filter(x=>x.s>0).map(x=>x.r) : scored.map(x=>x.r);
  return filtered.slice(0, opts.limit??7);
}
