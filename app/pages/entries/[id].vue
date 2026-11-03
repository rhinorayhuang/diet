<script setup lang="ts">
import {
  ENTRY_STATUS_LABELS, MEAL_LABELS, type Entry, type FoodItem, type MealType,
} from '#shared/types/domain'

// PRD 3.5.4 確認畫面：AI 結果可新增、刪除、重新估算或直接改數字，確認後存檔
// PRD 3.5.6 品項可以從食物庫替換，或存成常用食物
const route = useRoute()
const toast = useToast()
const { getEntry, photoUrls, analyze, reestimate, confirmEntry, deleteEntry } = useEntries()
const { ensureLoaded, getMember } = useMembers()
const { createCustom } = useFoods()

const id = computed(() => String(route.params.id))
const entry = ref<Entry | null>(null)
const member = computed(() => (entry.value ? getMember(entry.value.memberId) : undefined))
const urls = ref<string[]>([])

interface EditableItem extends FoodItem { key: number, reestimating?: boolean }
let nextKey = 0
const items = ref<EditableItem[]>([])
const date = ref('')
const mealType = ref<MealType>('lunch')
const mealItems = Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label }))

const loading = ref(true)
const analyzing = ref(false)
const analyzeError = ref('')
const saving = ref(false)

function toEditable(item: FoodItem): EditableItem {
  return {
    key: nextKey++,
    foodId: item.foodId ?? null,
    name: item.name,
    portion: item.portion,
    kcal: item.kcal,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
  }
}

async function runAnalyze() {
  analyzing.value = true
  analyzeError.value = ''
  try {
    const result = await analyze(id.value)
    items.value = result.items.map(toEditable)
    if (entry.value) entry.value.status = 'pending'
  }
  catch (e) {
    analyzeError.value = errorMessage(e)
    if (entry.value) entry.value.status = 'failed'
  }
  finally {
    analyzing.value = false
  }
}

onMounted(async () => {
  try {
    const [found] = await Promise.all([getEntry(id.value), ensureLoaded()])
    if (!found) {
      toast.add({ title: '找不到這筆記錄', color: 'warning' })
      return navigateTo('/')
    }
    entry.value = found
    date.value = found.date
    mealType.value = found.mealType
    items.value = found.items.map(toEditable)
    urls.value = await photoUrls(found.photoPaths)
  }
  catch (e) {
    toast.add({ title: '讀取失敗', description: errorMessage(e), color: 'error' })
    return
  }
  finally {
    loading.value = false
  }
  // 尚未確認且還沒有品項時，自動送 AI 分析
  if (entry.value.status !== 'ready' && items.value.length === 0) await runAnalyze()
})

const totals = computed(() => roundNutrients(sumNutrients(items.value.map(i => ({
  kcal: i.kcal || 0, proteinG: i.proteinG || 0, carbsG: i.carbsG || 0, fatG: i.fatG || 0,
})))))

function addItem() {
  items.value.push(toEditable({ name: '', portion: '', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }))
}

function removeItem(key: number) {
  items.value = items.value.filter(i => i.key !== key)
}

async function reestimateItem(item: EditableItem) {
  if (!item.name.trim() || !entry.value) {
    toast.add({ title: '請先填寫品項名稱', color: 'warning' })
    return
  }
  item.reestimating = true
  try {
    const { item: result } = await reestimate(entry.value.memberId, item.name, item.portion)
    Object.assign(item, {
      foodId: null,
      kcal: result.kcal, proteinG: result.proteinG, carbsG: result.carbsG, fatG: result.fatG,
      portion: item.portion || result.portion,
    })
  }
  catch (e) {
    toast.add({ title: '重新估算失敗', description: errorMessage(e), color: 'error' })
  }
  finally {
    item.reestimating = false
  }
}

// ───── 食物庫 ─────
const pickerOpen = ref(false)
const replacingKey = ref<number | null>(null)

function openReplace(item: EditableItem) {
  replacingKey.value = item.key
  pickerOpen.value = true
}

function onPick(picked: FoodItem) {
  const index = items.value.findIndex(i => i.key === replacingKey.value)
  if (index >= 0) items.value[index] = toEditable(picked)
  else items.value.push(toEditable(picked))
  replacingKey.value = null
}

function openAddFromLibrary() {
  replacingKey.value = null
  pickerOpen.value = true
}

async function saveAsFood(item: EditableItem) {
  const name = item.name.trim()
  if (!name) {
    toast.add({ title: '請先填寫品項名稱', color: 'warning' })
    return
  }
  try {
    const { label, grams } = splitPortion(item.portion)
    const food = await createCustom({
      name,
      baseLabel: label || '1 份',
      baseGrams: grams,
      kcal: item.kcal || 0,
      proteinG: item.proteinG || 0,
      carbsG: item.carbsG || 0,
      fatG: item.fatG || 0,
    })
    item.foodId = food.id
    toast.add({ title: `已存成常用食物「${name}」`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: '儲存食物失敗', description: errorMessage(e), color: 'error' })
  }
}

function itemMenu(item: EditableItem) {
  return [[
    { label: '從食物庫替換', icon: 'i-lucide-replace', onSelect: () => openReplace(item) },
    ...(item.foodId ? [] : [{ label: '存成常用食物', icon: 'i-lucide-bookmark-plus', onSelect: () => saveAsFood(item) }]),
  ], [
    { label: '刪除品項', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => removeItem(item.key) },
  ]]
}

