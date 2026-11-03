<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

// PRD 3.9：新增或編輯家庭自訂食物
const route = useRoute()
const toast = useToast()
const { getFood, createCustom, updateCustom, deleteCustom } = useFoods()

const id = computed(() => String(route.params.id))
const isNew = computed(() => id.value === 'new')

const nutrient = (label: string) => z.number({ error: `請輸入${label}` }).min(0, '不能小於 0')
const schema = z.object({
  name: z.string().trim().min(1, '請輸入名稱'),
  baseLabel: z.string().trim().min(1, '請輸入份量名稱'),
  baseGrams: z.number().positive('克數要大於 0').optional(),
  kcal: nutrient('熱量'),
  proteinG: nutrient('蛋白質'),
  carbsG: nutrient('碳水'),
  fatG: nutrient('脂肪'),
})

const state = reactive({
  name: '',
  baseLabel: '1 份',
  baseGrams: undefined as number | undefined,
  kcal: undefined as number | undefined,
  proteinG: undefined as number | undefined,
  carbsG: undefined as number | undefined,
  fatG: undefined as number | undefined,
})

const loading = ref(true)
onMounted(async () => {
  try {
    if (!isNew.value) {
      const food = await getFood(id.value)
      if (!food || food.source !== 'custom') return navigateTo('/foods')
      Object.assign(state, {
        name: food.name,
        baseLabel: food.baseLabel,
        baseGrams: food.baseGrams ?? undefined,
        kcal: food.kcal,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      })
    }
  }
  catch (e) {
    toast.add({ title: '讀取失敗', description: errorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
})

const saving = ref(false)
async function onSubmit(event: FormSubmitEvent<z.output<typeof schema>>) {
  const d = event.data
  const input = {
    name: d.name.trim(),
    baseLabel: d.baseLabel.trim(),
    baseGrams: d.baseGrams ?? null,
    kcal: d.kcal,
    proteinG: d.proteinG,
    carbsG: d.carbsG,
    fatG: d.fatG,
  }
  saving.value = true
  try {
    if (isNew.value) await createCustom(input)
    else await updateCustom(id.value, input)
    toast.add({ title: isNew.value ? `已新增 ${input.name}` : '已儲存', color: 'success' })
    await navigateTo('/foods')
  }
  catch (e) {
    toast.add({ title: '儲存失敗', description: errorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`刪除「${state.name}」？過去的記錄不受影響。`)) return
  try {
    await deleteCustom(id.value)
    toast.add({ title: '已刪除', color: 'success' })
    await navigateTo('/foods')
  }
  catch (e) {
    toast.add({ title: '刪除失敗', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center gap-2">
      <UButton to="/foods" color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="返回" />
      <h1 class="text-lg font-semibold">{{ isNew ? '新增食物' : '編輯食物' }}</h1>
    </header>

    <div v-if="loading" class="py-12 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else>
      <UCard>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="名稱" name="name" required>
            <UInput v-model="state.name" placeholder="例如：統一陽光無加糖豆漿" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="份量名稱" name="baseLabel" required>
              <UInput v-model="state.baseLabel" placeholder="例如：1 瓶、1 份" class="w-full" />
            </UFormField>
            <UFormField label="克數（ml）" name="baseGrams" hint="選填">
              <UInputNumber v-model="state.baseGrams" :min="0" placeholder="例如：450" class="w-full" />
            </UFormField>
          </div>
          <p class="-mt-2 text-xs text-muted">
            照包裝營養標示填「每一份量」的數值。填了克數，記錄時就能改用公克輸入。
          </p>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="熱量（kcal）" name="kcal" required>
              <UInputNumber v-model="state.kcal" :min="0" :step="0.1" class="w-full" />
            </UFormField>
            <UFormField label="蛋白質（g）" name="proteinG" required>
              <UInputNumber v-model="state.proteinG" :min="0" :step="0.1" class="w-full" />
            </UFormField>
            <UFormField label="碳水（g）" name="carbsG" required>
              <UInputNumber v-model="state.carbsG" :min="0" :step="0.1" class="w-full" />
            </UFormField>
            <UFormField label="脂肪（g）" name="fatG" required>
              <UInputNumber v-model="state.fatG" :min="0" :step="0.1" class="w-full" />
            </UFormField>
          </div>

          <UButton type="submit" block :loading="saving">{{ isNew ? '新增食物' : '儲存' }}</UButton>
        </UForm>
      </UCard>

      <UButton v-if="!isNew" block color="error" variant="ghost" icon="i-lucide-trash-2" @click="remove">
        刪除這項食物
      </UButton>
    </template>
  </div>
</template>
