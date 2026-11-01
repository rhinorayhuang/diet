<script setup lang="ts">
import { MEAL_LABELS, type MealType } from '#shared/types/domain'

// TODO: 從 Supabase 讀取當日記錄與總結
const date = ref(taipeiNow().date)

const { ensureLoaded, activeMembers, latestWeight, loaded } = useMembers()
const { memberId, setDefaultMember } = useCurrentMember()

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
const meals = Object.entries(MEAL_LABELS) as [MealType, string][]

const addMenu = [
  [
    { label: '拍照', icon: 'i-lucide-camera' },
    { label: '手動輸入', icon: 'i-lucide-pencil' },
  ],
]
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
      <div class="text-center space-y-1">
        <p class="text-3xl font-semibold tabular-nums">
          0 <span class="text-base text-muted">/ {{ targets?.kcal ?? '—' }} kcal</span>
        </p>
        <p v-if="targets" class="text-xs text-muted tabular-nums">
          蛋白質 0/{{ targets.proteinG }}g · 碳水 0/{{ targets.carbsG }}g · 脂肪 0/{{ targets.fatG }}g
        </p>
      </div>
    </UCard>

    <section v-for="[type, label] in meals" :key="type" class="space-y-2">
      <h2 class="text-sm font-medium text-muted">{{ label }}</h2>
      <p class="text-sm text-dimmed">尚無記錄</p>
    </section>

    <UButton block size="lg" variant="soft" icon="i-lucide-sparkles">
      產生今日總結
    </UButton>

    <UDropdownMenu :items="addMenu" :content="{ side: 'top', align: 'end' }">
      <UButton
        icon="i-lucide-plus"
        size="xl"
        class="fixed right-4 bottom-24 rounded-full shadow-lg"
        aria-label="新增記錄"
      />
    </UDropdownMenu>
  </div>
</template>
