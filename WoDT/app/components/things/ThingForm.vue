<template>
  <div class="h-full flex flex-col bg-white rounded-2xl shadow-lg border border-slate-200">
    
    <div class="border-b border-slate-200">
      <div class="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-800">
            {{ store.thing?.thingId || 'Dang tai...' }}
          </h2>
          <p class="text-sm text-slate-500">
            Policy: {{ store.thing?.policyId || '...' }}
          </p>
        </div>
        
        <nav class="flex space-x-2 bg-slate-100 p-1 rounded-lg">
          <button
            @click="store.setActiveTab('ui')"
            :class="[
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              store.activeTab === 'ui' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'
            ]"
          >
            UI
          </button>
          <button
            @click="store.setActiveTab('json')"
            :class="[
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              store.activeTab === 'json' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'
            ]"
          >
            JSON Raw
          </button>
        </nav>
      </div>
    </div>

    <div v-if="store.pending" class="flex-1 flex items-center justify-center p-6 text-slate-400">
      <span class="animate-pulse">Dang tai du lieu...</span>
    </div>
    
    <div v-else-if="store.error" class="m-6 p-4 bg-red-50 text-red-600 rounded-lg">
      Loi tai du lieu thiet bi.
    </div>

    <div v-else-if="store.hasData" class="flex-1 p-6 overflow-y-auto">
      <Transition name="fade" mode="out-in">
        <ThingUI v-if="store.activeTab === 'ui'" :thing-id="store.thing?.thingId || ''" />
        <ThingJson v-else-if="store.activeTab === 'json'" />
      </Transition>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useThingDetailStore } from '~/stores/thing'
import ThingUI from './ThingUI.vue'
import ThingJson from './ThingJson.vue'

const store = useThingDetailStore()
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
