import { Buffer } from 'node:buffer'
import { useAiProvider } from '../../../utils/ai'
import type { MealImage } from '../../../utils/ai/provider'

// 對一筆記錄執行 AI 辨識（PRD 3.5.2–3.5.5）。品項先以「待確認」存入，使用者確認後才計入當日攝取
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { client, model, logUsage } = await useHouseholdContext(event)

  const { data: entry, error } = await client.from('entries').select('*').eq('id', id).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!entry) throw createError({ statusCode: 404, statusMessage: '找不到這筆記錄' })

  const [{ data: member }, { data: photos }] = await Promise.all([
    client.from('members').select('diet_note').eq('id', entry.member_id).single(),
    client.from('entry_photos').select('storage_path').eq('entry_id', id).order('sort_order'),
  ])

  if (!photos?.length && !entry.note?.trim()) {
    throw createError({ statusCode: 400, statusMessage: '沒有照片也沒有文字，無法分析' })
  }

  await client.from('entries').update({ status: 'analyzing' }).eq('id', id)

  try {
    const images: MealImage[] = await Promise.all((photos ?? []).map(async (p) => {
      const { data, error: dlError } = await client.storage.from('meal-photos').download(p.storage_path)
      if (dlError) throw dlError
      return {
        mediaType: 'image/jpeg' as const,
        data: Buffer.from(await data.arrayBuffer()).toString('base64'),
      }
    }))

    const { items, usage } = await useAiProvider(model).recognizeMeal({
      images,
      text: entry.note ?? undefined,
      dietNote: member?.diet_note,
    })
    await logUsage('recognize', usage)

    // 先存成待確認的品項，離開確認畫面再回來時不必重新分析
    await client.from('entry_items').delete().eq('entry_id', id)
    if (items.length) {
      const { error: insError } = await client.from('entry_items').insert(items.map((item, i) => ({
        entry_id: id,
        name: item.name,
        portion: item.portion,
        kcal: item.kcal,
        protein_g: item.proteinG,
        carbs_g: item.carbsG,
        fat_g: item.fatG,
        sort_order: i,
      })))
      if (insError) throw insError
    }
    await client.from('entries').update({ status: 'pending' }).eq('id', id)
    return { items }
  }
  catch (e) {
    await client.from('entries').update({ status: 'failed' }).eq('id', id)
    console.error('analyze failed:', e)
    throw createError({ statusCode: 502, statusMessage: aiErrorMessage(e) })
  }
})
