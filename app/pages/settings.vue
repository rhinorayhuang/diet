<script setup lang="ts">
import { AI_MODEL_LABELS, DEFAULT_AI_MODEL, type AiModel } from '#shared/types/domain'

const supabase = useSupabaseClient()
const { ensureLoaded, activeMembers, archivedMembers, latestWeight, loaded } = useMembers()
const { memberId, setDefaultMember } = useCurrentMember()

onMounted(ensureLoaded)

const showArchived = ref(false)

const defaultMemberItems = computed(() =>
  activeMembers.value.map(m => ({ value: m.id, label: m.name })),
)
const defaultMember = computed({
  get: () => memberId.value ?? undefined,
  set: (id?: string) => setDefaultMember(id ?? null),
})

function targetKcal(id: string) {
  const m = activeMembers.value.find(x => x.id === id)
  const w = latestWeight(id)
  return m && w ? dailyTargets(m, w, taipeiNow().date).kcal : null
}

const toast = useToast()

// AI 模型存在家庭設定，兩支手機共用
const model = ref<AiModel>(DEFAULT_AI_MODEL)
const modelItems = Object.entries(AI_MODEL_LABELS).map(([value, label]) => ({ value, label }))
const householdId = ref<string | null>(null)

async function loadModel() {
  const { data, error } = await supabase.from('households').select('id, ai_model').single()
  if (error) {
    toast.add({ title: '讀取設定失敗', description: errorMessage(error), color: 'error' })
    return
  }
  householdId.value = data.id
  model.value = data.ai_model as AiModel
}

async function changeModel(value: AiModel) {
  const previous = model.value
  model.value = value
  const { error } = await supabase.from('households').update({ ai_model: value }).eq('id', householdId.value!)
  if (error) {
    model.value = previous
    toast.add({ title: '儲存失敗', description: errorMessage(error), color: 'error' })
    return
  }
  toast.add({ title: `已改用 ${AI_MODEL_LABELS[value]}`, color: 'success' })
}

// 本月（台灣時間）預估 API 花費
const cost = ref<{ usd: number, calls: number } | null>(null)

async function loadCost() {
  const monthStart = `${taipeiNow().date.slice(0, 7)}-01T00:00:00+08:00`
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('cost_usd')
    .gte('created_at', monthStart)
  if (error) {
    toast.add({ title: '讀取花費失敗', description: errorMessage(error), color: 'error' })
    return
  }
  cost.value = { usd: data.reduce((sum, r) => sum + Number(r.cost_usd), 0), calls: data.length }
}

onMounted(() => Promise.all([loadModel(), loadCost()]))

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-lg font-semibold">設定</h1>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex items-center justify-between">
          <span>成員</span>
          <UButton to="/members/new" size="sm" icon="i-lucide-user-plus">新增</UButton>
        </div>
      </template>

      <div v-if="!loaded" class="p-4 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
      </div>
      <p v-else-if="activeMembers.length === 0" class="p-4 text-sm text-muted">
        還沒有成員，先新增一位吧。
      </p>
      <ul v-else class="divide-y divide-default">
        <li v-for="m in activeMembers" :key="m.id">
          <NuxtLink :to="`/members/${m.id}`" class="flex items-center justify-between px-4 py-3">
            <div>
              <p class="font-medium">{{ m.name }}</p>
              <p class="text-xs text-muted tabular-nums">
                {{ latestWeight(m.id) ?? '—' }} kg · 目標 {{ targetKcal(m.id) ?? '—' }} kcal
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-dimmed" />
          </NuxtLink>
        </li>
      </ul>

      <template v-if="archivedMembers.length" #footer>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          :trailing-icon="showArchived ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="px-0"
          @click="showArchived = !showArchived"
        >
          已封存（{{ archivedMembers.length }}）
        </UButton>
        <ul v-if="showArchived" class="mt-2 space-y-1">
          <li v-for="m in archivedMembers" :key="m.id">
            <NuxtLink :to="`/members/${m.id}`" class="text-sm text-muted underline">{{ m.name }}</NuxtLink>
          </li>
        </ul>
      </template>
    </UCard>

    <UCard v-if="activeMembers.length">
      <template #header>這支手機的預設成員</template>
      <USelect v-model="defaultMember" :items="defaultMemberItems" placeholder="未設定" class="w-full" />
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <NuxtLink to="/foods" class="flex items-center justify-between px-4 py-3">
        <div>
          <p class="font-medium">我的食物</p>
          <p class="text-xs text-muted">自訂食物，例如照包裝營養標示建立的常喝飲料</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="size-5 text-dimmed" />
      </NuxtLink>
    </UCard>

    <UCard>
      <template #header>AI 模型</template>
      <USelect
        :model-value="model"
        :items="modelItems"
        :disabled="!householdId"
        class="w-full"
        @update:model-value="changeModel($event as AiModel)"
      />
      <p class="mt-2 text-xs text-muted">Sonnet 5.5 兼顧準確與費用；Opus 5.5 較準但約貴一倍；Haiku 5.5 最便宜。</p>
    </UCard>

    <UCard>
      <template #header>本月預估 API 花費</template>
      <p class="text-2xl font-semibold tabular-nums">
        US$ {{ cost ? cost.usd.toFixed(cost.usd < 1 ? 3 : 2) : '—' }}
      </p>
      <p v-if="cost" class="text-xs text-muted tabular-nums">共 {{ cost.calls }} 次 AI 呼叫，依官方定價估算</p>
    </UCard>

    <UButton block color="neutral" variant="outline" icon="i-lucide-log-out" @click="signOut">
      登出
    </UButton>
  </div>
</template>
