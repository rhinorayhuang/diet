// 每日熱量與三大營養素目標，對應 PRD 3.4
import type { ActivityLevel, Goal, Member, Nutrients, Sex } from '../types/domain'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

/** 每日熱量 = TDEE × 係數：減重抓 20% 缺口，增肌多 10% */
export const GOAL_FACTORS: Record<Goal, number> = {
  lose: 0.8,
  maintain: 1,
  gain: 1.1,
}

/** 減重時每日熱量不低於這個值 */
export const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 }

/** 每公斤去脂體重的蛋白質克數 */
export const PROTEIN_PER_KG_LEAN: Record<Goal, number> = {
  lose: 2,
  maintain: 1.6,
  gain: 2,
}

/** 脂肪佔熱量比例；蛋白質最多佔這個比例；碳水為剩餘熱量 */
export const FAT_RATIO = 0.28
const MAX_PROTEIN_RATIO = 0.35

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

/** Katch-McArdle：知道去脂體重時比 Mifflin 準 */
export function bmrFromLeanMass(leanKg: number): number {
  return 370 + 21.6 * leanKg
}

/** 去脂體重：有體脂率就直接換算，沒有就用 Boer 公式估計 */
export function leanMass(sex: Sex, weightKg: number, heightCm: number, bodyFatPct: number | null): number {
  if (bodyFatPct != null) return weightKg * (1 - bodyFatPct / 100)
  return sex === 'male'
    ? 0.407 * weightKg + 0.267 * heightCm - 19.2
    : 0.252 * weightKg + 0.473 * heightCm - 48.3
}

export function tdee(bmrKcal: number, activity: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activity]
}

/** 蛋白質依去脂體重決定，脂肪固定比例，碳水補足剩下的熱量 */
export function macroTargets(kcal: number, leanKg: number, goal: Goal): Nutrients {
  const proteinG = Math.min(leanKg * PROTEIN_PER_KG_LEAN[goal], (kcal * MAX_PROTEIN_RATIO) / KCAL_PER_G.protein)
  const fatG = (kcal * FAT_RATIO) / KCAL_PER_G.fat
  const carbsG = Math.max(0, (kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs)
  return { kcal, proteinG: Math.round(proteinG), carbsG: Math.round(carbsG), fatG: Math.round(fatG) }
}

export type BmrSource = 'measured' | 'leanMass' | 'formula'

export interface TargetBreakdown {
  bmr: number
  bmrSource: BmrSource
  tdee: number
  leanKg: number
  /** 依目標算出的熱量（不含手動覆寫） */
  autoKcal: number
  targets: Nutrients
}

export function targetBreakdown(member: Member, latestWeightKg: number, onDate: string): TargetBreakdown {
  const leanKg = leanMass(member.sex, latestWeightKg, member.heightCm, member.bodyFatPct)
  const [bmrKcal, bmrSource]: [number, BmrSource] = member.measuredBmr != null
    ? [member.measuredBmr, 'measured']
    : member.bodyFatPct != null
      ? [bmrFromLeanMass(leanKg), 'leanMass']
      : [bmr(member.sex, latestWeightKg, member.heightCm, ageOn(member.birthYearMonth, onDate)), 'formula']
  const tdeeKcal = tdee(bmrKcal, member.activityLevel)
  let autoKcal = tdeeKcal * GOAL_FACTORS[member.goal]
  if (member.goal === 'lose') autoKcal = Math.max(autoKcal, Math.min(MIN_KCAL[member.sex], tdeeKcal))
  autoKcal = Math.round(autoKcal)
  return {
    bmr: Math.round(bmrKcal),
    bmrSource,
    tdee: Math.round(tdeeKcal),
    leanKg: Math.round(leanKg * 10) / 10,
    autoKcal,
    targets: macroTargets(member.calorieTargetOverride ?? autoKcal, leanKg, member.goal),
  }
}

export function dailyTargets(member: Member, latestWeightKg: number, onDate: string): Nutrients {
  return targetBreakdown(member, latestWeightKg, onDate).targets
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
