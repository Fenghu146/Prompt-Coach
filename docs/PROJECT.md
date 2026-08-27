# Prompt Coach 项目指导文档

> 版本：0.2（已确认方案）  
> 产品定位：让 AI 学会你的提问方式。  
> 本文是第一版产品、技术和验收的共同依据；当实现与本文冲突时，应先更新本文再改代码。

## 1. 项目概述

Prompt Coach 是一个个人 Prompt 成长系统。用户把真实工作中的问题、原始 Prompt、AI 回答、调试过程和最终经验记录下来，系统据此优化当前 Prompt，并提取可复用的 Prompt 规则，供以后生成更贴合用户习惯的 Prompt。

核心不是积累领域知识，而是积累：

> 在什么场景下，怎样组织上下文、约束和输出要求，对这个用户最有效。

产品闭环：

```text
真实工作 → 原始 Prompt → AI 结果 → 反馈/调试 → 经验 → Prompt Memory
     ↑                                                        ↓
     └────────────── 生成更适合用户的 Prompt ←───────────────┘
```

## 2. MVP 目标与边界

### 2.0 已确认的产品决策

以下决策已确认，作为当前 MVP 的默认实现方向：

| 决策项 | 当前方案 |
|---|---|
| 首要用户场景 | 嵌入式 Debug，优先覆盖 STM32 / UART / DMA / I2C 等问题 |
| 输入方式 | 手动录入表单，支持粘贴 Prompt、AI 回答和调试内容 |
| 使用时机 | 提问前优化；问题解决后复盘学习 |
| 真实效果指标 | 用户反馈问题是否得到解决，而不是只看模型评分 |
| 规则保存 | AI 先生成草稿，用户确认后才进入 Prompt Memory |
| 存储策略 | 本地优先，MVP 使用 JSON 文件 |
| 外部集成 | MVP 不自动读取或调用聊天工具；后续再考虑导入 |

这些决策的目标是优先验证“记录真实问题 → 形成规则 → 改善下一次提问”的闭环，而不是优先验证自动化或平台集成。

### 2.1 三小时 MVP 的唯一目标

跑通一次完整闭环：

```text
输入原始 Prompt + 工作上下文 + 结果/经验
→ AI 分析
→ 输出优化后的 Prompt
→ 输出一条可复用规则
→ 保存记录
→ 下一次生成时能检索并使用这条规则
```

### 2.2 MVP 必须具备

- New Prompt：录入问题、原始 Prompt、上下文和结果，默认面向嵌入式 Debug。
- Improve Prompt：生成结构化优化 Prompt，并解释改动原因。
- Judge：对原始 Prompt 和优化 Prompt 做可解释的维度评分。
- Debug Log：追加时间线式反馈和调试记录。
- Learn：从一次记录中提取一条经验规则，先保存为草稿，用户确认后进入 Memory。
- Prompt Library：按领域、标签查看已保存的经验。
- Generate：输入新问题，检索相关经验后生成最终 Prompt。
- 本地持久化：优先 JSON 文件；数据结构应可迁移到 SQLite。

### 2.3 明确不做

- 不训练模型、不微调模型。
- 不做复杂 RAG、向量数据库、自动埋点或多用户协作。
- 不自动调用 Codex、Claude 或 ChatGPT 执行最终 Prompt。
- 不把模型评分视为真实效果证明；评分只用于解释优化方向。
- 不在 MVP 中实现复杂账号、权限、支付和云同步。
- 不自动读取 Codex、Claude 或 ChatGPT 的聊天记录。
- 不为多个领域同时做深度优化；其他领域只作为通用文本输入保留。

## 3. 用户与核心场景

### 3.1 目标用户

经常使用 AI 解决嵌入式开发问题的个人开发者，尤其是需要反复调试、分析和迭代的用户。

### 3.2 首要场景：嵌入式 Debug

用户输入：“STM32 UART DMA 收不到数据”。系统应能结合历史经验提醒或补齐：

- 硬件/芯片、框架和操作系统。
- 外设、驱动模式、Buffer 和接收 API。
- Expected 与 Actual 的区别。
- 已经排查过的内容。
- 先诊断和建议日志，再修改代码。
- 按可能性排序输出原因。

### 3.3 次要场景

- C/C++ Bug Fix、Code Review、Refactoring。
- 研究、推理、Agent 类 Prompt。

## 4. 核心领域模型

### 4.1 对象关系

```text
Prompt Case（一次真实工作记录）
├── Original Prompt（用户最初写的 Prompt）
├── Context（工作背景）
├── AI Result（AI 结果，可选）
├── Debug Logs（调试/反馈时间线）
├── Outcome（最终结果，可选）
├── Improved Prompt（优化版本，可选）
├── Judge Result（原始/优化评分，可选）
└── Learned Rule（从案例提取的可复用规则，可选）

Learned Rule
└── 可被 Generate 检索，并影响新 Prompt 的生成
```

### 4.2 关键原则

