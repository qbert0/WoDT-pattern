<template>
  <div class="bg-white rounded-2xl p-5 mb-6 shadow-lg flex flex-wrap justify-between items-center gap-4">
    <div>
      <h1 class="text-2xl font-bold text-[#2a5298]">Smart Home Dashboard</h1>
      <p class="text-gray-500 text-sm">Eclipse Ditto - Digital Twin Platform</p>
    </div>

    <div class="flex gap-2">
      <NuxtLink
        to="/"
        class="px-4 py-2 rounded-xl transition-all"
        :class="$route.path === '/' ? 'bg-[#2a5298] text-white' : 'bg-gray-100 hover:bg-gray-200'"
      >
        Dashboard
      </NuxtLink>
      <NuxtLink
        to="/system"
        class="px-4 py-2 rounded-xl transition-all"
        :class="$route.path === '/system' ? 'bg-[#2a5298] text-white' : 'bg-gray-100 hover:bg-gray-200'"
      >
        System
      </NuxtLink>
    </div>

    <div class="flex gap-4 items-center">
      <div class="bg-gradient-to-r from-[#2a5298] to-[#1e3c72] text-white p-3 rounded-xl text-center min-w-[120px]">
        <div class="text-2xl font-bold">{{ store.totalThings }}</div>
        <div class="text-xs opacity-90">Tong thiet bi</div>
      </div>

      <div class="bg-gradient-to-r from-[#2a5298] to-[#1e3c72] text-white p-3 rounded-xl text-center min-w-[120px]">
        <div class="text-2xl font-bold">{{ store.totalPolicies }}</div>
        <div class="text-xs opacity-90">So Policy</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const store = useDittoStore()
</script>