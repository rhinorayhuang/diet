<script setup lang="ts">
import { MAX_PHOTOS_PER_ENTRY, MEAL_LABELS, type MealType } from '#shared/types/domain'

// PRD 4.2 記錄流程：拍照或手動輸入 → 確認日期與餐別 → 送出後進入確認畫面
const route = useRoute()
const toast = useToast()
const { createEntry } = useEntries()
const { ensureLoaded, getMember } = useMembers()
const { memberId: currentMemberId } = useCurrentMember()

const mode = computed(() => (route.query.mode === 'text' ? 'text' : 'photo'))
const memberId = computed(() => String(route.query.member ?? currentMemberId.value ?? ''))
const member = computed(() => getMember(memberId.value))

const now = taipeiNow()
const date = ref(String(route.query.date ?? now.date))
const mealType = ref<MealType>(defaultMealType(now.minutes))
const note = ref('')
const mealItems = Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label }))

interface Picked { file: File, preview: string }
const picked = ref<Picked[]>([])
const fileInput = ref<HTMLInputElement>()

onMounted(async () => {
  await ensureLoaded()
  if (!member.value) {
    toast.add({ title: '請先選擇成員', color: 'warning' })
    return navigateTo('/')
  }
})
onBeforeUnmount(() => picked.value.forEach(p => URL.revokeObjectURL(p.preview)))

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const room = MAX_PHOTOS_PER_ENTRY - picked.value.length
  if (files.length > room) {
    toast.add({ title: `每筆最多 ${MAX_PHOTOS_PER_ENTRY} 張照片`, color: 'warning' })
  }
  for (const file of files.slice(0, room)) {
    picked.value.push({ file, preview: URL.createObjectURL(file) })
  }
  input.value = ''
}

function removePhoto(index: number) {
  URL.revokeObjectURL(picked.value[index]!.preview)
  picked.value.splice(index, 1)
}

const canSubmit = computed(() =>
  mode.value === 'photo' ? picked.value.length > 0 : note.value.trim().length > 0,
)

const submitting = ref(false)
async function submit() {
  if (!canSubmit.value || !member.value) return
  submitting.value = true
  try {
    const photos = await Promise.all(picked.value.map(p => compressImage(p.file)))
    const id = await createEntry({
      memberId: member.value.id,
      date: date.value,
      mealType: mealType.value,
      note: note.value.trim() || null,
      photos,
    })
    await navigateTo(`/entries/${id}`, { replace: true })
  }
  catch (e) {
    toast.add({
      title: '送出失敗',
      description: (e as { message?: string })?.message ?? String(e),
      color: 'error',
    })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-center gap-2">
      <UButton to="/" color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="返回" />
      <h1 class="text-lg font-semibold">
        {{ mode === 'photo' ? '拍照記錄' : '手動輸入' }}
        <span v-if="member" class="text-muted font-normal">· {{ member.name }}</span>
      </h1>
    </header>

    <UCard v-if="mode === 'photo'">
      <div class="grid grid-cols-3 gap-2">
        <div v-for="(p, i) in picked" :key="p.preview" class="relative aspect-square">
          <img :src="p.preview" alt="" class="size-full object-cover rounded-md">
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            class="absolute top-1 right-1 rounded-full"
            aria-label="移除照片"
            @click="removePhoto(i)"
          />
        </div>
        <button
          v-if="picked.length < MAX_PHOTOS_PER_ENTRY"
          type="button"
          class="aspect-square rounded-md border-2 border-dashed border-default flex flex-col items-center justify-center gap-1 text-muted"
          @click="fileInput?.click()"
        >
          <UIcon name="i-lucide-camera" class="size-7" />
          <span class="text-xs">{{ picked.length ? '再加一張' : '拍照／選照片' }}</span>
        </button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onFilesSelected"
      >
    </UCard>

    <UCard>
      <div class="space-y-4">
        <UFormField
          :label="mode === 'photo' ? '文字補充' : '吃了什麼'"
          :hint="mode === 'photo' ? '選填' : undefined"
          :description="mode === 'photo' ? '例如：飯只吃一半、醬料沒吃' : '例如：一碗牛肉麵加一顆滷蛋、一杯無糖綠茶'"
        >
          <UTextarea v-model="note" :rows="mode === 'photo' ? 2 : 4" autoresize class="w-full" />
        </UFormField>

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

    <UButton block size="lg" icon="i-lucide-sparkles" :loading="submitting" :disabled="!canSubmit" @click="submit">
      送出給 AI 分析
    </UButton>
  </div>
</template>
