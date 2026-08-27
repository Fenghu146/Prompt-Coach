import type { LearnedRule } from "@prompt-coach/shared";

const STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "of",
  "to",
  "and",
  "in",
  "on",
  "for",
  "with",
  "de",
  "le",
  "la",
  "的",
  "了",
  "是",
  "在",
  "和",
  "与",
  "我",
  "你",
  "他",
]);

const SYNONYM_GROUPS: string[][] = [
  ["串口", "uart"],
  ["接收", "rx"],
  ["发送", "tx"],
  ["直接内存访问", "dma"],
  ["中断", "irq", "interrupt"],
  ["波特率", "baud"],
  ["时钟", "clock"],
  ["空闲", "idle"],
];

const synonymMap = new Map<string, string[]>();
for (const g of SYNONYM_GROUPS) {
  const lower = g.map((x) => x.toLowerCase());
  for (const t of lower) synonymMap.set(t, lower);
}

function expandToken(token: string): string[] {
  const key = token.toLowerCase();
  return synonymMap.get(key) || [key];
}

function normalizeTokens(s: string): string[] {
  const raw = s.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fa5]+/g) || [];
  return raw.filter((t) => !STOP.has(t)).filter(Boolean);
}

export type ScoreHitReason = string;

export function scoreRuleDetailed(
  rule: LearnedRule,
  query: string,
  domain?: string,
  tag?: string,
): { score: number; reasons: ScoreHitReason[] } {
  let score = 0;
  const reasons: string[] = [];
  const qTokens = normalizeTokens(query);
  const expanded = new Set<string>();
  for (const t of qTokens) for (const e of expandToken(t)) expanded.add(e);
  const qExpanded = [...expanded];

  const ruleTitleLower = rule.title.toLowerCase();
  const ruleContentLower = `${rule.experience} ${rule.promptRule}`.toLowerCase();
  const ruleTagsLower = rule.tags.map((t) => t.toLowerCase());
  const ruleDomainLower = (rule.domain || "").toLowerCase();

  if (tag) {
    const tagLower = tag.toLowerCase();
    const tagExpanded = new Set(expandToken(tagLower));
    if (ruleTagsLower.some((rt) => tagExpanded.has(rt) || rt === tagLower)) {
      score += 8;
      reasons.push(`精确标签匹配: ${tag}`);
    }
  } else {
    for (const rt of ruleTagsLower) {
      if (qExpanded.includes(rt)) {
        score += 8;
        reasons.push(`精确标签匹配: ${rt}`);
        break;
      }
      for (const qt of qExpanded) {
        if (rt.includes(qt) || qt.includes(rt)) {
          score += 8;
          reasons.push(`精确标签匹配: ${rt}`);
          break;
        }
      }
      if (reasons.some((r) => r.startsWith("精确标签"))) break;
    }
  }

  if (domain) {
    const dLower = domain.toLowerCase();
    const dExpanded = new Set(expandToken(dLower));
    if (ruleDomainLower && (ruleDomainLower === dLower || dExpanded.has(ruleDomainLower))) {
      score += 5;
      reasons.push(`领域匹配: ${rule.domain}`);
    } else if (domain && ruleDomainLower && ruleDomainLower !== dLower && !dExpanded.has(ruleDomainLower)) {
      score -= 4;
      reasons.push(`领域不一致: ${rule.domain}≠${domain}`);
    }
  }

  let titleHits = 0;
  for (const qt of qExpanded) {
    if (qt.length < 2) continue;
    if (ruleTitleLower.includes(qt)) titleHits++;
  }
  if (titleHits > 0) {
    const add = titleHits * 4;
    score += add;
    reasons.push(`标题关键词: +${add}`);
  }

  let contentHits = 0;
  for (const qt of qExpanded) {
    if (qt.length < 2) continue;
    if (ruleContentLower.includes(qt)) contentHits++;
  }
  if (contentHits > 0) {
    const add = Math.min(contentHits * 2, 8);
    score += add;
    reasons.push(`规则内容关键词: +${add}`);
  }

  return { score, reasons };
}

export function scoreRule(rule: LearnedRule, query: string, domain?: string, tag?: string): number {
  return scoreRuleDetailed(rule, query, domain, tag).score;
}

const MIN_SCORE = 4;

export function retrieveRules(
  rules: LearnedRule[],
  opts: { query?: string; domain?: string; tag?: string; limit?: number; onlyConfirmed?: boolean },
): LearnedRule[] {
  let list = rules;
  if (opts.onlyConfirmed) list = list.filter((r) => r.status === "confirmed");
  if (!opts.query && !opts.domain && !opts.tag) return list.slice(0, opts.limit ?? 7);
  const scored = list.map((r) => {
    const { score, reasons } = scoreRuleDetailed(r, opts.query || "", opts.domain, opts.tag);
    const tie =
      r.confidence === "high" ? 0.3 : r.confidence === "medium" ? 0.1 : r.confidence === "low" ? -0.1 : 0;
    return { r, s: score, reasons, sortScore: score + tie };
  });
  scored.sort((a, b) => b.sortScore - a.sortScore);
  const filtered = scored.filter((x) => x.s >= MIN_SCORE).map((x) => x.r);
  if (filtered.length > 0) return filtered.slice(0, opts.limit ?? 7);
  return [];
}

export function retrieveWithReasons(
  rules: LearnedRule[],
  opts: { query?: string; domain?: string; tag?: string; limit?: number; onlyConfirmed?: boolean },
): { rule: LearnedRule; score: number; reasons: string[] }[] {
  let list = rules;
  if (opts.onlyConfirmed) list = list.filter((r) => r.status === "confirmed");
  if (!opts.query && !opts.domain && !opts.tag) return list.slice(0, opts.limit ?? 7).map((r) => ({ rule: r, score: 0, reasons: [] }));
  const scored = list.map((r) => {
    const { score, reasons } = scoreRuleDetailed(r, opts.query || "", opts.domain, opts.tag);
    const tie =
      r.confidence === "high" ? 0.3 : r.confidence === "medium" ? 0.1 : r.confidence === "low" ? -0.1 : 0;
    return { rule: r, score, reasons, sortScore: score + tie };
  });
  scored.sort((a, b) => b.sortScore - a.sortScore);
  const filtered = scored.filter((x) => x.score >= MIN_SCORE).slice(0, opts.limit ?? 7);
  return filtered.map((x) => ({ rule: x.rule, score: x.score, reasons: x.reasons }));
}
