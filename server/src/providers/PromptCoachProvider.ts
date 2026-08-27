import type { PromptCase, LearnedRule, ScoreBreakdown, ImprovedPrompt } from "@prompt-coach/shared";

export type ImproveResult = {
  improvedPrompt: ImprovedPrompt;
  provider: string;
};

export type JudgeResult = {
  original: ScoreBreakdown;
  improved: ScoreBreakdown;
};

export type LearnResult = {
  rule: LearnedRule;
};

export type GenerateResult = {
  prompt: string;
  retrievedRuleIds: string[];
  provider: string;
  usedEmbeddedFallback?: boolean;
};

export interface PromptCoachProvider {
  name: string;
  improve(input: { promptCase: PromptCase; retrievedRules: LearnedRule[] }): Promise<ImproveResult>;
  judge(input: { originalPrompt: string; improvedPrompt: string; problem: string; context?: string }): Promise<JudgeResult>;
  learn(input: { promptCase: PromptCase }): Promise<LearnResult>;
  generate(input: { problem: string; domain?: string; context?: string; retrievedRules: LearnedRule[] }): Promise<GenerateResult>;
}
