<script setup lang="ts">
import { AI_MODEL_LABELS, DEFAULT_AI_MODEL, type AiModel } from '#shared/types/domain'

const supabase = useSupabaseClient()

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

    <UCard>
      <template #header>成員</template>
      <p class="text-sm text-dimmed">尚未實作：新增、編輯、封存、還原；體重紀錄</p>
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
