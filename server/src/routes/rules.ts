import { Router } from "express";
import { readJson, writeJsonAtomic, dataPath } from "../storage/jsonStore.js";
import type { LearnedRule } from "@prompt-coach/shared";
import { retrieveRules } from "../services/retrievalService.js";

export function rulesRouter(dataDir: string){
  const router = Router();
  const rulesPath = dataPath(dataDir,"rules");
  router.get("/", async (req,res)=>{
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const { query, domain, tag } = req.query as Record<string,string|undefined>;
    let list = rules;
    if (query || domain || tag) list = retrieveRules(rules, { query, domain, tag, limit: 50, onlyConfirmed: false });
    // default: confirmed + draft, archived last
    list = [...list].sort((a,b)=>{
      const order = { confirmed:0, draft:1, archived:2 } as Record<string,number>;
      if (order[a.status]!==order[b.status]) return order[a.status]-order[b.status];
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    res.json(list);
  });

  router.patch("/:id", async (req,res)=>{
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const idx = rules.findIndex(x=>x.id===req.params.id);
    if (idx<0) return res.status(404).json({ error:"rule not found"});
    const patch = req.body||{};
    if (patch.title) rules[idx].title = patch.title;
    if (patch.promptRule) rules[idx].promptRule = patch.promptRule;
    if (patch.experience) rules[idx].experience = patch.experience;
    if (patch.tags) rules[idx].tags = (patch.tags as string[]).slice(0,6);
    if (patch.confidence) rules[idx].confidence = patch.confidence;
    if (patch.domain) rules[idx].domain = patch.domain;
    if (patch.status) rules[idx].status = patch.status;
    rules[idx].updatedAt = new Date().toISOString();
    await writeJsonAtomic(rulesPath, rules);
    res.json(rules[idx]);
  });

  router.delete("/:id", async (req,res)=>{
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const idx = rules.findIndex(x=>x.id===req.params.id);
    if (idx<0) return res.status(404).json({ error:"rule not found"});
    const [removed]=rules.splice(idx,1);
    await writeJsonAtomic(rulesPath, rules);
    res.json(removed);
  });

  return router;
}
