import { z } from 'zod'
import {
  ACTIVITY_LABELS, GOAL_LABELS, MEAL_LABELS, type MealType,
} from '#shared/types/domain'
import { useAiProvider } from '../../utils/ai'

const Body = z.object({
  memberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// 產生某位成員某一天的總結（PRD 3.6）：當天已確認的記錄 + 最近 7 天攝取與體重
export default defineEventHandler(async (event) => {
  const { memberId, date } = await readValidatedBody(event, Body.parse)
  const { client, model, logUsage } = await useHouseholdContext(event)

  const { data: memberRow } = await client.from('members').select('*').eq('id', memberId).maybeSingle()
  if (!memberRow) throw createError({ statusCode: 404, statusMessage: '找不到成員' })
  const member = toMember(memberRow)

  const weekStart = addDays(date, -6)
  const [weightsRes, entriesRes] = await Promise.all([
    client.from('weight_logs').select('*').eq('member_id', memberId).lte('date', date)
      .order('date', { ascending: false }).limit(10),
    client.from('entries').select('*').eq('member_id', memberId).eq('status', 'ready')
      .gte('date', weekStart).lte('date', date),
  ])
  if (weightsRes.error) throw createError({ statusCode: 500, statusMessage: weightsRes.error.message })
  if (entriesRes.error) throw createError({ statusCode: 500, statusMessage: entriesRes.error.message })

  const weights = weightsRes.data.map(toWeightLog)
  const latestWeight = weights[0]?.weightKg
  if (latestWeight == null) throw createError({ statusCode: 400, statusMessage: '請先記錄體重' })

  const entryIds = entriesRes.data.map(e => e.id)
  const { data: itemRows, error: itemsError } = entryIds.length
    ? await client.from('entry_items').select('*').in('entry_id', entryIds).order('sort_order')
    : { data: [], error: null }
  if (itemsError) throw createError({ statusCode: 500, statusMessage: itemsError.message })
  const entries = entriesRes.data.map(row =>
    toEntry(row, itemRows.filter(i => i.entry_id === row.id).map(toEntryItem), []),
  )

  const todays = entries.filter(e => e.date === date)
  if (!todays.length) throw createError({ statusCode: 400, statusMessage: '這天還沒有已確認的記錄' })

  const mealOrder = Object.keys(MEAL_LABELS) as MealType[]
  const meals = mealOrder
    .map(mealType => ({
      mealType,
      items: todays.filter(e => e.mealType === mealType).flatMap(e => e.items)
        .map(({ name, portion, kcal, proteinG, carbsG, fatG }) => ({ name, portion, kcal, proteinG, carbsG, fatG })),
    }))
    .filter(m => m.items.length)

  // 只列出有記錄的日子，避免把沒記錄誤當成沒吃
  const last7Days = [...new Set(entries.map(e => e.date))].sort().map(d => ({
    date: d,
    totals: roundNutrients(sumNutrients(entries.filter(e => e.date === d).flatMap(e => e.items))),
  }))

  try {
    const { text, usage } = await useAiProvider(model).dailySummary({
      profile: {
        sex: member.sex === 'male' ? '男' : '女',
        age: ageOn(member.birthYearMonth, date),
        heightCm: member.heightCm,
        activityLevel: ACTIVITY_LABELS[member.activityLevel],
        goal: GOAL_LABELS[member.goal],
        dietNote: member.dietNote,
      },
      date,
      targets: dailyTargets(member, latestWeight, date),
      meals,
      last7Days,
      recentWeights: weights.map(w => ({ date: w.date, weightKg: w.weightKg })).reverse(),
    })
    await logUsage('summary', usage)

    const { data, error } = await client
      .from('daily_summaries')
      .upsert(
        { member_id: memberId, date, content: text, generated_at: new Date().toISOString(), is_stale: false },
        { onConflict: 'member_id,date' },
      )
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return toDailySummary(data)
  }
  catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    console.error('summary failed:', e)
    throw createError({ statusCode: 502, statusMessage: aiErrorMessage(e) })
  }
})
