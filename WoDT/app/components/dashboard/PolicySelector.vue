<template>
  <div>
    <h3 class="text-[#2a5298] font-semibold text-lg mb-3">🗂️ Policy</h3>

    <div class="space-y-2">
      <button
        v-for="policy in policies"
        :key="policy.policyId"
        class="w-full text-left px-4 py-3 rounded-xl border transition"
        :class="selected === policy.policyId
          ? 'bg-[#2a5298] text-white border-[#2a5298]'
          : 'bg-white hover:bg-slate-50 border-slate-200'"
        @click="$emit('select', policy.policyId)"
      >
        <div class="font-semibold">{{ policy.policyId }}</div>
        <div class="text-sm opacity-80">{{ policy.count }} things</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  policies: { policyId: string; count: number }[]
  selected: string | null
}>()

defineEmits<{
  (e: 'select', policyId: string): void
}>()
</script>