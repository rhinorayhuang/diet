import { serverSupabaseUser } from '#supabase/server'

// 對一筆「待分析」記錄執行 AI 辨識（PRD 3.5.2–3.5.5）
// TODO:
// 1. 讀取 entry、照片（Supabase Storage）與成員的飲食備註
// 2. 狀態改為 analyzing，呼叫 useAiProvider(model).recognizeMeal(...)
// 3. 成功：回傳品項清單給前端確認；失敗：狀態改為 failed
// 4. 寫入 ai_usage_logs（estimateCostUsd）
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401 })

  throw createError({ statusCode: 501, statusMessage: '尚未實作' })
})
