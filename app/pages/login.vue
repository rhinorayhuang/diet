<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function signIn() {
  loading.value = true
  errorMessage.value = ''
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (error) {
    errorMessage.value = '登入失敗，請確認 Email 與密碼'
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center px-4 bg-default">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">飲食記錄</h1>
      </template>
      <form class="space-y-4" @submit.prevent="signIn">
        <UFormField label="Email">
          <UInput v-model="email" type="email" autocomplete="username" required class="w-full" />
        </UFormField>
        <UFormField label="密碼">
          <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
        </UFormField>
        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
        <UButton type="submit" block :loading="loading">登入</UButton>
      </form>
    </UCard>
  </div>
</template>
