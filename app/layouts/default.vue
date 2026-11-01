<script setup lang="ts">
const route = useRoute()

const tabs = [
  { to: '/', label: '今天', icon: 'i-lucide-utensils' },
  { to: '/history', label: '歷史', icon: 'i-lucide-calendar-days' },
  { to: '/settings', label: '設定', icon: 'i-lucide-settings' },
]
</script>

<template>
  <div class="min-h-dvh bg-default text-default flex flex-col">
    <main class="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-24">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 border-t border-default bg-default/95 backdrop-blur"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <ul class="max-w-lg mx-auto grid grid-cols-3">
        <li v-for="tab in tabs" :key="tab.to">
          <NuxtLink
            :to="tab.to"
            class="flex flex-col items-center gap-0.5 py-2 text-xs"
            :class="route.path === tab.to ? 'text-primary' : 'text-muted'"
          >
            <UIcon :name="tab.icon" class="size-6" />
            {{ tab.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
