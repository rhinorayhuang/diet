// 用於設定頁「本月預估 API 花費」，單位：美金 / 每百萬 token
import type { AiModel } from '#shared/types/domain'
import type { AiUsage } from './provider'

const PRICES: Record<AiModel, { input: number, output: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
}

export function estimateCostUsd(usage: AiUsage): number {
  const p = PRICES[usage.model]
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000
}
