import { Router } from "express";
import { readJson, writeJsonAtomic, dataPath } from "../storage/jsonStore.js";
import type { LearnedRule, PromptCase } from "@prompt-coach/shared";
import { patchRuleInputSchema } from "@prompt-coach/shared";
import { retrieveWithReasons } from "../services/retrievalService.js";

export function rulesRouter(dataDir: string) {
  const router = Router();
  const rulesPath = dataPath(dataDir, "rules");
  const casesPath = dataPath(dataDir, "cases");

  router.get("/", async (req, res) => {
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const { query, domain, tag, status } = req.query as Record<string, string | undefined>;
    const wantsAll = status === "all";
    const isSearch = !!(query || domain || tag);
    if (isSearch) {
      const withReasons = retrieveWithReasons(rules, { query, domain, tag, limit: 50, onlyConfirmed: false });
      const useFilter = status
        ? withReasons.filter((x) => (wantsAll ? true : x.rule.status === status))
        : withReasons.filter((x) => x.rule.status === "confirmed" || x.rule.status === "archived");
      return res.json(useFilter.map((x) => ({ ...x.rule, _score: x.score, _reasons: x.reasons })));
    }
    let list: LearnedRule[];
    if (status === "draft") list = rules.filter((r) => r.status === "draft");
    else if (status && !wantsAll) list = rules.filter((r) => r.status === status);
    else if (!status) list = rules.filter((r) => r.status === "confirmed" || r.status === "archived");
    else list = [...rules];
    list = [...list].sort((a, b) => {
      const order = { confirmed: 0, draft: 1, archived: 2 } as Record<string, number>;
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    res.json(list);
  });

  router.patch("/:id", async (req, res) => {
    const parsed = patchRuleInputSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const patch = parsed.data;
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const idx = rules.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "rule not found" });
    if (rules[idx].status === "archived" && patch.status && patch.status !== "archived") {
      return res.status(400).json({ error: "archived rule cannot change status" });
    }
    if (patch.title !== undefined) rules[idx].title = patch.title;
    if (patch.promptRule !== undefined) rules[idx].promptRule = patch.promptRule;
    if (patch.experience !== undefined) rules[idx].experience = patch.experience;
    if (patch.tags !== undefined) {
      const deduped = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))];
      rules[idx].tags = deduped.slice(0, 6);
    }
    if (patch.confidence !== undefined) rules[idx].confidence = patch.confidence;
    if (patch.domain !== undefined) rules[idx].domain = patch.domain;
    if (patch.status !== undefined) rules[idx].status = patch.status;
    rules[idx].updatedAt = new Date().toISOString();
    await writeJsonAtomic(rulesPath, rules);
    res.json(rules[idx]);
  });

  router.delete("/:id", async (req, res) => {
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const idx = rules.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "rule not found" });
    const [removed] = rules.splice(idx, 1);
    await writeJsonAtomic(rulesPath, rules);
    const cases = await readJson<PromptCase[]>(casesPath, []);
    let mutated = false;
    for (const c of cases) if (c.learnedRuleId === removed.id) { delete c.learnedRuleId; mutated = true; }
    if (mutated) await writeJsonAtomic(casesPath, cases);
    res.json(removed);
  });

  return router;
}
