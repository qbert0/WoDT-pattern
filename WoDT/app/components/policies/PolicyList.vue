<template>
  <div class="space-y-3 max-h-[500px] overflow-y-auto">
    <div v-for="p in policies" :key="p.policyId" class="bg-gray-50 rounded-xl p-4 border">
      <div class="flex justify-between">
        <div><div class="font-mono font-semibold text-[#2a5298]">{{ p.policyId }}</div><div class="text-xs text-gray-500">{{ Object.keys(p.entries?.READ?.subjects || {}).length }} subjects</div></div>
        <button @click="del(p.policyId)" class="text-red-400 hover:text-red-600">🗑️</button>
      </div>
      <details class="mt-2"><summary class="text-xs text-gray-500 cursor-pointer">Chi tiết</summary><pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">{{ JSON.stringify(p, null, 2) }}</pre></details>
    </div>
    <div v-if="!policies.length" class="text-center text-gray-400 py-8">📭 Chưa có policy</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ policies: any[] }>();
const emit = defineEmits(['deleted']);
const config = useRuntimeConfig();

const del = async (id: string) => {
  if (!confirm(`Xóa ${id}?`)) return;
  await fetch(`${config.public.dittoBaseUrl}/api/2/policies/${id}`, { method: 'DELETE', headers: { 'Authorization': `Basic ${btoa(`${config.public.dittoUsername}:${config.public.dittoPassword}`)}` } });
  emit('deleted');
};
</script>