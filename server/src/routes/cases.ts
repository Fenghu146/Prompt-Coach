import { Router } from "express";
import { nanoid } from "nanoid";
import { createCaseInputSchema, patchCaseInputSchema, patchRuleInputSchema } from "@prompt-coach/shared";
import { readJson, writeJsonAtomic, updateJsonAtomic, dataPath } from "../storage/jsonStore.js";
import type { PromptCase, LearnedRule, Settings } from "@prompt-coach/shared";
import { DEFAULT_SETTINGS } from "@prompt-coach/shared";
import { LocalEmbeddedProvider } from "../providers/LocalEmbeddedProvider.js";
import { OpenAICompatibleProvider } from "../providers/OpenAICompatibleProvider.js";
import { retrieveRules } from "../services/retrievalService.js";

export function casesRouter(dataDir: string) {
  const router = Router();
  const casesPath = dataPath(dataDir, "cases");
  const rulesPath = dataPath(dataDir, "rules");
  const settingsPath = dataPath(dataDir, "settings");

  async function getProvider() {
    const settings = await readJson<Settings>(settingsPath, DEFAULT_SETTINGS);
    if (settings.model === "__embedded__") return new LocalEmbeddedProvider();
    if (settings.apiKey && settings.apiKey.trim().length > 10) {
      return new OpenAICompatibleProvider(settings);
    }
    return new LocalEmbeddedProvider();
  }

  router.get("/", async (_req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    res.json(cases.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  router.post("/", async (req, res) => {
    const parsed = createCaseInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const now = new Date().toISOString();
    const c: PromptCase = {
      id: `case-${nanoid(8)}`,
      title: parsed.data.title,
      domain: parsed.data.domain || "Embedded",
      problem: parsed.data.problem,
      originalPrompt: parsed.data.originalPrompt,
      context: parsed.data.context,
      aiResult: parsed.data.aiResult,
      debugLogs: [],
      tags: parsed.data.tags || [],
      generatedFromRuleIds: parsed.data.generatedFromRuleIds,
      improvedPrompt: parsed.data.improvedPrompt,
      createdAt: now,
      updatedAt: now,
    };
    cases.push(c);
    await writeJsonAtomic(casesPath, cases);
    res.status(201).json(c);
  });

  router.get("/:id", async (req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const c = cases.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "case not found" });
    res.json(c);
  });

  router.patch("/:id", async (req, res) => {
    const parsed = patchCaseInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const idx = cases.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "case not found" });
    const updated = { ...cases[idx], ...parsed.data, updatedAt: new Date().toISOString() } as PromptCase;
    if (updated.tags && updated.tags.length > 6) updated.tags = updated.tags.slice(0, 6);
    cases[idx] = updated;
    await writeJsonAtomic(casesPath, cases);
    res.json(updated);
  });

  router.post("/:id/logs", async (req, res) => {
    const content = (req.body?.content || "").toString().trim();
    if (!content) return res.status(400).json({ error: "content required" });
    let created: { id: string; content: string; createdAt: string } | null = null;
    try {
      await updateJsonAtomic<PromptCase[]>(casesPath, [], (cases) => {
        const idx = cases.findIndex((x) => x.id === req.params.id);
        if (idx < 0) throw Object.assign(new Error("case not found"), { status: 404 });
        const log = { id: `log-${nanoid(6)}`, content, createdAt: new Date().toISOString() };
        created = log;
        cases[idx].debugLogs.push(log);
        cases[idx].updatedAt = new Date().toISOString();
        return cases;
      });
    } catch (e: unknown) {
      if ((e as { status?: number }).status === 404) return res.status(404).json({ error: "case not found" });
      throw e;
    }
    res.status(201).json(created);
  });

  router.post("/:id/improve", async (req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const idx = cases.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "case not found" });
    const c = cases[idx];
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const retrieved = retrieveRules(rules, { query: c.problem, domain: c.domain, limit: 7, onlyConfirmed: true });
    let provider = await getProvider();
    let result;
    let usedFallback = false;
    try {
      result = await provider.improve({ promptCase: c, retrievedRules: retrieved });
    } catch (e: unknown) {
      if (provider.name !== "local-embedded") {
        provider = new LocalEmbeddedProvider();
        result = await provider.improve({ promptCase: c, retrievedRules: retrieved });
        usedFallback = true;
      } else {
        const msg = (e as Error).message || "improve failed";
        return res.status(502).json({ error: msg });
      }
    }
    c.improvedPrompt = result.improvedPrompt;
    c.updatedAt = new Date().toISOString();
    cases[idx] = c;
    await writeJsonAtomic(casesPath, cases);
    res.json({ ...result, usedEmbeddedFallback: usedFallback, retrievedRuleIds: retrieved.map((r) => r.id) });
  });

  router.post("/:id/judge", async (req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const idx = cases.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "case not found" });
    const c = cases[idx];
    if (!c.improvedPrompt) return res.status(400).json({ error: "improvedPrompt not found, run improve first" });
    let provider = await getProvider();
    let result;
    let usedFallback = false;
    try {
      result = await provider.judge({ originalPrompt: c.originalPrompt, improvedPrompt: c.improvedPrompt.content, problem: c.problem, context: c.context });
    } catch (e: unknown) {
      if (provider.name !== "local-embedded") {
        provider = new LocalEmbeddedProvider();
        result = await provider.judge({ originalPrompt: c.originalPrompt, improvedPrompt: c.improvedPrompt.content, problem: c.problem, context: c.context });
        usedFallback = true;
      } else {
        const msg = (e as Error).message || "judge failed";
        return res.status(502).json({ error: msg });
      }
    }
    const fix = (s: { context: number; specificity: number; constraints: number; taskClarity: number; outputFormat: number; total: number; suggestions: string[] }) => ({
      ...s,
      total: s.context + s.specificity + s.constraints + s.taskClarity + s.outputFormat,
    });
    const judge = { original: fix(result.original as never), improved: fix(result.improved as never), createdAt: new Date().toISOString() };
    c.judge = judge as never;
    c.updatedAt = new Date().toISOString();
    cases[idx] = c;
    await writeJsonAtomic(casesPath, cases);
    res.json({ judge, provider: provider.name, usedEmbeddedFallback: usedFallback });
  });

  router.post("/:id/learn", async (req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const idx = cases.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "case not found" });
    const c = cases[idx];
    const rules = await readJson<LearnedRule[]>(rulesPath, []);

    const existingDraftIdx = rules.findIndex((r) => r.sourceCaseIds.includes(c.id) && r.status === "draft");
    const forceNew = req.body?.forceNew === true;
    if (existingDraftIdx >= 0 && !forceNew) {
      return res.status(409).json({ error: "draft already exists for this case", ruleId: rules[existingDraftIdx].id, rule: rules[existingDraftIdx] });
    }

    let provider = await getProvider();
    let result;
    let usedFallback = false;
    try {
      result = await provider.learn({ promptCase: c });
    } catch (e: unknown) {
      if (provider.name !== "local-embedded") {
        provider = new LocalEmbeddedProvider();
        result = await provider.learn({ promptCase: c });
        usedFallback = true;
      } else {
        const msg = (e as Error).message || "learn failed";
        return res.status(502).json({ error: msg });
      }
    }
    const rule = result.rule;
    rules.push(rule);
    await writeJsonAtomic(rulesPath, rules);
    c.learnedRuleId = rule.id;
    c.updatedAt = new Date().toISOString();
    cases[idx] = c;
    await writeJsonAtomic(casesPath, cases);
    res.status(201).json({ rule, provider: provider.name, usedEmbeddedFallback: usedFallback });
  });

  router.post("/:id/rules/:ruleId/confirm", async (req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const c = cases.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "case not found" });
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const rIdx = rules.findIndex((x) => x.id === req.params.ruleId);
    if (rIdx < 0) return res.status(404).json({ error: "rule not found" });
    if (rules[rIdx].status === "archived") return res.status(400).json({ error: "archived rule cannot be confirmed" });
    if (rules[rIdx].status !== "draft") return res.status(400).json({ error: "only draft can be confirmed" });
    if (!rules[rIdx].sourceCaseIds.includes(req.params.id)) {
      return res.status(403).json({ error: "rule does not belong to case" });
    }
    const parsed = patchRuleInputSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const patch = parsed.data;
    if (patch.status && patch.status !== "confirmed") return res.status(400).json({ error: "confirm only allows status=confirmed" });
    if (patch.title !== undefined) rules[rIdx].title = patch.title;
    if (patch.promptRule !== undefined) rules[rIdx].promptRule = patch.promptRule;
    if (patch.experience !== undefined) rules[rIdx].experience = patch.experience;
    if (patch.tags !== undefined) {
      const deduped = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))];
      rules[rIdx].tags = deduped.slice(0, 6);
    }
    if (patch.confidence !== undefined) rules[rIdx].confidence = patch.confidence;
    if (patch.domain !== undefined) rules[rIdx].domain = patch.domain;
    rules[rIdx].status = "confirmed";
    rules[rIdx].updatedAt = new Date().toISOString();
    await writeJsonAtomic(rulesPath, rules);
    res.json(rules[rIdx]);
  });

  router.post("/:id/rules/:ruleId/discard", async (req, res) => {
    const cases = await readJson<PromptCase[]>(casesPath, []);
    const cIdx = cases.findIndex((x) => x.id === req.params.id);
    if (cIdx < 0) return res.status(404).json({ error: "case not found" });
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const idx = rules.findIndex((x) => x.id === req.params.ruleId);
    if (idx < 0) return res.status(404).json({ error: "rule not found" });
    if (rules[idx].status === "archived") return res.status(400).json({ error: "archived rule cannot be discarded this way" });
    if (rules[idx].status !== "draft") return res.status(400).json({ error: "only draft can be discarded" });
    if (!rules[idx].sourceCaseIds.includes(req.params.id)) {
      return res.status(403).json({ error: "rule does not belong to case" });
    }
    const [removed] = rules.splice(idx, 1);
    await writeJsonAtomic(rulesPath, rules);
    if (cases[cIdx].learnedRuleId === req.params.ruleId) {
      delete cases[cIdx].learnedRuleId;
      cases[cIdx].updatedAt = new Date().toISOString();
      await writeJsonAtomic(casesPath, cases);
    }
    res.json(removed);
  });

  return router;
}
