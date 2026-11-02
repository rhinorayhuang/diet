<script setup lang="ts">
import { ENTRY_STATUS_LABELS, MEAL_LABELS, type Entry, type MealType } from '#shared/types/domain'

// TODO: 每日總結
const date = useState('today-date', () => taipeiNow().date)

const { ensureLoaded, activeMembers, latestWeight, loaded } = useMembers()
const { memberId, setDefaultMember } = useCurrentMember()
const { listForDay, photoUrls } = useEntries()
const toast = useToast()

onMounted(async () => {
  await ensureLoaded()
  // 本機記住的成員不存在或已封存時，改用第一位
  if (!activeMembers.value.some(m => m.id === memberId.value)) {
    setDefaultMember(activeMembers.value[0]?.id ?? null)
  }
})

const memberItems = computed(() => activeMembers.value.map(m => ({ value: m.id, label: m.name })))
const selectedMemberId = computed({
  get: () => memberId.value ?? undefined,
  set: (id?: string) => setDefaultMember(id ?? null),
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
      <USelect
        v-if="memberItems.length"
        v-model="selectedMemberId"
        :items="memberItems"
        variant="ghost"
        class="min-w-28 font-medium"
      />
      <span v-else />
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
        <span v-if="entriesByMeal[type].length" class="tabular-nums">
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

    <UButton block size="lg" variant="soft" icon="i-lucide-sparkles">
      產生今日總結
    </UButton>

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
