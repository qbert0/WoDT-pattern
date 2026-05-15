<template>
  <div>
    <h3 class="text-[#2a5298] font-semibold text-lg mb-3">📱 Things</h3>

    <div v-if="things.length === 0" class="text-gray-500 text-sm">
      Chưa có thing trong policy này.
    </div>

    <div v-else class="space-y-2">
      <button
        v-for="thing in things"
        :key="thing.id"
        class="w-full text-left px-4 py-3 rounded-xl border bg-white hover:bg-slate-50 border-slate-200 transition"
        @click="$emit('select', thing.id)"
      >
        <div class="font-medium text-slate-800 break-all">{{ thing.id }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  things: { id: string; policyId: string }[]
}>()

defineEmits<{
  (e: 'select', thingId: string): void
}>()
</script>