<script setup lang="ts">
import type { Food, FoodItem, FoodPortion, RecentFood } from '#shared/types/domain'

// PRD 3.5.6：從食物庫選食物與份量，不呼叫 AI
const props = defineProps<{ memberId?: string, title?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [item: FoodItem] }>()

const toast = useToast()
const { search, recent, portionsOf, addPortion } = useFoods()

const query = ref('')
const results = ref<Food[]>([])
const recents = ref<RecentFood[]>([])
const searching = ref(false)

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  results.value = []
  selected.value = null
  if (props.memberId) {
    recents.value = await recent(props.memberId).catch(() => [])
  }
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0
watch(query, (q) => {
  clearTimeout(searchTimer)
  const trimmed = q.trim()
  if (!trimmed) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq
    searching.value = true
    try {
      const found = await search(trimmed)
      if (seq === searchSeq) results.value = found
    }
    catch (e) {
      toast.add({ title: '搜尋失敗', description: errorMessage(e), color: 'error' })
    }
    finally {
      if (seq === searchSeq) searching.value = false
    }
  }, 250)
})

function pickRecent(r: RecentFood) {
  const { times: _times, ...item } = r
  emit('pick', item)
  open.value = false
}

// ───── 選份量 ─────
const selected = ref<Food | null>(null)
const portions = ref<FoodPortion[]>([])
/** 'grams'、'base' 或常用單位的 id */
const unit = ref('grams')
const amount = ref<number>(100)

async function selectFood(food: Food) {
  selected.value = food
  portions.value = []
  if (food.baseGrams) {
    portions.value = await portionsOf(food.id).catch(() => [])
  }
  // 優先用「1 碗」這種單位，而不是「半碗」
  const first = portions.value.find(p => /^1\s/.test(p.label)) ?? portions.value[0]
  if (food.source === 'custom') {
    unit.value = 'base'
    amount.value = 1
  }
  else if (first) {
    unit.value = first.id
    amount.value = 1
  }
  else {
    unit.value = 'grams'
    amount.value = 100
  }
}

const unitItems = computed(() => {
  const food = selected.value
  if (!food) return []
  const items: { value: string, label: string }[] = []
  if (food.source === 'custom') items.push({ value: 'base', label: food.baseLabel })
  for (const p of portions.value) items.push({ value: p.id, label: `${p.label}（${p.grams}g）` })
  if (food.baseGrams) items.push({ value: 'grams', label: '公克' })
  return items
})

watch(unit, (u, previous) => {
  // 在公克與份數之間切換時，換成合理的預設數量
  if ((u === 'grams') !== (previous === 'grams')) amount.value = u === 'grams' ? 100 : 1
})

const preview = computed<FoodItem | null>(() => {
  const food = selected.value
  if (!food || !(amount.value > 0)) return null
  if (unit.value === 'grams') return foodItemFrom(food, { kind: 'grams', grams: amount.value })
  if (unit.value === 'base') return foodItemFrom(food, { kind: 'base', quantity: amount.value })
  const p = portions.value.find(x => x.id === unit.value)
  return p ? foodItemFrom(food, { kind: 'portion', label: p.label, grams: p.grams, quantity: amount.value }) : null
})

function confirmPick() {
  if (!preview.value) return
  emit('pick', preview.value)
  open.value = false
}

// ───── 新增常用單位 ─────
const addingPortion = ref(false)
const newPortion = reactive({ label: '', grams: undefined as number | undefined })

async function savePortion() {
  const food = selected.value
  const label = newPortion.label.trim()
  if (!food || !label || !newPortion.grams || newPortion.grams <= 0) {
    toast.add({ title: '請填寫單位名稱與克數', color: 'warning' })
    return
  }
  try {
    const p = await addPortion(food.id, label.match(/^\d/) ? label : `1 ${label}`, newPortion.grams)
    portions.value = [...portions.value, p].sort((a, b) => a.grams - b.grams)
    unit.value = p.id
    amount.value = 1
    addingPortion.value = false
    Object.assign(newPortion, { label: '', grams: undefined })
  }
  catch (e) {
    toast.add({ title: '新增單位失敗', description: errorMessage(e), color: 'error' })
  }
}

function per(food: Food) {
  return `${Math.round(food.kcal)} kcal / ${food.baseLabel}`
}
</script>

