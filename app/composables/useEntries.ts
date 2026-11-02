// 飲食記錄（PRD 3.5）：建立、讀取、確認存檔、刪除，以及呼叫 AI 分析
import type { Entry, FoodItem, MealType } from '#shared/types/domain'

const PHOTO_BUCKET = 'meal-photos'

export function useEntries() {
  const supabase = useSupabaseClient()
  const householdId = useState<string | null>('household-id', () => null)

  async function getHouseholdId(): Promise<string> {
    if (householdId.value) return householdId.value
    const { data, error } = await supabase.from('households').select('id').single()
    if (error) throw error
    householdId.value = data.id
    return data.id
  }

  /** 讀取多筆記錄並附上品項與照片路徑 */
  async function hydrate(rows: Parameters<typeof toEntry>[0][]): Promise<Entry[]> {
    if (!rows.length) return []
    const ids = rows.map(r => r.id)
    const [items, photos] = await Promise.all([
      supabase.from('entry_items').select('*').in('entry_id', ids).order('sort_order'),
      supabase.from('entry_photos').select('*').in('entry_id', ids).order('sort_order'),
    ])
    if (items.error) throw items.error
    if (photos.error) throw photos.error
    return rows.map(r => toEntry(
      r,
      items.data.filter(i => i.entry_id === r.id).map(toEntryItem),
      photos.data.filter(p => p.entry_id === r.id).map(p => p.storage_path),
    ))
  }

  async function listForDay(memberId: string, date: string): Promise<Entry[]> {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('member_id', memberId)
      .eq('date', date)
      .order('created_at')
    if (error) throw error
    return hydrate(data)
  }

  async function getEntry(id: string): Promise<Entry | null> {
    const { data, error } = await supabase.from('entries').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? (await hydrate([data]))[0]! : null
  }

  async function createEntry(input: {
    memberId: string
    date: string
    mealType: MealType
    note: string | null
    photos: Blob[]
  }): Promise<string> {
    const { data, error } = await supabase
      .from('entries')
      .insert({ member_id: input.memberId, date: input.date, meal_type: input.mealType, note: input.note })
      .select('id')
      .single()
    if (error) throw error

    if (input.photos.length) {
      const hid = await getHouseholdId()
      const paths = await Promise.all(input.photos.map(async (blob, i) => {
        const path = `${hid}/${data.id}/${i}.jpg`
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) throw uploadError
        return path
      }))
      const { error: photoError } = await supabase
        .from('entry_photos')
        .insert(paths.map((storage_path, sort_order) => ({ entry_id: data.id, storage_path, sort_order })))
      if (photoError) throw photoError
    }
    return data.id
  }

  /** 確認畫面存檔：以新的品項清單取代舊的，並標記為已確認 */
  async function confirmEntry(id: string, items: FoodItem[], meta: { date: string, mealType: MealType }) {
    const { error: delError } = await supabase.from('entry_items').delete().eq('entry_id', id)
    if (delError) throw delError
    if (items.length) {
      const { error: insError } = await supabase.from('entry_items').insert(items.map((item, i) => ({
        entry_id: id,
        name: item.name,
        portion: item.portion,
        kcal: Math.round(item.kcal),
        protein_g: item.proteinG,
        carbs_g: item.carbsG,
        fat_g: item.fatG,
        sort_order: i,
      })))
      if (insError) throw insError
    }
    const { error } = await supabase
      .from('entries')
      .update({ status: 'ready', date: meta.date, meal_type: meta.mealType, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async function deleteEntry(entry: Entry) {
    if (entry.photoPaths.length) {
      const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(entry.photoPaths)
      if (error) throw error
    }
    const { error } = await supabase.from('entries').delete().eq('id', entry.id)
    if (error) throw error
  }

  /** 回傳與 paths 同順序的簽名網址（1 小時有效） */
  async function photoUrls(paths: string[]): Promise<string[]> {
    if (!paths.length) return []
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
    if (error) throw error
    return data.map(d => d.signedUrl ?? '')
  }

  function analyze(id: string) {
    return $fetch<{ items: FoodItem[] }>(`/api/entries/${id}/analyze`, { method: 'POST' })
  }

  function reestimate(memberId: string, name: string, portion: string) {
    return $fetch<{ item: FoodItem }>('/api/ai/reestimate', {
      method: 'POST',
      body: { memberId, name, portion },
    })
  }

  return { listForDay, getEntry, createEntry, confirmEntry, deleteEntry, photoUrls, analyze, reestimate }
}
