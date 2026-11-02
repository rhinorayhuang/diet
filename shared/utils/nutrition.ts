// 每日熱量與三大營養素目標，對應 PRD 3.4
import type { ActivityLevel, Goal, Member, Nutrients, Sex } from '../types/domain'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
}

/** 熱量佔比：蛋白質／碳水／脂肪 */
export const MACRO_RATIO = { protein: 0.25, carbs: 0.5, fat: 0.25 }

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

/** 以 birthYearMonth（YYYY-MM）計算在 onDate（YYYY-MM-DD）當天的足歲 */
export function ageOn(birthYearMonth: string, onDate: string): number {
  const [by, bm] = birthYearMonth.split('-').map(Number) as [number, number]
  const [y, m] = onDate.split('-').map(Number) as [number, number]
  return y - by - (m < bm ? 1 : 0)
}

/** Mifflin-St Jeor */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function tdee(bmrKcal: number, activity: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activity]
}

export function macroTargets(kcal: number): Nutrients {
  return {
    kcal,
    proteinG: Math.round((kcal * MACRO_RATIO.protein) / KCAL_PER_G.protein),
    carbsG: Math.round((kcal * MACRO_RATIO.carbs) / KCAL_PER_G.carbs),
    fatG: Math.round((kcal * MACRO_RATIO.fat) / KCAL_PER_G.fat),
  }
}

export function dailyTargets(member: Member, latestWeightKg: number, onDate: string): Nutrients {
  if (member.calorieTargetOverride != null) {
    return macroTargets(member.calorieTargetOverride)
  }
  const age = ageOn(member.birthYearMonth, onDate)
  const kcal = tdee(bmr(member.sex, latestWeightKg, member.heightCm, age), member.activityLevel)
    + GOAL_ADJUSTMENTS[member.goal]
  return macroTargets(Math.round(kcal))
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      proteinG: acc.proteinG + n.proteinG,
      carbsG: acc.carbsG + n.carbsG,
      fatG: acc.fatG + n.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    proteinG: Math.round(n.proteinG),
    carbsG: Math.round(n.carbsG),
    fatG: Math.round(n.fatG),
  }
}
