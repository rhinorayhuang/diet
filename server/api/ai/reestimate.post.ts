import { z } from 'zod'
import { useAiProvider } from '../../utils/ai'

const Body = z.object({
  memberId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  portion: z.string().trim().max(100),
})

// 確認畫面上「重新估算」單一品項（PRD 3.5.4）
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Body.parse)
  const { client, model, logUsage } = await useHouseholdContext(event)

  const { data: member } = await client.from('members').select('diet_note').eq('id', body.memberId).maybeSingle()
  if (!member) throw createError({ statusCode: 404, statusMessage: '找不到成員' })

  try {
    const { item, usage } = await useAiProvider(model).reestimateItem({
      name: body.name,
      portion: body.portion || '1 份',
      dietNote: member.diet_note,
    })
    await logUsage('re_estimate', usage)
    return { item }
  }
  catch (e) {
    console.error('reestimate failed:', e)
    throw createError({ statusCode: 502, statusMessage: aiErrorMessage(e) })
  }
})
