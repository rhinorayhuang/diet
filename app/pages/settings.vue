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

// TODO: 從 settings 資料表讀寫
const model = ref<AiModel>(DEFAULT_AI_MODEL)
const modelItems = Object.entries(AI_MODEL_LABELS).map(([value, label]) => ({ value, label }))

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

    <UCard>
      <template #header>AI 模型</template>
      <USelect v-model="model" :items="modelItems" class="w-full" />
    </UCard>

    <UCard>
      <template #header>本月預估 API 花費</template>
      <p class="text-2xl font-semibold tabular-nums">US$ —</p>
    </UCard>

    <UButton block color="neutral" variant="outline" icon="i-lucide-log-out" @click="signOut">
      登出
    </UButton>
  </div>
</template>
