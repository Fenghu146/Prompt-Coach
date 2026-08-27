# Prompt Coach

让 AI 学会你的提问方式 — 嵌入式 Debug 场景的个人 Prompt 成长系统（本地版）。

## 本地运行

```bash
npm install
npm run dev        # 前端 http://localhost:5173  后端 http://localhost:3000  (Vite 代理 /api)
npm run build && npm start  # 生产：构建前端并由 Express 托管
```

数据落盘 `server/data/{cases,rules,settings}.json`，原子写（tmp→rename），刷新不丢；备份即拷贝该目录。

## Settings（OpenAI 兼容）

前端 `Settings` 页配置：
- `baseURL`（默认 https://api.openai.com/v1，兼容第三方）
- `apiKey` / `model`（如 gpt-4o-mini） / `apiMode`（auto | chat | responses，auto 优先 responses 失败回退 chat） / `timeoutMs`

Key 仅存后端 `settings.json`，接口回显掩码；未配置或测试失败时所有 AI 能力自动回退到内嵌免配置模型（`LocalEmbeddedProvider`），零 Key 也可跑通全闭环。

## 验收

种子案例：`STM32 UART DMA 收不到数据`（Embedded）。
闭环：`New → Improve → Judge → 3× Debug Log → Outcome(solved) → Learn(draft) → Confirm → Library → Generate 命中`。
