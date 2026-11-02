<script setup lang="ts">
import {
  ENTRY_STATUS_LABELS, MEAL_LABELS, type DailySummary, type Entry, type MealType,
} from '#shared/types/domain'

const date = useState('today-date', () => taipeiNow().date)

const { ensureLoaded, activeMembers, latestWeight, loaded } = useMembers()
const { memberId, setDefaultMember } = useCurrentMember()
const { listForDay, photoUrls, retryFailed } = useEntries()
const { getSummary, generateSummary } = useSummaries()
const toast = useToast()

// 每次打開 App 只自動重試一次
const autoRetried = useState('auto-retried', () => false)

onMounted(async () => {
  await ensureLoaded()
  // 本機記住的成員不存在或已封存時，改用第一位
  if (!activeMembers.value.some(m => m.id === memberId.value)) {
    setDefaultMember(activeMembers.value[0]?.id ?? null)
  }
  if (!autoRetried.value && memberId.value) {
    autoRetried.value = true
    const count = await retryFailed(memberId.value).catch(() => 0)
    if (count) {
      toast.add({ title: `已重新分析 ${count} 筆失敗的記錄，請確認`, color: 'info' })
      await loadEntries()
    }
  }
})

const currentMember = computed(() => activeMembers.value.find(m => m.id === memberId.value))
const targets = computed(() => {
  const m = currentMember.value
  const w = m && latestWeight(m.id)
  return m && w ? dailyTargets(m, w, date.value) : null
})

// ───── 當日記錄 ─────
const entries = ref<Entry[]>([])
const thumbs = ref<Record<string, string>>({})
const entriesLoading = ref(false)

async function loadEntries() {
  const m = currentMember.value
  if (!m) {
    entries.value = []
    return
  }
  entriesLoading.value = true
  try {
    const list = await listForDay(m.id, date.value)
    const firstPhotos = list.filter(e => e.photoPaths.length).map(e => e.photoPaths[0]!)
    const urls = await photoUrls(firstPhotos)
    thumbs.value = Object.fromEntries(firstPhotos.map((p, i) => [p, urls[i]!]))
    entries.value = list
  }
  catch (e) {
    toast.add({ title: '讀取記錄失敗', description: (e as { message?: string })?.message, color: 'error' })
  }
  finally {
    entriesLoading.value = false
  }
}
watch([() => currentMember.value?.id, date], loadEntries, { immediate: true })

// ───── 每日總結 ─────
const summary = ref<DailySummary | null>(null)
const summarizing = ref(false)

async function loadSummary() {
  const m = currentMember.value
  summary.value = null
  if (!m) return
  try {
    summary.value = await getSummary(m.id, date.value)
  }
  catch (e) {
    toast.add({ title: '讀取總結失敗', description: errorMessage(e), color: 'error' })
  }
}
// 記錄變動會讓資料庫把總結標成過期，所以記錄重新讀取後也重讀總結
watch(entries, loadSummary)

async function summarize() {
  const m = currentMember.value
  if (!m) return
  summarizing.value = true
  try {
    summary.value = await generateSummary(m.id, date.value)
  }
  catch (e) {
    toast.add({ title: '產生總結失敗', description: errorMessage(e), color: 'error' })
  }
  finally {
    summarizing.value = false
  }
}

const hasReadyEntries = computed(() => entries.value.some(e => e.status === 'ready'))

const mealTypes = Object.keys(MEAL_LABELS) as MealType[]
const entriesByMeal = computed(() =>
  Object.fromEntries(mealTypes.map(t => [t, entries.value.filter(e => e.mealType === t)])) as Record<MealType, Entry[]>,
)

function entryTotals(e: Entry) {
  return sumNutrients(e.items)
}

// 只加總已確認的記錄
const consumed = computed(() =>
  sumNutrients(entries.value.filter(e => e.status === 'ready').flatMap(e => e.items)),
)

const macroRows = computed(() => {
  const t = targets.value
  if (!t) return []
  return [
    { label: '蛋白質', value: consumed.value.proteinG, target: t.proteinG },
    { label: '碳水', value: consumed.value.carbsG, target: t.carbsG },
    { label: '脂肪', value: consumed.value.fatG, target: t.fatG },
  ]
})

function percent(value: number, target: number) {
  return target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
}

function newEntry(mode: 'photo' | 'text') {
  if (!currentMember.value) return
  navigateTo({ path: '/entries/new', query: { mode, member: currentMember.value.id, date: date.value } })
}

