// 對應 supabase/migrations 的資料表型別，格式與 `supabase gen types typescript` 相同。
// 修改 migration 後請同步更新（或改用 CLI 重新產生）。

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

type FoodRow = {
  id: string
  household_id: string | null
  source: string
  source_code: string | null
  name: string
  aliases: string | null
  category: string | null
  description: string | null
  base_label: string
  base_grams: number | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      households: Table<{
        id: string
        owner_user_id: string
        name: string
        ai_model: string
        created_at: string
      }, 'owner_user_id'>
      members: Table<{
        id: string
        household_id: string
        name: string
        sex: string
        birth_year_month: string
        height_cm: number
        activity_level: string
        goal: string
        diet_note: string | null
        calorie_target_override: number | null
        measured_bmr: number | null
        body_fat_pct: number | null
        archived_at: string | null
        created_at: string
      }, 'name' | 'sex' | 'birth_year_month' | 'height_cm' | 'activity_level'>
      weight_logs: Table<{
        id: string
        member_id: string
        date: string
        weight_kg: number
        created_at: string
      }, 'member_id' | 'date' | 'weight_kg'>
      entries: Table<{
        id: string
        member_id: string
        date: string
        meal_type: string
        note: string | null
        status: string
        created_at: string
        updated_at: string
      }, 'member_id' | 'date' | 'meal_type'>
      entry_photos: Table<{
        id: string
        entry_id: string
        storage_path: string
        sort_order: number
      }, 'entry_id' | 'storage_path'>
      entry_items: Table<{
        id: string
        entry_id: string
        name: string
        portion: string
        kcal: number
        protein_g: number
        carbs_g: number
        fat_g: number
        sort_order: number
        food_id: string | null
      }, 'entry_id' | 'name' | 'portion' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
      foods: Table<FoodRow, 'source' | 'name' | 'base_label' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
      food_portions: Table<{
        id: string
        food_id: string
        household_id: string | null
        label: string
        grams: number
      }, 'food_id' | 'label' | 'grams'>
      daily_summaries: Table<{
        id: string
        member_id: string
        date: string
        content: string
        generated_at: string
        is_stale: boolean
      }, 'member_id' | 'date' | 'content'>
      ai_usage_logs: Table<{
        id: string
        household_id: string
        model: string
        purpose: string
        input_tokens: number
        output_tokens: number
        cost_usd: number
        created_at: string
      }, 'model' | 'purpose' | 'input_tokens' | 'output_tokens' | 'cost_usd'>
    }
    Views: Record<string, never>
    Functions: {
      current_household_id: { Args: Record<string, never>, Returns: string }
      is_household_member: { Args: { mid: string }, Returns: boolean }
      search_foods: { Args: { q: string, max_results?: number }, Returns: FoodRow[] }
      recent_foods: {
        Args: { mid: string, max_results?: number }
        Returns: {
          food_id: string
          name: string
          portion: string
          kcal: number
          protein_g: number
          carbs_g: number
          fat_g: number
          times: number
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
