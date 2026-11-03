// 食物庫（PRD 3.9）：搜尋、最近常吃、常用單位與家庭自訂食物
import type { Food, FoodPortion, RecentFood } from '#shared/types/domain'

export interface CustomFoodInput {
  name: string
  baseLabel: string
  baseGrams: number | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export function useFoods() {
  const supabase = useSupabaseClient()

  async function search(q: string): Promise<Food[]> {
    const { data, error } = await supabase.rpc('search_foods', { q, max_results: 30 })
    if (error) throw error
    return data.map(toFood)
  }

  async function recent(memberId: string): Promise<RecentFood[]> {
    const { data, error } = await supabase.rpc('recent_foods', { mid: memberId, max_results: 12 })
    if (error) throw error
    return data.map(r => ({
      foodId: r.food_id,
      name: r.name,
      portion: r.portion,
      kcal: r.kcal,
      proteinG: Number(r.protein_g),
      carbsG: Number(r.carbs_g),
      fatG: Number(r.fat_g),
      times: Number(r.times),
    }))
  }

  async function getFood(id: string): Promise<Food | null> {
    const { data, error } = await supabase.from('foods').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? toFood(data) : null
  }

  async function portionsOf(foodId: string): Promise<FoodPortion[]> {
    const { data, error } = await supabase
      .from('food_portions')
      .select('*')
      .eq('food_id', foodId)
      .order('grams')
    if (error) throw error
    return data.map(toFoodPortion)
  }

  async function addPortion(foodId: string, label: string, grams: number): Promise<FoodPortion> {
    const { data, error } = await supabase
      .from('food_portions')
      .insert({ food_id: foodId, label, grams })
      .select()
      .single()
    if (error) throw error
    return toFoodPortion(data)
  }

  async function listCustom(): Promise<Food[]> {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('source', 'custom')
      .order('name')
    if (error) throw error
    return data.map(toFood)
  }

  function toRow(input: CustomFoodInput) {
    return {
      source: 'custom',
      name: input.name,
      base_label: input.baseLabel,
      base_grams: input.baseGrams,
      kcal: input.kcal,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
    }
  }

  async function createCustom(input: CustomFoodInput): Promise<Food> {
    const { data, error } = await supabase.from('foods').insert(toRow(input)).select().single()
    if (error) throw error
    return toFood(data)
  }

  async function updateCustom(id: string, input: CustomFoodInput) {
    const { error } = await supabase.from('foods').update(toRow(input)).eq('id', id)
    if (error) throw error
  }

  async function deleteCustom(id: string) {
    const { error } = await supabase.from('foods').delete().eq('id', id)
    if (error) throw error
  }

  return {
    search, recent, getFood, portionsOf, addPortion, listCustom, createCustom, updateCustom, deleteCustom,
  }
}
