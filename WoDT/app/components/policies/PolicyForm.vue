<template>
  <form @submit.prevent="create" class="space-y-4">
    <input v-model="id" type="text" required placeholder="namespace:policy-name" class="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-[#2a5298]" />
    <textarea v-model="subjectsJson" rows="3" placeholder='{"ditto":"read"}' class="w-full px-4 py-2 border rounded-xl font-mono text-sm"></textarea>
    <button :disabled="loading" class="w-full bg-[#2a5298] text-white py-2 rounded-xl hover:bg-[#1e3c72] disabled:opacity-50">{{ loading ? 'Đang tạo...' : '➕ Tạo' }}</button>
    <div v-if="error" class="text-red-500 text-center p-2 bg-red-50 rounded-xl">❌ {{ error }}</div>
    <div v-if="success" class="text-green-600 text-center p-2 bg-green-50 rounded-xl">✅ Thành công!</div>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits(['created']);
const config = useRuntimeConfig();
const id = ref('');
const subjectsJson = ref('{"ditto":"read"}');
const loading = ref(false);
const error = ref('');
const success = ref(false);

const create = async () => {
  loading.value = true;
  error.value = '';
  try {
    const subjects = JSON.parse(subjectsJson.value);
    const data = { policyId: id.value, entries: { READ: { subjects: {}, resources: { "thing:/": { grant: ["READ"], revoke: [] } } } } };
    for (const [k, v] of Object.entries(subjects)) data.entries.READ.subjects[k] = { type: "generated" };
    
    const res = await fetch(`${config.public.dittoBaseUrl}/api/2/policies/${id.value}`, {
      method: 'PUT', headers: { 'Authorization': `Basic ${btoa(`${config.public.dittoUsername}:${config.public.dittoPassword}`)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    success.value = true;
    id.value = '';
    emit('created');
    setTimeout(() => success.value = false, 2000);
  } catch (e: any) { error.value = e.message; }
  finally { loading.value = false; }
};
</script>