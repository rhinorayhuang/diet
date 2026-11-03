// AI 供應商介面（PRD 第 6 節）：日後可替換成 Ollama 等其他實作
import type { AiModel, FoodItem, MealType, Nutrients } from '#shared/types/domain'

export type RecognizedItem = FoodItem

export interface AiUsage {
  model: AiModel
  inputTokens: number
  outputTokens: number
}

export interface MealImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  /** base64，不含 data: 前綴 */
  data: string
}

export interface RecognizeMealInput {
  images: MealImage[]
  /** 手動輸入的內容，或照片的文字補充 */
  text?: string
  dietNote?: string | null
}

export interface ReestimateItemInput {
  name: string
  portion: string
  dietNote?: string | null
}

export interface DailySummaryInput {
  profile: {
    sex: string
    age: number
    heightCm: number
    activityLevel: string
    goal: string
    bodyFatPct: number | null
    measuredBmr: number | null
    dietNote: string | null
  }
  date: string
  targets: Nutrients
  meals: { mealType: MealType, items: RecognizedItem[] }[]
  last7Days: { date: string, totals: Nutrients }[]
  recentWeights: { date: string, weightKg: number }[]
}

export interface AiProvider {
  recognizeMeal(input: RecognizeMealInput): Promise<{ items: RecognizedItem[], usage: AiUsage }>
  reestimateItem(input: ReestimateItemInput): Promise<{ item: RecognizedItem, usage: AiUsage }>
  dailySummary(input: DailySummaryInput): Promise<{ text: string, usage: AiUsage }>
}

export class AiRefusalError extends Error {}
