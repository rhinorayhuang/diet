// 成員與體重紀錄（PRD 3.2、3.3）。資料量小，整個家庭一次載入
import type { Member, WeightLog } from '#shared/types/domain'

export function useMembers() {
  const supabase = useSupabaseClient()
  const members = useState<Member[]>('members', () => [])
  const weights = useState<WeightLog[]>('weight-logs', () => [])
  const loaded = useState('members-loaded', () => false)

  async function refresh() {
    const [m, w] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase
        .from('weight_logs')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])
    if (m.error) throw m.error
    if (w.error) throw w.error
    members.value = m.data.map(toMember)
    weights.value = w.data.map(toWeightLog)
    loaded.value = true
  }

  async function ensureLoaded() {
    if (!loaded.value) await refresh()
  }

  const activeMembers = computed(() => members.value.filter(m => !m.archivedAt))
  const archivedMembers = computed(() => members.value.filter(m => m.archivedAt))

  function getMember(id: string) {
    return members.value.find(m => m.id === id)
  }

  /** 依日期新到舊 */
  function weightsOf(memberId: string) {
    return weights.value.filter(w => w.memberId === memberId)
  }

  function latestWeight(memberId: string): number | null {
    return weightsOf(memberId)[0]?.weightKg ?? null
  }

  async function createMember(input: MemberInput, initialWeightKg: number): Promise<string> {
    const { data, error } = await supabase
      .from('members')
      .insert(fromMemberInput(input))
      .select('id')
      .single()
    if (error) throw error
    const { error: wError } = await supabase
      .from('weight_logs')
      .insert({ member_id: data.id, date: taipeiNow().date, weight_kg: initialWeightKg })
    if (wError) throw wError
    await refresh()
    return data.id
  }

  async function updateMember(id: string, input: MemberInput) {
    const { error } = await supabase.from('members').update(fromMemberInput(input)).eq('id', id)
    if (error) throw error
    await refresh()
  }

  async function setArchived(id: string, archived: boolean) {
    const { error } = await supabase
      .from('members')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) throw error
    await refresh()
  }

  async function saveWeight(memberId: string, date: string, weightKg: number, id?: string) {
    const { error } = id
      ? await supabase.from('weight_logs').update({ date, weight_kg: weightKg }).eq('id', id)
      : await supabase.from('weight_logs').insert({ member_id: memberId, date, weight_kg: weightKg })
    if (error) throw error
    await refresh()
  }

  async function deleteWeight(id: string) {
    const { error } = await supabase.from('weight_logs').delete().eq('id', id)
    if (error) throw error
    await refresh()
  }

  return {
    members,
    activeMembers,
    archivedMembers,
    loaded,
    refresh,
    ensureLoaded,
    getMember,
    weightsOf,
    latestWeight,
    createMember,
    updateMember,
    setArchived,
    saveWeight,
    deleteWeight,
  }
}
