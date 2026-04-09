<template>
  <div class="bg-slate-800 rounded-xl p-5 h-full min-h-[400px] overflow-auto shadow-inner">
    <pre class="text-emerald-400 text-sm font-mono whitespace-pre-wrap break-words">{{ formattedJson }}</pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThingDetailStore } from '~/stores/thing'

const store = useThingDetailStore()

const formattedJson = computed(() => {
  return JSON.stringify(store.thing, null, 2)
})
</script>