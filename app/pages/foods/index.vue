<script setup lang="ts">
import type { Food } from '#shared/types/domain'

// PRD 3.9：家庭自訂食物
const toast = useToast()
const { listCustom } = useFoods()

const foods = ref<Food[]>([])
const loading = ref(true)
const filter = ref('')

onMounted(async () => {
  try {
    foods.value = await listCustom()
  }
  catch (e) {
    toast.add({ title: '讀取失敗', description: errorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
})

const shown = computed(() => {
  const q = filter.value.trim()
  return q ? foods.value.filter(f => f.name.includes(q)) : foods.value
})
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center gap-2">
      <UButton to="/settings" color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="返回" />
      <h1 class="text-lg font-semibold flex-1">我的食物</h1>
      <UButton to="/foods/new" size="sm" icon="i-lucide-plus">新增</UButton>
    </header>

    <UInput v-if="foods.length > 8" v-model="filter" icon="i-lucide-search" placeholder="篩選" class="w-full" />

    <div v-if="loading" class="py-12 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>
    <UCard v-else-if="!foods.length">
      <p class="text-sm text-muted">
        還沒有自訂食物。可以在這裡照包裝營養標示新增，或在 AI 確認畫面的品項選單按「存成常用食物」。
      </p>
    </UCard>
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }">
      <ul class="divide-y divide-default">
        <li v-for="f in shown" :key="f.id">
          <NuxtLink :to="`/foods/${f.id}`" class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="min-w-0">
              <p class="truncate">{{ f.name }}</p>
              <p class="text-xs text-muted tabular-nums truncate">
                {{ portionText(f, { kind: 'base', quantity: 1 }) }} · {{ Math.round(f.kcal) }} kcal
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-dimmed shrink-0" />
          </NuxtLink>
        </li>
      </ul>
    </UCard>
  </div>
</template>