async function save() {
  if (items.value.some(i => !i.name.trim())) {
    toast.add({ title: '有品項沒有名稱', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await confirmEntry(
      id.value,
      items.value.map(({ key: _key, reestimating: _r, ...item }) => ({
        ...item,
        name: item.name.trim(),
        portion: item.portion.trim(),
        kcal: item.kcal || 0,
        proteinG: item.proteinG || 0,
        carbsG: item.carbsG || 0,
        fatG: item.fatG || 0,
      })),
      { date: date.value, mealType: mealType.value },
    )
    toast.add({ title: '已儲存', color: 'success' })
    await navigateTo('/')
  }
  catch (e) {
    toast.add({ title: '儲存失敗', description: errorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!entry.value || !confirm('刪除這筆記錄？照片也會一起刪除。')) return
  try {
    await deleteEntry(entry.value)
    toast.add({ title: '已刪除', color: 'success' })
    await navigateTo('/')
  }
  catch (e) {
    toast.add({ title: '刪除失敗', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center gap-2">
      <UButton to="/" color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="返回" />
      <h1 class="text-lg font-semibold flex-1">
        確認記錄
        <span v-if="member" class="text-muted font-normal">· {{ member.name }}</span>
      </h1>
      <UBadge v-if="entry" :color="entry.status === 'failed' ? 'error' : entry.status === 'ready' ? 'success' : 'neutral'" variant="subtle">
        {{ ENTRY_STATUS_LABELS[entry.status] }}
      </UBadge>
    </header>

    <div v-if="loading" class="py-12 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else-if="entry">
      <div v-if="urls.length" class="grid grid-cols-3 gap-2">
        <img v-for="u in urls" :key="u" :src="u" alt="" class="aspect-square object-cover rounded-md">
      </div>
      <p v-if="entry.note" class="text-sm text-muted whitespace-pre-line">{{ entry.note }}</p>

      <UCard v-if="analyzing">
        <div class="py-6 flex flex-col items-center gap-2 text-muted">
          <UIcon name="i-lucide-sparkles" class="size-6 animate-pulse" />
          <p class="text-sm">AI 分析中…</p>
        </div>
      </UCard>

      <UAlert
        v-else-if="analyzeError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="AI 分析失敗"
        :description="`${analyzeError}。照片和文字已保存，可以重試或手動新增品項。`"
        :actions="[{ label: '重試', icon: 'i-lucide-rotate-cw', onClick: runAnalyze }]"
      />

      <template v-if="!analyzing">
        <UCard v-for="item in items" :key="item.key" :ui="{ body: 'space-y-3' }">
          <div class="flex gap-2">
            <UInput v-model="item.name" placeholder="品項名稱" class="flex-1">
              <template v-if="item.foodId" #trailing>
                <UIcon name="i-lucide-book-open" class="size-4 text-primary" aria-label="來自食物庫" />
              </template>
            </UInput>
            <UDropdownMenu :items="itemMenu(item)" :content="{ align: 'end' }">
              <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" aria-label="品項選項" />
            </UDropdownMenu>
          </div>
          <div class="flex gap-2">
            <UInput v-model="item.portion" placeholder="份量，例如：半碗" class="flex-1" />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-sparkles"
              :loading="item.reestimating"
              @click="reestimateItem(item)"
            >
              重新估算
            </UButton>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <UFormField label="熱量" size="xs">
              <UInputNumber v-model="item.kcal" :min="0" orientation="vertical" size="sm" />
            </UFormField>
            <UFormField label="蛋白質" size="xs">
              <UInputNumber v-model="item.proteinG" :min="0" orientation="vertical" size="sm" />
            </UFormField>
            <UFormField label="碳水" size="xs">
              <UInputNumber v-model="item.carbsG" :min="0" orientation="vertical" size="sm" />
            </UFormField>
            <UFormField label="脂肪" size="xs">
              <UInputNumber v-model="item.fatG" :min="0" orientation="vertical" size="sm" />
            </UFormField>
          </div>
        </UCard>

        <div class="grid grid-cols-2 gap-2">
          <UButton block color="neutral" variant="outline" icon="i-lucide-book-open" @click="openAddFromLibrary">從食物庫加</UButton>
          <UButton block color="neutral" variant="outline" icon="i-lucide-plus" @click="addItem">手動新增</UButton>
        </div>
        <FoodPicker
          v-model:open="pickerOpen"
          :member-id="entry.memberId"
          :title="replacingKey === null ? '從食物庫加' : '從食物庫替換'"
          @pick="onPick"
        />

        <UCard>
          <div class="space-y-3">
            <p class="text-sm tabular-nums">
              合計 <span class="font-semibold">{{ totals.kcal }} kcal</span>
              <span class="text-muted">
                · 蛋白質 {{ totals.proteinG }}g · 碳水 {{ totals.carbsG }}g · 脂肪 {{ totals.fatG }}g
              </span>
            </p>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="日期">
                <UInput v-model="date" type="date" class="w-full" />
              </UFormField>
              <UFormField label="餐別">
                <USelect v-model="mealType" :items="mealItems" class="w-full" />
              </UFormField>
            </div>
          </div>
        </UCard>

        <UButton block size="lg" :loading="saving" :disabled="!items.length" @click="save">確認存檔</UButton>
        <UButton block color="error" variant="ghost" icon="i-lucide-trash-2" @click="remove">刪除這筆記錄</UButton>
      </template>
    </template>
  </div>
</template>
