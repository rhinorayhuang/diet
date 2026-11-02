// 領域型別，對應 PRD 第 3、5 節

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'
export type Goal = 'lose' | 'maintain' | 'gain'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type EntryStatus = 'pending' | 'analyzing' | 'ready' | 'failed'
export type AiModel = 'claude-sonnet-5-5' | 'claude-opus-5-5' | 'claude-haiku-5-5'

export interface Member {
  id: string
  householdId: string
  name: string
  sex: Sex
  /** YYYY-MM */
  birthYearMonth: string
  heightCm: number
  activityLevel: ActivityLevel
  goal: Goal
  dietNote: string | null
  calorieTargetOverride: number | null
  archivedAt: string | null
}

export interface WeightLog {
  id: string
  memberId: string
  /** YYYY-MM-DD（台灣時間） */
  date: string
  weightKg: number
}

export interface Nutrients {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

/** 一個食物品項（AI 辨識結果或使用者編輯中的內容） */
export interface FoodItem extends Nutrients {
  name: string
  portion: string
}

export interface EntryItem extends FoodItem {
  id: string
  entryId: string
  sortOrder: number
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  pending: '待確認',
  analyzing: '分析中',
  ready: '已確認',
  failed: '分析失敗',
}

/** PRD 3.5.2 */
export const MAX_PHOTOS_PER_ENTRY = 3

export interface Entry {
  id: string
  memberId: string
  date: string
  mealType: MealType
  note: string | null
  status: EntryStatus
  items: EntryItem[]
  photoPaths: string[]
}

export interface DailySummary {
  id: string
  memberId: string
  date: string
  content: string
  generatedAt: string
  isStale: boolean
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐',
  light: '輕度',
  moderate: '中度',
  active: '高度',
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose: '減重',
  maintain: '維持',
  gain: '增肌',
}

export const AI_MODEL_LABELS: Record<AiModel, string> = {
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-opus-5-5': 'Opus 5.5',
  'claude-haiku-5-5': 'Haiku 5.5',
}

export const DEFAULT_AI_MODEL: AiModel = 'claude-sonnet-5-5'
