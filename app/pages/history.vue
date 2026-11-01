<script setup lang="ts">
// TODO: 日曆、7/30 天熱量長條圖（含目標線）、體重折線圖（Chart.js）
const range = ref<'7' | '30'>('7')
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-lg font-semibold">歷史</h1>

    <UCard>
      <template #header>日曆</template>
      <p class="text-sm text-dimmed">尚未實作</p>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span>每日熱量</span>
          <UTabs
            v-model="range"
            size="xs"
            :content="false"
            :items="[{ label: '7 天', value: '7' }, { label: '30 天', value: '30' }]"
          />
        </div>
      </template>
      <p class="text-sm text-dimmed">尚未實作</p>
    </UCard>

    <UCard>
      <template #header>體重</template>
      <p class="text-sm text-dimmed">尚未實作</p>
    </UCard>
  </div>
</template>
