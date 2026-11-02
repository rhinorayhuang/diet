import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { AiModel } from '#shared/types/domain'
import { DEFAULT_AI_MODEL } from '#shared/types/domain'
import { AiRefusalError, type AiUsage } from './ai/provider'
import { estimateCostUsd } from './ai/pricing'

/** 以登入者身分存取 Supabase（受 RLS 保護），並取得家庭設定的模型 */
export async function useHouseholdContext(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401 })

  const client = await serverSupabaseClient(event)
  const { data, error } = await client.from('households').select('id, ai_model').single()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  async function logUsage(purpose: 'recognize' | 're_estimate' | 'summary', usage: AiUsage) {
    const { error: logError } = await client.from('ai_usage_logs').insert({
      model: usage.model,
      purpose,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: estimateCostUsd(usage),
    })
    // 用量記錄失敗不影響主要流程
    if (logError) console.error('ai_usage_logs insert failed:', logError.message)
  }

  return {
    client,
    householdId: data.id,
    model: (data.ai_model || DEFAULT_AI_MODEL) as AiModel,
    logUsage,
  }
}

/** 把 AI 呼叫的錯誤轉成使用者看得懂的訊息 */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiRefusalError) return 'AI 無法處理這筆內容'
  const status = (e as { status?: number })?.status
  if (status === 401) return 'Anthropic API key 無效'
  if (status === 429) return 'AI 請求太頻繁，請稍後再試'
  if (status && status >= 500) return 'AI 服務暫時無法使用，請稍後再試'
  return (e as { statusMessage?: string, message?: string })?.statusMessage
    ?? (e as { message?: string })?.message
    ?? 'AI 分析失敗'
}
