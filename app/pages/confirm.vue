<script setup lang="ts">
// @nuxtjs/supabase 的 callback 頁；Email + 密碼登入不會經過這裡，保留給日後的 Email 驗證流程
definePageMeta({ layout: false })

const user = useSupabaseUser()
watch(user, () => {
  if (user.value) navigateTo('/')
}, { immediate: true })
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center text-muted">登入中…</div>
</template>
