// 每日 AI 總結（PRD 3.6）：每位成員每天保留一份，記錄變動後標記為過期
import type { DailySummary } from '#shared/types/domain'

export function useSummaries() {
  const supabase = useSupabaseClient()

  async function getSummary(memberId: string, date: string): Promise<DailySummary | null> {
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('member_id', memberId)
      .eq('date', date)
      .maybeSingle()
    if (error) throw error
    return data ? toDailySummary(data) : null
  }

  function generateSummary(memberId: string, date: string) {
    return $fetch<DailySummary>('/api/summaries', { method: 'POST', body: { memberId, date } })
  }

  return { getSummary, generateSummary }
}