const addMenu = [[
  { label: '拍照', icon: 'i-lucide-camera', onSelect: () => newEntry('photo') },
  { label: '手動輸入', icon: 'i-lucide-pencil', onSelect: () => newEntry('text') },
]]
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center justify-between">
      <MemberSwitcher />
      <div class="flex items-center gap-1">
        <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="前一天" @click="date = addDays(date, -1)" />
        <span class="text-sm tabular-nums">{{ date }}</span>
        <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-right" aria-label="後一天" @click="date = addDays(date, 1)" />
      </div>
    </header>

    <UCard v-if="loaded && !activeMembers.length">
      <div class="text-center space-y-3">
        <p class="text-sm text-muted">還沒有成員資料</p>
        <UButton to="/members/new" icon="i-lucide-user-plus">新增成員</UButton>
      </div>
    </UCard>
    <UCard v-else>
      <div class="space-y-3">
        <div class="text-center">
          <p class="text-3xl font-semibold tabular-nums">
            {{ Math.round(consumed.kcal) }}
            <span class="text-base text-muted">/ {{ targets?.kcal ?? '—' }} kcal</span>
          </p>
          <UProgress
            v-if="targets"
            :model-value="percent(consumed.kcal, targets.kcal)"
            :color="consumed.kcal > targets.kcal ? 'warning' : 'primary'"
            class="mt-2"
          />
        </div>
        <div v-for="row in macroRows" :key="row.label" class="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-2 text-xs">
          <span class="text-muted">{{ row.label }}</span>
          <UProgress :model-value="percent(row.value, row.target)" size="sm" />
          <span class="text-right tabular-nums">{{ Math.round(row.value) }}/{{ row.target }}g</span>
        </div>
      </div>
    </UCard>

    <section v-for="type in mealTypes" :key="type" class="space-y-2">
      <h2 class="flex justify-between text-sm font-medium text-muted">
        <span>{{ MEAL_LABELS[type] }}</span>
        <span v-if="entriesByMeal[type].some(e => e.status === 'ready')" class="tabular-nums">
          {{ Math.round(sumNutrients(entriesByMeal[type].filter(e => e.status === 'ready').flatMap(e => e.items)).kcal) }} kcal
        </span>
      </h2>
      <p v-if="!entriesByMeal[type].length" class="text-sm text-dimmed">
        {{ entriesLoading ? '讀取中…' : '尚無記錄' }}
      </p>
      <NuxtLink
        v-for="e in entriesByMeal[type]"
        :key="e.id"
        :to="`/entries/${e.id}`"
        class="flex items-center gap-3 rounded-md border border-default p-2"
      >
        <img
          v-if="e.photoPaths.length && thumbs[e.photoPaths[0]!]"
          :src="thumbs[e.photoPaths[0]!]"
          alt=""
          class="size-12 rounded object-cover shrink-0"
        >
        <div v-else class="size-12 rounded bg-elevated flex items-center justify-center shrink-0">
          <UIcon name="i-lucide-utensils" class="size-5 text-muted" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm truncate">
            {{ e.items.length ? e.items.map(i => i.name).join('、') : (e.note || '照片記錄') }}
          </p>
          <UBadge
            v-if="e.status !== 'ready'"
            :color="e.status === 'failed' ? 'error' : 'warning'"
            variant="subtle"
            size="sm"
          >
            {{ ENTRY_STATUS_LABELS[e.status] }}，點擊{{ e.status === 'failed' ? '重試' : '確認' }}
          </UBadge>
        </div>
        <span v-if="e.status === 'ready'" class="text-sm tabular-nums">{{ Math.round(entryTotals(e).kcal) }} kcal</span>
      </NuxtLink>
    </section>

    <UCard v-if="summary">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 font-medium">
            <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
            每日總結
          </span>
          <UBadge v-if="summary.isStale" color="warning" variant="subtle" size="sm">記錄已變動</UBadge>
        </div>
      </template>
      <p class="text-sm leading-relaxed whitespace-pre-line">{{ summary.content }}</p>
    </UCard>

    <UButton
      v-if="currentMember"
      block
      size="lg"
      variant="soft"
      icon="i-lucide-sparkles"
      :loading="summarizing"
      :disabled="!hasReadyEntries"
      @click="summarize"
    >
      {{ summarizing ? 'AI 撰寫中…' : summary ? '重新產生總結' : '產生今日總結' }}
    </UButton>
    <p v-if="currentMember && !hasReadyEntries && !entriesLoading" class="-mt-2 text-center text-xs text-dimmed">
      確認至少一筆記錄後就能產生總結
    </p>

    <UDropdownMenu v-if="currentMember" :items="addMenu" :content="{ side: 'top', align: 'end' }">
      <UButton
        icon="i-lucide-plus"
        size="xl"
        class="fixed right-4 bottom-24 rounded-full shadow-lg"
        aria-label="新增記錄"
      />
    </UDropdownMenu>
  </div>
</template>
