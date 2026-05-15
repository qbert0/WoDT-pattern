<template>
  <div class="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 h-full">
    <h2 class="text-2xl font-bold text-slate-800 mb-3">📊 Dashboard</h2>
    <p class="text-slate-600 mb-6">
      Chọn một policy ở sidebar để xem các thing thuộc policy đó.
      Sau đó bấm vào thing để mở trang chi tiết.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-2xl border border-slate-200 p-5 bg-slate-50">
        <div class="text-sm text-slate-500">Tổng số Thing</div>
        <div class="text-3xl font-bold text-slate-800 mt-2">
          {{ store.totalThings }}
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 p-5 bg-slate-50">
        <div class="text-sm text-slate-500">Tổng số Policy</div>
        <div class="text-3xl font-bold text-slate-800 mt-2">
          {{ store.totalPolicies }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
const store = useDittoStore()
</script>