<template>
  <UModal v-model:open="open" :title="selected ? selected.name : (title ?? '從食物庫選')" :ui="{ body: 'space-y-3' }">
    <template #body>
      <!-- 選份量 -->
      <template v-if="selected">
        <p class="text-xs text-muted">
          {{ [selected.category, selected.description].filter(Boolean).join(' · ') || '自訂食物' }}
          · {{ per(selected) }}
        </p>

        <div class="grid grid-cols-[1fr_7rem] gap-2">
          <UFormField label="單位">
            <USelect v-model="unit" :items="unitItems" class="w-full" />
          </UFormField>
          <UFormField :label="unit === 'grams' ? '公克' : '份數'">
            <UInputNumber v-model="amount" :min="0" :step="unit === 'grams' ? 10 : 1" :step-snapping="false" class="w-full" />
          </UFormField>
        </div>

        <div v-if="selected.baseGrams">
          <UButton
            v-if="!addingPortion"
            color="neutral"
            variant="link"
            size="xs"
            icon="i-lucide-plus"
            class="px-0"
            @click="addingPortion = true"
          >
            新增常用單位
          </UButton>
          <form v-else class="flex items-end gap-2" @submit.prevent="savePortion">
            <UFormField label="單位" class="flex-1">
              <UInput v-model="newPortion.label" placeholder="例如：碗、片" class="w-full" />
            </UFormField>
            <UFormField label="克數" class="w-24">
              <UInputNumber v-model="newPortion.grams" :min="0" class="w-full" />
            </UFormField>
            <UButton type="submit" icon="i-lucide-check" aria-label="新增單位" />
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="取消" @click="addingPortion = false" />
          </form>
        </div>

        <p v-if="preview" class="text-sm tabular-nums">
          {{ preview.portion }} · <span class="font-semibold">{{ preview.kcal }} kcal</span>
          <span class="text-muted">
            · 蛋白質 {{ Math.round(preview.proteinG) }}g · 碳水 {{ Math.round(preview.carbsG) }}g · 脂肪 {{ Math.round(preview.fatG) }}g
          </span>
        </p>

        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-chevron-left" @click="selected = null">換一個</UButton>
          <UButton class="flex-1 justify-center" :disabled="!preview" @click="confirmPick">加入</UButton>
        </div>
      </template>

      <!-- 搜尋 -->
      <template v-else>
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="搜尋食物，例如：白飯、香蕉、豆漿"
          :loading="searching"
          autofocus
          class="w-full"
        />

        <template v-if="!query.trim()">
          <p v-if="recents.length" class="text-xs font-medium text-muted">最近常吃（點一下以上次的份量加入）</p>
          <ul v-if="recents.length" class="divide-y divide-default">
            <li v-for="r in recents" :key="r.foodId">
              <button type="button" class="w-full flex items-center justify-between gap-3 py-2 text-left" @click="pickRecent(r)">
                <span class="min-w-0">
                  <span class="block text-sm truncate">{{ r.name }}</span>
                  <span class="block text-xs text-muted truncate">{{ r.portion }}</span>
                </span>
                <span class="text-sm tabular-nums shrink-0">{{ r.kcal }} kcal</span>
              </button>
            </li>
          </ul>
          <p v-else class="text-sm text-dimmed">輸入關鍵字搜尋官方食物與你們的自訂食物。</p>
        </template>

        <template v-else>
          <ul v-if="results.length" class="divide-y divide-default">
            <li v-for="f in results" :key="f.id">
              <button type="button" class="w-full flex items-center justify-between gap-3 py-2 text-left" @click="selectFood(f)">
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5 text-sm">
                    <span class="truncate">{{ f.name }}</span>
                    <UBadge v-if="f.source === 'custom'" size="sm" variant="subtle">自訂</UBadge>
                  </span>
                  <span class="block text-xs text-muted truncate">
                    {{ [f.description, f.aliases].filter(Boolean).join(' · ') || f.category }}
                  </span>
                </span>
                <span class="text-xs text-muted tabular-nums shrink-0">{{ per(f) }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="!searching" class="text-sm text-dimmed">找不到「{{ query.trim() }}」，可以改用 AI 手動輸入，或到設定新增自訂食物。</p>
        </template>
      </template>
    </template>
  </UModal>
</template>
