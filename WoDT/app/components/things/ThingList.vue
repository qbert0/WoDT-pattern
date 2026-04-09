<template>
  <div class="space-y-3 max-h-[500px] overflow-y-auto">
    <div v-for="t in things" :key="t.thingId || t._id" class="bg-gray-50 rounded-xl p-4 border">
      <div class="flex justify-between items-start">
        <div class="flex items-center gap-3">
          <span class="text-3xl">{{ getDeviceIcon(t.thingId || t._id, t) }}</span>
          <div><div class="font-semibold">{{ (t.thingId || t._id).split(':').pop() }}</div><div class="text-xs text-gray-400 font-mono">{{ t.thingId || t._id }}</div><div class="text-xs text-[#2a5298]">Policy: {{ (t.policyId || 'no-policy').split(':').pop() }}</div></div>
        </div>
        <button @click="del(t.thingId || t._id)" class="text-red-400 hover:text-red-600">🗑️</button>
      </div>
      <div class="mt-2 flex gap-2 text-xs"><span :class="isDeviceActive(t) ? 'text-green-600' : 'text-gray-400'">{{ isDeviceActive(t) ? '🟢 Hoạt động' : '⚪ Tắt' }}</span><span v-if="getTemperature(t)" class="text-[#ff6b35]">🌡️ {{ getTemperature(t)?.value }}{{ getTemperature(t)?.unit }}</span></div>
    </div>
    <div v-if="!things.length" class="text-center text-gray-400 py-8">📭 Chưa có thing</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ things: any[] }>();
const emit = defineEmits(['deleted']);
const config = useRuntimeConfig();

const del = async (id: string) => {
  if (!confirm(`Xóa ${id}?`)) return;
  await fetch(`${config.public.dittoBaseUrl}/api/2/things/${id}`, { method: 'DELETE', headers: { 'Authorization': `Basic ${btoa(`${config.public.dittoUsername}:${config.public.dittoPassword}`)}` } });
  emit('deleted');
};
</script>