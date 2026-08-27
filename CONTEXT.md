# Prompt Coach 领域词汇

本词汇表定义项目中的核心概念。代码、接口、文档和 UI 尽量使用这些名称。

## 核心对象

**Prompt Case（案例）**：一次真实工作中，从问题输入到结果反馈的完整记录。  
_避免_：Session、Task（这些词容易与应用会话或开发任务混淆）

**Original Prompt（原始 Prompt）**：用户在没有经过 Prompt Coach 优化前实际写下的提示词。它是不可覆盖的事实记录。  
_避免_：Raw Prompt、Old Prompt

**Improved Prompt（优化 Prompt）**：Prompt Coach 基于当前案例和相关经验生成的候选提示词。它是派生结果，不代表用户已经采用。  
_避免_：Final Prompt（除非用户明确确认采用）

**Debug Log（调试记录）**：用户按时间追加的排查过程、AI 建议、验证结果或新发现。  
_避免_：Chat History、Comment

**Outcome（结果）**：用户对本次问题最终状态的描述，例如“问题解决”或“仍未解决”。  
_避免_：Answer（AI 的回答不是用户问题的最终结果）

**Outcome Feedback（结果反馈）**：用户对案例实际效果的离散反馈，当前包括未验证、有帮助、部分解决、已解决和无帮助。它描述使用结果，不是模型对答案的自评分。  
_避免_：Score、Rating

## 记忆与学习

**Learned Rule（经验规则）**：从一个或多个案例中归纳出的、指导未来 Prompt 如何组织信息的可复用规则。  
_避免_：Memory（Memory 是产品能力，Rule 是其中的内容）、Tip、Knowledge

**Rule Draft（规则草稿）**：模型从案例提取、但尚未被用户确认的经验规则。草稿不能被 Generate 使用。  
_避免_：Learned Rule（未确认前还不是正式规则）

**Prompt Memory（Prompt 记忆）**：系统保存、检索和应用 Learned Rule 的整体能力。  
_避免_：Knowledge Base（本项目重点不是一般领域知识库）

**Retrieved Rule（命中规则）**：Generate 针对当前问题检索出的候选 Learned Rule。命中不代表规则一定正确或适用。  
_避免_：Relevant Answer、Recommendation

**Prompt Style（Prompt 风格）**：从用户历史案例中观察到的表达偏好和组织习惯，例如偏好先列验证步骤、要求按概率排序。  
_避免_：User Personality、User Profile

## 质量与生成

**Judge Result（评分结果）**：按照固定维度对 Prompt 信息质量进行的可解释评分，不等同于 AI 最终答案质量。  
_避免_：Truth Score、Success Probability

**Missing Information（缺失信息）**：为了让 Prompt 更可执行而需要用户补充、但当前材料中不存在的事实或约束。  
_避免_：Assumption（假设是模型推断，缺失信息是待补充事实）

**Generate（生成）**：将当前问题、命中规则和用户 Prompt Style 组合成可复制 Prompt 的流程。  
_避免_：Search（检索只是 Generate 的一个步骤）、Optimize（Optimize 专指已有案例的改善）
