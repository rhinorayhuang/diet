<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { BmrSource } from '#shared/utils/nutrition'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  type ActivityLevel,
  type Goal,
  type Member,
  type Sex,
} from '#shared/types/domain'

const route = useRoute()
const toast = useToast()
const {
  ensureLoaded, getMember, weightsOf, latestWeight,
  createMember, updateMember, setArchived, saveWeight, deleteWeight,
} = useMembers()
const { memberId: defaultMemberId, setDefaultMember } = useCurrentMember()

const id = computed(() => String(route.params.id))
const isNew = computed(() => id.value === 'new')
const member = computed(() => (isNew.value ? undefined : getMember(id.value)))

const sexItems = [{ label: '男', value: 'male' }, { label: '女', value: 'female' }]
const activityItems = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }))
const goalItems = Object.entries(GOAL_LABELS).map(([value, label]) => ({ value, label }))

const schema = computed(() => z.object({
  name: z.string().trim().min(1, '請輸入名稱'),
  sex: z.enum(['male', 'female']),
  birthYearMonth: z.string().regex(/^\d{4}-\d{2}$/, '請選擇出生年月（YYYY-MM）'),
  heightCm: z.number({ error: '請輸入身高' }).min(50, '身高不合理').max(250, '身高不合理'),
  weightKg: isNew.value
    ? z.number({ error: '請輸入體重' }).min(10, '體重不合理').max(300, '體重不合理')
    : z.number().optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  dietNote: z.string().max(500, '最多 500 字'),
  calorieTargetOverride: z.number().int().min(800, '至少 800').max(6000, '最多 6000').optional(),
  measuredBmr: z.number().int().min(500, '數值不合理').max(5000, '數值不合理').optional(),
  bodyFatPct: z.number().gt(0, '數值不合理').lt(70, '數值不合理').optional(),
}))

const state = reactive({
  name: '',
  sex: 'male' as Sex,
  birthYearMonth: '',
  heightCm: undefined as number | undefined,
  weightKg: undefined as number | undefined,
  activityLevel: 'sedentary' as ActivityLevel,
  goal: 'maintain' as Goal,
  dietNote: '',
  calorieTargetOverride: undefined as number | undefined,
  measuredBmr: undefined as number | undefined,
  bodyFatPct: undefined as number | undefined,
})

function fillFrom(m: Member) {
  Object.assign(state, {
    name: m.name,
    sex: m.sex,
    birthYearMonth: m.birthYearMonth,
    heightCm: m.heightCm,
    activityLevel: m.activityLevel,
    goal: m.goal,
    dietNote: m.dietNote ?? '',
    calorieTargetOverride: m.calorieTargetOverride ?? undefined,
    measuredBmr: m.measuredBmr ?? undefined,
    bodyFatPct: m.bodyFatPct ?? undefined,
  })
}

const loading = ref(true)
onMounted(async () => {
  try {
    await ensureLoaded()
    if (!isNew.value) {
      if (!member.value) return navigateTo('/settings')
      fillFrom(member.value)
    }
  }
  finally {
    loading.value = false
  }
})

// 依目前表單內容預覽每日目標的計算過程
const breakdown = computed(() => {
  const weight = isNew.value ? state.weightKg : latestWeight(id.value)
  if (!state.heightCm || !weight || !/^\d{4}-\d{2}$/.test(state.birthYearMonth)) return null
  return targetBreakdown(
    {
      ...state,
      calorieTargetOverride: state.calorieTargetOverride ?? null,
      measuredBmr: state.measuredBmr ?? null,
      bodyFatPct: state.bodyFatPct ?? null,
    } as unknown as Member,
    weight,
    taipeiNow().date,
  )
})

const BMR_SOURCE_LABELS: Record<BmrSource, string> = {
  measured: '實測',
  leanMass: '依體脂估算',
  formula: '依身高體重估算',
}
const GOAL_STEP_LABELS: Record<Goal, string> = {
  lose: '減脂 −20%',
  maintain: '維持',
  gain: '增肌 +10%',
}

function showError(error: unknown) {
  toast.add({
    title: '儲存失敗',
    // Supabase 的 PostgrestError 不是 Error 實例，但有 message
    description: (error as { message?: string })?.message ?? String(error),
    color: 'error',
  })
}

