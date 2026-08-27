import { Router } from "express";
import { readJson, writeJsonAtomic, dataPath } from "../storage/jsonStore.js";
import type { Settings, SafeSettings } from "@prompt-coach/shared";
import { DEFAULT_SETTINGS, settingsSchema } from "@prompt-coach/shared";

function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 8) return "****";
  return k.slice(0, 4) + "****" + k.slice(-4);
}
function toSafe(s: Settings): SafeSettings {
  return { baseURL: s.baseURL, model: s.model, apiMode: s.apiMode, timeoutMs: s.timeoutMs, updatedAt: s.updatedAt, apiKeyMasked: maskKey(s.apiKey), hasApiKey: !!s.apiKey };
}

export function settingsRouter(dataDir: string) {
  const router = Router();
  const p = dataPath(dataDir, "settings");
  router.get("/", async (_req, res) => {
    const s = await readJson<Settings>(p, DEFAULT_SETTINGS);
    res.json(toSafe(s));
  });
  router.post("/", async (req, res) => {
    const current = await readJson<Settings>(p, DEFAULT_SETTINGS);
    let apiKey = req.body?.apiKey as string | undefined;
    if (apiKey && apiKey.includes("****")) apiKey = current.apiKey;
    const candidate = {
      baseURL: req.body?.baseURL ?? current.baseURL,
      apiKey: apiKey ?? current.apiKey,
      model: req.body?.model ?? current.model,
      apiMode: req.body?.apiMode ?? current.apiMode,
      timeoutMs: req.body?.timeoutMs ?? current.timeoutMs,
      updatedAt: new Date().toISOString(),
    };
    const parsed = settingsSchema.safeParse(candidate);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    await writeJsonAtomic(p, parsed.data);
    res.json(toSafe(parsed.data));
  });
  router.post("/test", async (_req, res) => {
    const s = await readJson<Settings>(p, DEFAULT_SETTINGS);
    if (!s.apiKey) return res.json({ ok: false, error: "apiKey not set, will use embedded provider" });
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const base = s.baseURL.replace(/\/$/, "");
      const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${s.apiKey}` }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return res.json({ ok: true, provider: "openai-compatible" });
      const txt = await r.text();
      return res.json({ ok: false, error: `models ${r.status}: ${txt.slice(0, 300)}` });
    } catch (e: unknown) {
      return res.json({ ok: false, error: (e as Error).message });
    }
  });
  return router;
}