- 案例是事实记录；规则是从一个或多个案例归纳出的可复用经验。
- 原始 Prompt 必须保留，优化 Prompt 是派生结果，不能覆盖原文。
- AI 生成内容必须标记为建议/推断，不能伪装成用户确认过的事实。
- 规则必须能追溯到来源案例，便于用户纠错或删除。
- MVP 中“相关经验”先使用关键词和标签检索；接口层预留替换为向量检索的可能。

## 5. 产品流程

### 5.1 Improve Prompt

输入：问题、原始 Prompt、上下文、已有结果。  
输出：

1. 优化后的 Prompt，使用清晰的角色/环境/问题/已知信息/任务/约束/输出格式结构。
2. 改动说明，最多 5 条，必须对应实际增加或澄清的内容。
3. 原始 Prompt 与优化 Prompt 的 Judge 评分。
4. 缺失信息清单；信息不足时应提出问题，不能凭空编造。

### 5.2 Learn

用户可以追加 Debug Log，填写或选择 Outcome，并点击 Learn。系统提取一条规则草稿。只有用户点击“确认保存”后，规则才进入 Prompt Memory：

```text
标题：一句话概括
领域：如 Embedded / UART / DMA
经验：发生了什么、什么信息有帮助
Prompt Rule：下次 Prompt 应明确提供什么、要求什么
标签：最多 6 个
置信度：low / medium / high
来源：案例 ID
```

用户确认前，规则可以编辑、丢弃或重新生成；确认后仍可编辑、归档或删除，但必须保留来源案例关联。

### 5.4 Outcome 反馈

案例解决后，用户选择一次结果反馈：

```text
未验证 / 有帮助 / 部分解决 / 已解决 / 无帮助
```

该反馈用于判断规则是否值得继续使用。MVP 不计算复杂的规则成功率，只保存反馈并在案例和规则详情中展示。

### 5.3 Generate

输入一个新问题。系统：

1. 从 Library 检索最多 7 条相关规则。
2. 展示命中的规则，让用户知道哪些记忆被使用。
3. 结合当前问题生成最终 Prompt。
4. 明确区分“来自历史经验的建议”和“当前输入中的事实”。
5. 允许复制 Prompt，并允许用户保存为新案例。

## 6. Judge 评分规范

评分不是判断答案对错，而是判断 Prompt 是否提供了足够的任务信息。每项 0–20 分，总分 100：

| 维度 | 判断重点 |
|---|---|
| Context | 环境、背景、输入是否足够 |
| Specificity | 是否具体，避免“帮我看看” |
| Constraints | 是否说明边界、禁止事项和已排查内容 |
| Task clarity | 任务、优先级和成功标准是否明确 |
| Output format | 期望的回答结构、格式和验证方式是否明确 |

评分输出必须包含每项分数、简短理由、最优先的改进建议。原始 Prompt 和优化 Prompt 使用同一评分标准，方便比较；不要声称分数等同于回答质量或实际成功率。

## 7. 推荐技术方案

### MVP

- 前端：React + Vite + Tailwind。
- 后端：Node.js，提供轻量 HTTP API。
- 存储：JSON 文件；每次写入使用临时文件替换，避免半写入。
- LLM：通过统一 Provider 接口调用用户已有 API Token。
- 检索：标准化文本 + 标签/领域关键词匹配，按相关度排序。

### 后续演进

1. JSON → SQLite，增加查询、迁移和并发写入能力。
2. 关键词检索 → embeddings + 混合检索。
3. 单用户本地应用 → 可选登录和加密同步。
4. 单次规则 → 根据多次案例统计规则的有效性。
5. 仅生成 Prompt → 记录用户实际采用的 Prompt 与结果，形成效果反馈。

## 8. 数据模型

```ts
type PromptCase = {
  id: string;
  title: string;
  domain?: string;
  problem: string;
  originalPrompt: string;
  context?: string;
  aiResult?: string;
  debugLogs: DebugLog[];
  outcome?: string;
  improvedPrompt?: ImprovedPrompt;
  judge?: JudgeComparison;
  learnedRuleId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Outcome = "unverified" | "helpful" | "partially_solved" | "solved" | "not_helpful";

type DebugLog = {
  id: string;
  content: string;
  createdAt: string;
};

type ImprovedPrompt = {
  content: string;
  reasons: string[];
  missingInformation: string[];
  createdAt: string;
};

type JudgeComparison = {
  original: ScoreBreakdown;
  improved: ScoreBreakdown;
  createdAt: string;
};

type ScoreBreakdown = {
  context: number;
  specificity: number;
  constraints: number;
  taskClarity: number;
  outputFormat: number;
  total: number;
  suggestions: string[];
};

type LearnedRule = {
  id: string;
  title: string;
  domain?: string;
  experience: string;
  promptRule: string;
  tags: string[];
  confidence: "low" | "medium" | "high";
  status: "draft" | "confirmed" | "archived";
  sourceCaseIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

## 9. API 边界

```text
GET    /api/cases
POST   /api/cases
GET    /api/cases/:id
PATCH  /api/cases/:id
POST   /api/cases/:id/improve
POST   /api/cases/:id/judge
POST   /api/cases/:id/learn
POST   /api/cases/:id/rules/:ruleId/confirm
POST   /api/cases/:id/rules/:ruleId/discard
POST   /api/cases/:id/logs

