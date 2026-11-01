<script setup lang="ts">
import { MEAL_LABELS, type MealType } from '#shared/types/domain'

// TODO: 從 Supabase 讀取成員、當日記錄、目標與總結
const date = ref(taipeiNow().date)
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
      <UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down">
        選擇成員
      </UButton>
      <div class="flex items-center gap-1">
        <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="前一天" @click="date = addDays(date, -1)" />
        <span class="text-sm tabular-nums">{{ date }}</span>
        <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-right" aria-label="後一天" @click="date = addDays(date, 1)" />
      </div>
    </header>

    <UCard>
      <div class="text-center space-y-1">
        <p class="text-3xl font-semibold tabular-nums">0 <span class="text-base text-muted">/ — kcal</span></p>
        <p class="text-sm text-muted">尚未建立成員資料</p>
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
