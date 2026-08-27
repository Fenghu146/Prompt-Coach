import express from "express";
import cors from "cors";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { readJson, writeJsonAtomic, dataPath } from "./storage/jsonStore.js";
import { casesRouter } from "./routes/cases.js";
import { rulesRouter } from "./routes/rules.js";
import { generateRouter } from "./routes/generate.js";
import { settingsRouter } from "./routes/settings.js";
import type { PromptCase } from "@prompt-coach/shared";

export async function ensureSeed(dataDir: string) {
  const casesPath = dataPath(dataDir, "cases");
  const rulesPath = dataPath(dataDir, "rules");
  const cases = await readJson<PromptCase[]>(casesPath, []);
  if (cases.length === 0) {
    const now = new Date().toISOString();
    const seed: PromptCase = {
      id: "case-seed-001",
      title: "STM32 UART DMA 收不到数据",
      domain: "Embedded",
      problem: "STM32 UART DMA 收不到数据，IDLE 中断已使能但回调未触发",
      originalPrompt: "帮我看看 STM32 UART DMA 收不到数据是什么原因",
      context: "STM32F407, HAL 库, UART1 DMA RX circular, 波特率115200, 已使能 IDLE 中断",
      aiResult: "",
      debugLogs: [],
      tags: ["stm32", "uart", "dma", "idle"],
      createdAt: now,
      updatedAt: now,
    };
    await writeJsonAtomic(casesPath, [seed]);
    const rules = await readJson<unknown[]>(rulesPath, []);
    if (rules.length === 0) await writeJsonAtomic(rulesPath, []);
  }
}

export function createApp(dataDir: string) {
  const app = express();
  const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, true);
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/cases", casesRouter(dataDir));
  app.use("/api/rules", rulesRouter(dataDir));
  app.use("/api/generate", generateRouter(dataDir));
  app.use("/api/settings", settingsRouter(dataDir));
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientDist = join(__dirname, "../../client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("/{*any}", (_req, res) => res.sendFile(join(clientDist, "index.html")));
  }
  return app;
}
