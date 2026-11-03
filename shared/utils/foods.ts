// 食物庫（PRD 3.9）：依份量把食物的基準營養素換算成一個品項
import type { Food, FoodItem } from '../types/domain'

/** 選的份量：公克、常用單位乘以份數，或基準份量乘以份數（克數未知的自訂食物） */
export type FoodAmount =
  | { kind: 'grams', grams: number }
  | { kind: 'portion', label: string, grams: number, quantity: number }
  | { kind: 'base', quantity: number }

function formatNumber(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** 「1 碗」× 2 →「2 碗」；不是「1 X」開頭的單位就寫成「半碗 × 2」 */
function multiplyLabel(label: string, quantity: number): string {
  if (quantity === 1) return label
  const m = label.match(/^1\s*(.+)$/)
  return m ? `${formatNumber(quantity)} ${m[1]}` : `${label} × ${formatNumber(quantity)}`
}

export function portionText(food: Pick<Food, 'baseLabel' | 'baseGrams'>, amount: FoodAmount): string {
  switch (amount.kind) {
    case 'grams':
      return `${formatNumber(amount.grams)}g`
    case 'portion':
      return `${multiplyLabel(amount.label, amount.quantity)}（${formatNumber(amount.grams * amount.quantity)}g）`
    case 'base':
      // 「1 瓶（450ml）」這種自己就寫了克數的單位，不再重複
      return food.baseGrams && !gramsInPortion(food.baseLabel)
        ? `${multiplyLabel(food.baseLabel, amount.quantity)}（${formatNumber(food.baseGrams * amount.quantity)}g）`
        : multiplyLabel(food.baseLabel, amount.quantity)
  }
}

/** 相對於基準份量的倍數 */
export function amountFactor(food: Pick<Food, 'baseGrams'>, amount: FoodAmount): number {
  if (amount.kind === 'base') return amount.quantity
  if (!food.baseGrams) return 0
  const grams = amount.kind === 'grams' ? amount.grams : amount.grams * amount.quantity
  return grams / food.baseGrams
}

export function foodItemFrom(food: Food, amount: FoodAmount): FoodItem {
  const f = amountFactor(food, amount)
  return {
    foodId: food.id,
    name: food.name,
    portion: portionText(food, amount),
    kcal: Math.round(food.kcal * f),
    proteinG: Math.round(food.proteinG * f * 10) / 10,
    carbsG: Math.round(food.carbsG * f * 10) / 10,
    fatG: Math.round(food.fatG * f * 10) / 10,
  }
}

const GRAMS_PATTERN = /(\d+(?:\.\d+)?)\s*(?:公克|克|毫升|g|ml|cc)/i

/** 「1 碗（約 200g）」→ { label: '1 碗', grams: 200 }，用於把 AI 品項存成食物 */
export function splitPortion(portion: string): { label: string, grams: number | null } {
  const grams = gramsInPortion(portion)
  const label = portion.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim()
  return { label: grams && label && !gramsInPortion(label) ? label : portion.trim(), grams }
}

/** 從份量描述找出克數，例如「1 碗（約 200g）」→ 200；找不到回傳 null */
export function gramsInPortion(portion: string): number | null {
  const m = portion.match(GRAMS_PATTERN)
  const n = m ? Number(m[1]) : NaN
  return n > 0 ? n : null
}
