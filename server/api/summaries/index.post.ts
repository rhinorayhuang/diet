import { serverSupabaseUser } from '#supabase/server'

// 產生某位成員某一天的總結（PRD 3.6）
// TODO:
// 1. 讀取成員檔案、最新體重、當日記錄、最近 7 天總量與體重紀錄
// 2. 以 dailyTargets() 算出目標，組成 DailySummaryInput
// 3. 呼叫 useAiProvider(model).dailySummary(...)，upsert daily_summaries（is_stale = false）
// 4. 寫入 ai_usage_logs
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401 })

  throw createError({ statusCode: 501, statusMessage: '尚未實作' })
})