const saving = ref(false)
async function onSubmit(event: FormSubmitEvent<z.output<typeof schema.value>>) {
  const d = event.data
  const input: MemberInput = {
    name: d.name.trim(),
    sex: d.sex,
    birthYearMonth: d.birthYearMonth,
    heightCm: d.heightCm,
    activityLevel: d.activityLevel,
    goal: d.goal,
    dietNote: d.dietNote.trim() || null,
    calorieTargetOverride: d.calorieTargetOverride ?? null,
    measuredBmr: d.measuredBmr ?? null,
    bodyFatPct: d.bodyFatPct ?? null,
  }
  saving.value = true
  try {
    if (isNew.value) {
      const newId = await createMember(input, d.weightKg!)
      if (!defaultMemberId.value) setDefaultMember(newId)
      toast.add({ title: `已新增 ${input.name}`, color: 'success' })
      await navigateTo('/settings')
    }
    else {
      await updateMember(id.value, input)
      toast.add({ title: '已儲存', color: 'success' })
    }
  }
  catch (e) {
    showError(e)
  }
  finally {
    saving.value = false
  }
}

async function toggleArchived() {
  if (!member.value) return
  const archiving = !member.value.archivedAt
  if (archiving && !confirm(`封存「${member.value.name}」？資料會保留，之後可以還原。`)) return
  try {
    await setArchived(id.value, archiving)
    if (archiving && defaultMemberId.value === id.value) setDefaultMember(null)
    toast.add({ title: archiving ? '已封存' : '已還原', color: 'success' })
    if (archiving) await navigateTo('/settings')
  }
  catch (e) {
    showError(e)
  }
}

// ───── 體重紀錄 ─────
const weightForm = reactive({
  id: undefined as string | undefined,
  date: taipeiNow().date,
  weightKg: undefined as number | undefined,
})

function editWeight(w: { id: string, date: string, weightKg: number }) {
  Object.assign(weightForm, { id: w.id, date: w.date, weightKg: w.weightKg })
}

function resetWeightForm() {
  Object.assign(weightForm, { id: undefined, date: taipeiNow().date, weightKg: undefined })
}

async function submitWeight() {
  if (!weightForm.weightKg || weightForm.weightKg < 10 || weightForm.weightKg > 300 || !weightForm.date) {
    toast.add({ title: '請輸入正確的日期與體重', color: 'warning' })
    return
  }
  try {
    await saveWeight(id.value, weightForm.date, weightForm.weightKg, weightForm.id)
    resetWeightForm()
  }
  catch (e) {
    showError(e)
  }
}

