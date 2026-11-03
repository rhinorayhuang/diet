// Supabase 資料列（snake_case）與領域型別（camelCase）之間的轉換
import type { Database } from '#shared/types/database.types'
import type {
  ActivityLevel, DailySummary, Entry, EntryItem, EntryStatus, Food, FoodPortion, Goal, MealType, Member, Sex, WeightLog,
} from '#shared/types/domain'

export type MemberInput = Omit<Member, 'id' | 'householdId' | 'archivedAt'>

type Tables = Database['public']['Tables']

export function toMember(row: Tables['members']['Row']): Member {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    sex: row.sex as Sex,
    birthYearMonth: row.birth_year_month,
    heightCm: Number(row.height_cm),
    activityLevel: row.activity_level as ActivityLevel,
    goal: row.goal as Goal,
    dietNote: row.diet_note,
    calorieTargetOverride: row.calorie_target_override,
    measuredBmr: row.measured_bmr,
    bodyFatPct: row.body_fat_pct == null ? null : Number(row.body_fat_pct),
    archivedAt: row.archived_at,
  }
}

export function fromMemberInput(input: MemberInput): Tables['members']['Insert'] {
  return {
    name: input.name,
    sex: input.sex,
    birth_year_month: input.birthYearMonth,
    height_cm: input.heightCm,
    activity_level: input.activityLevel,
    goal: input.goal,
    diet_note: input.dietNote,
    calorie_target_override: input.calorieTargetOverride,
    measured_bmr: input.measuredBmr,
    body_fat_pct: input.bodyFatPct,
  }
}

export function toEntryItem(row: Tables['entry_items']['Row']): EntryItem {
  return {
    id: row.id,
    entryId: row.entry_id,
    name: row.name,
    portion: row.portion,
    kcal: row.kcal,
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    sortOrder: row.sort_order,
    foodId: row.food_id,
  }
}

export function toEntry(
  row: Tables['entries']['Row'],
  items: EntryItem[],
  photoPaths: string[],
): Entry {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    mealType: row.meal_type as MealType,
    note: row.note,
    status: row.status as EntryStatus,
    items,
    photoPaths,
  }
}

export function toWeightLog(row: Tables['weight_logs']['Row']): WeightLog {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    weightKg: Number(row.weight_kg),
  }
}

export function toDailySummary(row: Tables['daily_summaries']['Row']): DailySummary {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    content: row.content,
    generatedAt: row.generated_at,
    isStale: row.is_stale,
  }
}

export function toFood(row: Tables['foods']['Row']): Food {
  return {
    id: row.id,
    householdId: row.household_id,
    source: row.source as Food['source'],
    name: row.name,
    aliases: row.aliases,
    category: row.category,
    description: row.description,
    baseLabel: row.base_label,
    baseGrams: row.base_grams == null ? null : Number(row.base_grams),
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
  }
}

export function toFoodPortion(row: Tables['food_portions']['Row']): FoodPortion {
  return {
    id: row.id,
    foodId: row.food_id,
    householdId: row.household_id,
    label: row.label,
    grams: Number(row.grams),
  }
}
