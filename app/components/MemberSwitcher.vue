<script setup lang="ts">
// 切換目前查看的成員，選擇會記在這支手機上
const { activeMembers } = useMembers()
const { memberId, setDefaultMember } = useCurrentMember()

const items = computed(() => activeMembers.value.map(m => ({ value: m.id, label: m.name })))
const selected = computed({
  get: () => memberId.value ?? undefined,
  set: (id?: string) => setDefaultMember(id ?? null),
})
</script>

<template>
  <USelect v-if="items.length" v-model="selected" :items="items" variant="ghost" class="min-w-28 font-medium" />
  <span v-else />
</template>
