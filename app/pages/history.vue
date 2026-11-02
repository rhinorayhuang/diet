<script setup lang="ts">
import type { Entry } from '#shared/types/domain'

// PRD 3.7：日曆、7/30 天熱量長條圖（含目標線）、體重折線圖
const { ensureLoaded, activeMembers, latestWeight, weightsOf } = useMembers()
const { memberId, setDefaultMember } = useCurrentMember()
const { listRange } = useEntries()
const toast = useToast()
const selectedDate = useState('today-date', () => taipeiNow().date)

const today = taipeiNow().date

onMounted(async () => {
  await ensureLoaded()
  if (!activeMembers.value.some(m => m.id === memberId.value)) {
    setDefaultMember(activeMembers.value[0]?.id ?? null)
  }
})

const currentMember = computed(() => activeMembers.value.find(m => m.id === memberId.value))
// 以目前體重算的目標，歷史日期一律套用同一個目標
const targetKcal = computed(() => {
  const m = currentMember.value
  const w = m && latestWeight(m.id)
  return m && w ? dailyTargets(m, w, today).kcal : null
})

/** 每天已確認記錄的熱量，沒有已確認記錄的日子不列入 */
function kcalByDate(entries: Entry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (e.status !== 'ready') continue
    map.set(e.date, (map.get(e.date) ?? 0) + sumNutrients(e.items).kcal)
  }
  return map
}

function shortDate(date: string) {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

// ───── 日曆 ─────
const month = ref(today.slice(0, 7))
const monthEntries = ref<Entry[]>([])

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  month.value = d.toISOString().slice(0, 7)
}

const calendar = computed(() => {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const leading = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const kcal = kcalByDate(monthEntries.value)
  const unconfirmed = new Set(monthEntries.value.filter(e => e.status !== 'ready').map(e => e.date))
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month.value}-${String(i + 1).padStart(2, '0')}`
    return { date, day: i + 1, kcal: kcal.get(date), unconfirmed: unconfirmed.has(date) }
  })
  return { leading, days }
})

function dayClass(kcal: number | undefined) {
  const t = targetKcal.value
  if (kcal == null) return 'text-muted'
  if (!t) return 'bg-elevated'
  const ratio = kcal / t
  if (ratio > 1.1) return 'bg-warning/15 text-warning'
  if (ratio >= 0.9) return 'bg-primary/15 text-primary'
  return 'bg-elevated'
}

function openDay(date: string) {
  selectedDate.value = date
  navigateTo('/')
}

async function loadMonth() {
  const m = currentMember.value
  if (!m) return
  const last = calendar.value.days.at(-1)!.date
  try {
    monthEntries.value = await listRange(m.id, `${month.value}-01`, last)
  }
  catch (e) {
    toast.add({ title: '讀取記錄失敗', description: errorMessage(e), color: 'error' })
  }
}
watch([() => currentMember.value?.id, month], loadMonth, { immediate: true })

// ───── 熱量圖 ─────
const range = ref<'7' | '30'>('7')
const rangeEntries = ref<Entry[]>([])

const rangeDates = computed(() => {
  const n = Number(range.value)
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1))
})

const calorieSeries = computed(() => {
  const kcal = kcalByDate(rangeEntries.value)
  const values = rangeDates.value.map(d => {
    const v = kcal.get(d)
    return v == null ? null : Math.round(v)
  })
  const recorded = values.filter((v): v is number => v != null)
  return {
    labels: rangeDates.value.map(shortDate),
    values,
    average: recorded.length ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : null,
    recordedDays: recorded.length,
  }
})

async function loadRange() {
  const m = currentMember.value
  if (!m) return
  try {
    rangeEntries.value = await listRange(m.id, rangeDates.value[0]!, today)
  }
  catch (e) {
    toast.add({ title: '讀取記錄失敗', description: errorMessage(e), color: 'error' })
  }
}
watch([() => currentMember.value?.id, range], loadRange, { immediate: true })

// ───── 體重圖 ─────
const weightSeries = computed(() => {
  const m = currentMember.value
  const logs = m ? [...weightsOf(m.id)].reverse() : []
  return { labels: logs.map(w => shortDate(w.date)), values: logs.map(w => w.weightKg) }
})

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">歷史</h1>
      <MemberSwitcher />
    </header>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span>日曆</span>
          <div class="flex items-center gap-1">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-chevron-left" aria-label="上個月" @click="shiftMonth(-1)" />
            <span class="text-sm tabular-nums">{{ month }}</span>
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-chevron-right" aria-label="下個月" @click="shiftMonth(1)" />
          </div>
        </div>
      </template>

      <div class="grid grid-cols-7 gap-1 text-center">
        <span v-for="w in WEEKDAYS" :key="w" class="text-xs text-dimmed pb-1">{{ w }}</span>
        <span v-for="n in calendar.leading" :key="`pad-${n}`" />
        <button
          v-for="d in calendar.days"
          :key="d.date"
          type="button"
          class="relative aspect-square rounded-md flex flex-col items-center justify-center"
          :class="[dayClass(d.kcal), d.date === today && 'ring-1 ring-inset ring-(--ui-text-muted)']"
          @click="openDay(d.date)"
        >
          <span class="text-sm leading-none">{{ d.day }}</span>
          <span v-if="d.kcal != null" class="text-[10px] leading-tight tabular-nums">{{ Math.round(d.kcal) }}</span>
          <span v-if="d.unconfirmed" class="absolute top-1 right-1 size-1.5 rounded-full bg-warning" />
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-sm bg-primary/15" />接近目標</span>
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-sm bg-warning/15" />超過 10%</span>
        <span class="flex items-center gap-1"><span class="size-2.5 rounded-sm bg-elevated" />低於 90%</span>
        <span class="flex items-center gap-1"><span class="size-1.5 rounded-full bg-warning" />有待確認</span>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span>每日熱量</span>
          <UTabs
            v-model="range"
            size="xs"
            :content="false"
            :items="[{ label: '7 天', value: '7' }, { label: '30 天', value: '30' }]"
          />
        </div>
      </template>
      <CalorieChart :labels="calorieSeries.labels" :values="calorieSeries.values" :target="targetKcal" />
      <p class="mt-2 text-xs text-muted tabular-nums">
        <template v-if="calorieSeries.average != null">
          有記錄的 {{ calorieSeries.recordedDays }} 天平均 {{ calorieSeries.average }} kcal
        </template>
        <template v-else>這段期間沒有已確認的記錄</template>
        <template v-if="targetKcal"> · 虛線為目標 {{ targetKcal }} kcal</template>
      </p>
    </UCard>

    <UCard>
      <template #header>體重</template>
      <WeightChart v-if="weightSeries.values.length" :labels="weightSeries.labels" :values="weightSeries.values" />
      <p v-else class="text-sm text-dimmed">還沒有體重記錄</p>
    </UCard>
  </div>
</template>
