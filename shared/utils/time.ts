// 日期界線與預設餐別，對應 PRD 3.5.1 與第 8 節
import type { MealType } from '../types/domain'

export const TIME_ZONE = 'Asia/Taipei'

/** 回傳台灣時間的日期（YYYY-MM-DD）與當日分鐘數 */
export function taipeiNow(now: Date = new Date()): { date: string, minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(p => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function defaultMealType(minutes: number): MealType {
  if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return 'breakfast'
  if (minutes >= 10 * 60 + 30 && minutes < 14 * 60 + 30) return 'lunch'
  if (minutes >= 14 * 60 + 30 && minutes < 17 * 60) return 'snack'
  if (minutes >= 17 * 60 && minutes < 21 * 60) return 'dinner'
  return 'snack'
}

/** YYYY-MM-DD 加減天數 */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
