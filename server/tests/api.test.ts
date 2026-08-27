import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, ensureSeed } from "../src/app.ts";
import type { Server } from "node:http";

function makeClient(base: string) {
  async function req(path: string, init?: RequestInit) {
    const res = await fetch(`${base}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...(init || {}),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { res, json, text, status: res.status };
  }
  return req;
}

describe("Prompt Coach API integration", () => {
  let dir = "";
  let srv: Server;
  let base = "";
  let req: ReturnType<typeof makeClient>;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "pc-test-"));
    await ensureSeed(dir);
    const app = createApp(dir);
    srv = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = srv.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
    req = makeClient(base);
  });

  after(async () => {
    await new Promise<void>((resolve) => (srv as unknown as { close: (cb: () => void) => void }).close(() => resolve()));
  });

  it("health", async () => {
    const r = await req("/api/health");
    assert.equal(r.status, 200);
    assert.equal((r.json as { ok: boolean }).ok, true);
  });

  it("create case validation and success", async () => {
    const bad = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "" }) });
    assert.equal(bad.status, 400);
    const ok = await req("/api/cases", {
      method: "POST",
      body: JSON.stringify({
        title: "t",
        problem: "STM32 UART 收不到",
        originalPrompt: "帮我看看",
        tags: ["a", "b"],
      }),
    });
    assert.equal(ok.status, 201);
    assert.ok((ok.json as { id: string }).id);
  });

  it("improve → judge flow", async () => {
    const c1 = await req("/api/cases", {
      method: "POST",
      body: JSON.stringify({ title: "j", problem: "p", originalPrompt: "o" }),
    });
    const id = (c1.json as { id: string }).id;
    const notReady = await req(`/api/cases/${id}/judge`, { method: "POST" });
    assert.equal(notReady.status, 400);
    const imp = await req(`/api/cases/${id}/improve`, { method: "POST" });
    assert.equal(imp.status, 200);
    assert.ok((imp.json as { improvedPrompt: unknown }).improvedPrompt);
    const j = await req(`/api/cases/${id}/judge`, { method: "POST" });
    assert.equal(j.status, 200);
    assert.ok((j.json as { judge: unknown }).judge);
  });

  it("learn draft not used by generate; confirmed is used", async () => {
    const c = await req("/api/cases", {
      method: "POST",
      body: JSON.stringify({ title: "learn", problem: "STM32 UART DMA 丢包", originalPrompt: "DMA 为什么丢", tags: ["uart", "dma"] }),
    });
    const id = (c.json as { id: string }).id;
    await req(`/api/cases/${id}/logs`, { method: "POST", body: JSON.stringify({ content: "检查 DMA 配置" }) });
    await req(`/api/cases/${id}/logs`, { method: "POST", body: JSON.stringify({ content: "检查中断" }) });
    await req(`/api/cases/${id}`, { method: "PATCH", body: JSON.stringify({ outcome: "solved" }) });
    const l = await req(`/api/cases/${id}/learn`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(l.status, 201);
    const ruleId = (l.json as { rule: { id: string } }).rule.id;
    const genBefore = await req("/api/generate", {
      method: "POST",
      body: JSON.stringify({ problem: "STM32 UART DMA 丢包", domain: "Embedded" }),
    });
    assert.equal(genBefore.status, 200);
    const beforeIds: string[] = ((genBefore.json as { retrievedRules: { id: string }[] }).retrievedRules || []).map((x) => x.id);
    assert.equal(beforeIds.includes(ruleId), false, "draft should not be retrieved");
    const conf = await req(`/api/cases/${id}/rules/${ruleId}/confirm`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(conf.status, 200);
    const genAfter = await req("/api/generate", {
      method: "POST",
      body: JSON.stringify({ problem: "STM32 UART DMA 丢包", domain: "Embedded" }),
    });
    const afterIds: string[] = ((genAfter.json as { retrievedRules: { id: string }[] }).retrievedRules || []).map((x) => x.id);
    assert.equal(afterIds.includes(ruleId), true);
  });

  it("cross-case confirm/discard must fail 403", async () => {
    const a = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "a", problem: "pa", originalPrompt: "oa" }) });
    const b = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "b", problem: "pb", originalPrompt: "ob" }) });
    const aid = (a.json as { id: string }).id;
    const bid = (b.json as { id: string }).id;
    const lr = await req(`/api/cases/${aid}/learn`, { method: "POST", body: JSON.stringify({}) });
    const rid = (lr.json as { rule: { id: string } }).rule.id;
    const crossConfirm = await req(`/api/cases/${bid}/rules/${rid}/confirm`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(crossConfirm.status, 403);
    const crossDiscard = await req(`/api/cases/${bid}/rules/${rid}/discard`, { method: "POST" });
    assert.equal(crossDiscard.status, 403);
    const okDiscard = await req(`/api/cases/${aid}/rules/${rid}/discard`, { method: "POST" });
    assert.equal(okDiscard.status, 200);
  });

  it("invalid rule status must fail 400", async () => {
    const c = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "s", problem: "pp", originalPrompt: "oo" }) });
    const id = (c.json as { id: string }).id;
    const lr = await req(`/api/cases/${id}/learn`, { method: "POST", body: JSON.stringify({}) });
    const rid = (lr.json as { rule: { id: string } }).rule.id;
    const bad = await req(`/api/rules/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "garbage" }) });
    assert.equal(bad.status, 400);
    const bad2 = await req(`/api/rules/${rid}`, { method: "PATCH", body: JSON.stringify({ title: "" }) });
    assert.equal(bad2.status, 400);
    const bad3 = await req(`/api/cases/${id}/rules/${rid}/confirm`, { method: "POST", body: JSON.stringify({ status: "archived" }) });
    assert.equal(bad3.status, 400);
  });

  it("irrelevant query should not hit rules", async () => {
    const c = await req("/api/cases", {
      method: "POST",
      body: JSON.stringify({ title: "emb", problem: "STM32 UART DMA 问题", originalPrompt: "uart", tags: ["uart"] }),
    });
    const id = (c.json as { id: string }).id;
    await req(`/api/cases/${id}/logs`, { method: "POST", body: JSON.stringify({ content: "l1" }) });
    await req(`/api/cases/${id}/logs`, { method: "POST", body: JSON.stringify({ content: "l2" }) });
    await req(`/api/cases/${id}`, { method: "PATCH", body: JSON.stringify({ outcome: "solved" }) });
    const lr = await req(`/api/cases/${id}/learn`, { method: "POST", body: JSON.stringify({}) });
    const rid = (lr.json as { rule: { id: string } }).rule.id;
    await req(`/api/cases/${id}/rules/${rid}/confirm`, { method: "POST", body: JSON.stringify({}) });
    const gen = await req("/api/generate", {
      method: "POST",
      body: JSON.stringify({ problem: "怎么做番茄炒蛋", domain: "Cooking" }),
    });
    assert.equal(gen.status, 200);
    const ids: string[] = ((gen.json as { retrievedRules: { id: string }[] }).retrievedRules || []).map((x) => x.id);
    assert.equal(ids.includes(rid), false);
  });

  it("rules PATCH validation and archiving", async () => {
    const c = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "arch", problem: "p", originalPrompt: "o" }) });
    const id = (c.json as { id: string }).id;
    const lr = await req(`/api/cases/${id}/learn`, { method: "POST", body: JSON.stringify({}) });
    const rid = (lr.json as { rule: { id: string } }).rule.id;
    await req(`/api/cases/${id}/rules/${rid}/confirm`, { method: "POST", body: JSON.stringify({}) });
    const arch = await req(`/api/rules/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) });
    assert.equal(arch.status, 200);
    const back = await req(`/api/rules/${rid}`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
    assert.equal(back.status, 400);
  });

  it("json write concurrency safe (parallel logs)", async () => {
    const c = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "conc", problem: "p", originalPrompt: "o" }) });
    const id = (c.json as { id: string }).id;
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => req(`/api/cases/${id}/logs`, { method: "POST", body: JSON.stringify({ content: `log-${i}` }) })),
    );
    for (const r of results) assert.equal(r.status, 201);
    const got = await req(`/api/cases/${id}`);
    assert.equal(((got.json as { debugLogs: unknown[] }).debugLogs || []).length, 8);
  });

  it("library default only confirmed+archived (draft excluded)", async () => {
    const c = await req("/api/cases", { method: "POST", body: JSON.stringify({ title: "lib", problem: "pl", originalPrompt: "ol" }) });
    const id = (c.json as { id: string }).id;
    const lr = await req(`/api/cases/${id}/learn`, { method: "POST", body: JSON.stringify({}) });
    const rid = (lr.json as { rule: { id: string } }).rule.id;
    const all = await req("/api/rules");
    const idsAll: string[] = ((all.json as { id: string }[] ) || []).map((x) => x.id);
    assert.equal(idsAll.includes(rid), false);
    const draftOnly = await req("/api/rules?status=draft");
    const draftIds: string[] = ((draftOnly.json as { id: string }[] ) || []).map((x) => x.id);
    assert.equal(draftIds.includes(rid), true);
  });
});