async function removeWeight(weightId: string) {
  if (weightsOf(id.value).length <= 1) {
    toast.add({ title: '至少要保留一筆體重紀錄', color: 'warning' })
    return
  }
  if (!confirm('刪除這筆體重紀錄？')) return
  try {
    await deleteWeight(weightId)
    if (weightForm.id === weightId) resetWeightForm()
  }
  catch (e) {
    showError(e)
  }
}
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center gap-2">
      <UButton to="/settings" color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="返回" />
      <h1 class="text-lg font-semibold">{{ isNew ? '新增成員' : member?.name ?? '成員' }}</h1>
      <UBadge v-if="member?.archivedAt" color="neutral" variant="subtle">已封存</UBadge>
    </header>

    <div v-if="loading" class="py-12 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else>
      <UCard>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="名稱" name="name" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>

          <UFormField label="性別" name="sex" required>
            <URadioGroup v-model="state.sex" orientation="horizontal" :items="sexItems" />
          </UFormField>

          <UFormField label="出生年月" name="birthYearMonth" required>
            <UInput v-model="state.birthYearMonth" type="month" placeholder="YYYY-MM" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="身高（cm）" name="heightCm" required>
              <UInputNumber v-model="state.heightCm" :step="0.1" :min="0" class="w-full" />
            </UFormField>
            <UFormField v-if="isNew" label="體重（kg）" name="weightKg" required>
              <UInputNumber v-model="state.weightKg" :step="0.1" :min="0" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="活動量" name="activityLevel" required>
              <USelect v-model="state.activityLevel" :items="activityItems" class="w-full" />
            </UFormField>
            <UFormField label="目標" name="goal">
              <USelect v-model="state.goal" :items="goalItems" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="飲食備註" name="dietNote" hint="選填" description="例如：素食、乳糖不耐、控制血糖中">
            <UTextarea v-model="state.dietNote" :rows="2" autoresize class="w-full" />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="實測 BMR（kcal）" name="measuredBmr" hint="選填">
              <UInputNumber v-model="state.measuredBmr" :min="0" :step="10" :step-snapping="false" placeholder="例如 InBody" class="w-full" />
            </UFormField>
            <UFormField label="體脂率（%）" name="bodyFatPct" hint="選填">
              <UInputNumber v-model="state.bodyFatPct" :min="0" :step="0.1" :step-snapping="false" class="w-full" />
            </UFormField>
          </div>
          <p class="-mt-2 text-xs text-muted">
            有體脂率時，蛋白質依去脂體重計算；有新的測量結果記得回來更新。
          </p>

          <UFormField
            label="每日熱量目標（手動覆寫）"
            name="calorieTargetOverride"
            hint="選填"
            description="填寫後取代自動計算的熱量，三大營養素會依這個熱量重新分配"
          >
            <UInputNumber v-model="state.calorieTargetOverride" :min="0" :step="50" placeholder="留空使用自動計算" class="w-full" />
          </UFormField>

          <div v-if="breakdown" class="rounded-md bg-elevated/50 p-3 text-sm space-y-1 tabular-nums">
            <p class="text-muted">
              BMR {{ breakdown.bmr }}（{{ BMR_SOURCE_LABELS[breakdown.bmrSource] }}）
              × {{ ACTIVITY_FACTORS[state.activityLevel] }} = TDEE {{ breakdown.tdee }}
              → {{ GOAL_STEP_LABELS[state.goal] }}：{{ breakdown.autoKcal }} kcal
            </p>
            <p class="font-medium">
              每日目標 {{ breakdown.targets.kcal }} kcal{{ state.calorieTargetOverride ? '（手動覆寫）' : '' }}
            </p>
            <p class="text-muted">
              蛋白質 {{ breakdown.targets.proteinG }}g（去脂體重 {{ breakdown.leanKg }} kg{{ state.bodyFatPct ? '' : '，估計值' }}）
              ／碳水 {{ breakdown.targets.carbsG }}g／脂肪 {{ breakdown.targets.fatG }}g
            </p>
          </div>
          <p v-else class="text-xs text-muted">填完上面的資料後會顯示每日目標</p>

          <UButton type="submit" block :loading="saving">{{ isNew ? '新增成員' : '儲存' }}</UButton>
        </UForm>
      </UCard>

      <UCard v-if="!isNew && member">
        <template #header>體重紀錄</template>

        <form class="flex items-end gap-2 mb-4" @submit.prevent="submitWeight">
          <UFormField label="日期" class="flex-1">
            <UInput v-model="weightForm.date" type="date" class="w-full" />
          </UFormField>
          <UFormField label="kg" class="w-28">
            <UInputNumber v-model="weightForm.weightKg" :step="0.1" :min="0" class="w-full" />
          </UFormField>
          <UButton type="submit" :icon="weightForm.id ? 'i-lucide-check' : 'i-lucide-plus'" :aria-label="weightForm.id ? '更新' : '新增'" />
          <UButton v-if="weightForm.id" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="取消編輯" @click="resetWeightForm" />
        </form>

        <ul class="divide-y divide-default">
          <li v-for="w in weightsOf(member.id)" :key="w.id" class="flex items-center justify-between py-2">
            <button type="button" class="flex-1 flex justify-between text-left pr-3" @click="editWeight(w)">
              <span class="tabular-nums text-muted">{{ w.date }}</span>
              <span class="tabular-nums">{{ w.weightKg }} kg</span>
            </button>
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" aria-label="刪除" @click="removeWeight(w.id)" />
          </li>
        </ul>
      </UCard>

      <UButton
        v-if="!isNew && member"
        block
        color="neutral"
        variant="outline"
        :icon="member.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
        @click="toggleArchived"
      >
        {{ member.archivedAt ? '還原成員' : '封存成員' }}
      </UButton>
    </template>
  </div>
</template>