GET    /api/rules?query=&domain=&tag=
POST   /api/generate
```

LLM 调用必须收敛在服务端的独立模块中，例如 `PromptCoachProvider`，业务层只依赖结构化输入/输出，不直接拼接供应商 SDK 调用。所有生成接口都应返回可展示的错误信息，并保留原始输入。

## 10. Prompt 生成契约

系统内部 Prompt 应要求模型：

- 只使用用户提供的事实；不确定内容放入缺失信息清单。
- 先分析输入质量，再给出优化结果。
- 优化必须保留用户真实意图，不为了“结构完整”添加无关内容。
- 规则应描述“未来 Prompt 如何写”，而不是只复述本次技术结论。
- 输出严格 JSON，由应用负责渲染；解析失败时允许一次修复重试，并向用户提示失败。

## 11. 页面与交互要求

### New Prompt

表单字段：问题、原始 Prompt、上下文、AI 结果/最终经验。默认领域为 Embedded，可添加芯片、框架、外设等标签。主按钮为 Improve Prompt。优化结果与改动原因并排或上下对照展示，提供复制按钮。

### Debug Log

在案例详情页展示时间线。每条记录可追加，不修改历史内容；支持标记 Outcome，并从当前全部材料触发 Learn。生成的规则首先显示为待确认草稿。

### Prompt Library

按领域、标签筛选规则；每条规则显示经验、Prompt Rule、置信度和来源案例。规则支持编辑、归档和删除。

### Generate

顶部输入当前嵌入式问题，可填写芯片、框架和外设；中间显示命中的历史规则；底部显示最终 Prompt、生成依据和复制按钮。没有命中规则时仍可生成，但要明确提示“本次未使用历史经验”。

## 12. 验收标准

- 用户可以在 2 分钟内创建一个案例并看到优化 Prompt。
- 原始 Prompt、优化 Prompt、改动原因和评分均可区分查看。
- 用户可以追加至少 3 条 Debug Log，并从案例生成一条规则。
- 规则先以草稿出现；只有用户确认后才进入 Library，并带有标签、置信度和来源案例。
- Generate 能根据关键词命中已保存规则，并展示命中内容。
- 用户可以为案例填写 Outcome，至少支持“已解决”和“无帮助”两种结果。
- 没有 API Token、模型超时、模型返回非法结构时，页面不会丢失用户输入。
- 刷新页面后案例和规则仍存在。
- 任何模型输出都不能覆盖原始 Prompt 或历史 Debug Log。
- 评分维度总分计算正确，且分数范围为 0–100。

## 13. 3 小时实现顺序

### 0–30 分钟：骨架

创建前端路由、服务端 API、JSON 存储和统一类型；默认准备一个 STM32 UART DMA 示例案例，先验证页面结构。

### 30–90 分钟：核心闭环

完成 New Prompt、Improve Prompt、案例保存和详情页；接入一个 LLM Provider，必要时提供 Mock Provider。

### 90–135 分钟：Memory

完成 Debug Log、Outcome、Learn 草稿、人工确认、规则列表和关键词检索；让 Generate 使用已确认规则生成 Prompt。

### 135–165 分钟：Judge 与容错

加入评分对比、JSON 解析修复、超时/空 Token 错误处理和复制操作。

### 165–180 分钟：验收

用“STM32 UART DMA 收不到数据”跑通完整演示，检查刷新持久化、空状态、错误状态和移动端基本可用性。

## 14. 风险与控制

| 风险 | 控制方式 |
|---|---|
| 模型编造用户没有提供的环境 | 强制输出缺失信息，不允许静默补全 |
| 评分看起来精确但缺乏实证 | 文案称为 Prompt 质量指标，不称为成功概率 |
| 规则质量不稳定 | 保存置信度、来源案例，允许人工编辑/删除 |
| API 成本和延迟过高 | 默认短上下文、单次调用、支持 Mock Provider |
| 隐私泄露 | MVP 默认本地存储；界面提示发送给模型前需注意敏感信息 |
| 过早引入 RAG | 先验证关键词检索是否能支持真实工作流 |

## 15. 成功指标

MVP 不以“模型评分提高”作为唯一成功标准。优先观察：

- 用户是否完成至少 3 个真实案例。
- 用户是否愿意为案例追加 Debug Log 和 Outcome。
- 生成的规则是否在下一次相关问题中被实际采用。
- 采用规则的案例是否更容易达到“有帮助”或“已解决”。
- 用户是否能一眼看懂 Prompt 为什么被改写。
- 从新问题到可复制 Prompt 的时间是否明显缩短。

## 16. 后续决策入口

当积累了约 50–100 条真实规则后，再评估：

- 是否需要 embeddings / 向量检索。
- 是否需要规则合并、冲突检测和效果统计。
- 是否需要让用户反馈“这条规则有帮助/没帮助”。
- 是否要支持多个 Prompt Provider 和不同模型的结果对比。
- 是否要将案例中的技术知识与 Prompt 写法知识分离存储。
