import { Router } from "express";
import { generateInputSchema, DEFAULT_SETTINGS } from "@prompt-coach/shared";
import { readJson, dataPath } from "../storage/jsonStore.js";
import type { LearnedRule, Settings } from "@prompt-coach/shared";
import { retrieveRules } from "../services/retrievalService.js";
import { LocalEmbeddedProvider } from "../providers/LocalEmbeddedProvider.js";
import { OpenAICompatibleProvider } from "../providers/OpenAICompatibleProvider.js";

export function generateRouter(dataDir: string){
  const router = Router();
  const rulesPath = dataPath(dataDir,"rules");
  const settingsPath = dataPath(dataDir,"settings");
  router.post("/", async (req,res)=>{
    const parsed = generateInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const rules = await readJson<LearnedRule[]>(rulesPath, []);
    const retrieved = retrieveRules(rules, { query: parsed.data.problem, domain: parsed.data.domain, tag: parsed.data.tags?.[0], limit: 7, onlyConfirmed: true });
    const settings = await readJson<Settings>(settingsPath, DEFAULT_SETTINGS);
    let provider =
      settings.model === "__embedded__"
        ? (new LocalEmbeddedProvider() as never)
        : settings.apiKey && settings.apiKey.trim().length > 10
          ? (new OpenAICompatibleProvider(settings) as never)
          : (new LocalEmbeddedProvider() as never);
    let result; let usedFallback=false;
    try { result = await (provider as unknown as { generate:(x:never)=>Promise<never> }).generate({ problem: parsed.data.problem, domain: parsed.data.domain, context: parsed.data.context, retrievedRules: retrieved } as never); }
    catch(e: unknown){
      if ((provider as {name:string}).name!=="local-embedded"){
        provider = new LocalEmbeddedProvider() as never;
        result = await (provider as unknown as { generate:(x:never)=>Promise<never> }).generate({ problem: parsed.data.problem, domain: parsed.data.domain, context: parsed.data.context, retrievedRules: retrieved } as never);
        usedFallback=true;
      } else throw e;
    }
    const r = result as { prompt:string; retrievedRuleIds:string[]; provider:string };
    res.json({ prompt: r.prompt, retrievedRules: retrieved, provider: r.provider, usedEmbeddedFallback: usedFallback });
  });
  return router;
}
