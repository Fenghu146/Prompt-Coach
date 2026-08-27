const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCases: () => req<import("@prompt-coach/shared").PromptCase[]>("/api/cases"),
  getCase: (id: string) => req<import("@prompt-coach/shared").PromptCase>(`/api/cases/${id}`),
  createCase: (body: unknown) => req<import("@prompt-coach/shared").PromptCase>("/api/cases", { method: "POST", body: JSON.stringify(body) }),
  patchCase: (id: string, body: unknown) => req<import("@prompt-coach/shared").PromptCase>(`/api/cases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  addLog: (id: string, content: string) => req<{ id: string; content: string; createdAt: string }>(`/api/cases/${id}/logs`, { method: "POST", body: JSON.stringify({ content }) }),
  improve: (id: string) => req<{ improvedPrompt: import("@prompt-coach/shared").ImprovedPrompt; provider: string; usedEmbeddedFallback: boolean; retrievedRuleIds: string[] }>(`/api/cases/${id}/improve`, { method: "POST" }),
  judge: (id: string) => req<{ judge: import("@prompt-coach/shared").JudgeComparison; provider: string; usedEmbeddedFallback: boolean }>(`/api/cases/${id}/judge`, { method: "POST" }),
  learn: (id: string) => req<{ rule: import("@prompt-coach/shared").LearnedRule; provider: string }>(`/api/cases/${id}/learn`, { method: "POST" }),
  confirmRule: (caseId: string, ruleId: string, body?: unknown) =>
    req<import("@prompt-coach/shared").LearnedRule>(`/api/cases/${caseId}/rules/${ruleId}/confirm`, { method: "POST", body: JSON.stringify(body || {}) }),
  discardRule: (caseId: string, ruleId: string) => req<import("@prompt-coach/shared").LearnedRule>(`/api/cases/${caseId}/rules/${ruleId}/discard`, { method: "POST" }),
  listRules: (q?: { query?: string; domain?: string; tag?: string }) => {
    const sp = new URLSearchParams();
    if (q?.query) sp.set("query", q.query);
    if (q?.domain) sp.set("domain", q.domain);
    if (q?.tag) sp.set("tag", q.tag);
    const s = sp.toString();
    return req<import("@prompt-coach/shared").LearnedRule[]>(`/api/rules${s ? "?" + s : ""}`);
  },
  patchRule: (id: string, body: unknown) => req<import("@prompt-coach/shared").LearnedRule>(`/api/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRule: (id: string) => req<import("@prompt-coach/shared").LearnedRule>(`/api/rules/${id}`, { method: "DELETE" }),
  generate: (body: unknown) => req<{ prompt: string; retrievedRules: import("@prompt-coach/shared").LearnedRule[]; provider: string; usedEmbeddedFallback: boolean }>("/api/generate", { method: "POST", body: JSON.stringify(body) }),
  getSettings: () => req<import("@prompt-coach/shared").SafeSettings>("/api/settings"),
  saveSettings: (body: unknown) => req<import("@prompt-coach/shared").SafeSettings>("/api/settings", { method: "POST", body: JSON.stringify(body) }),
  testSettings: () => req<{ ok: boolean; error?: string; provider?: string }>("/api/settings/test", { method: "POST" }),
  listModels: () => req<{ chat: string[] }>("/api/settings/models"),
};
