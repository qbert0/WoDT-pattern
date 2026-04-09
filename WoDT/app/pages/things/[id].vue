<template>
  <div class="h-full">
    <ThingForm />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useThingDetailStore } from '~/stores/thing'
import ThingForm from '~/components/things/ThingForm.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const thingStore = useThingDetailStore()
const dittoStore = useDittoStore()
const { getThing } = useDittoApi()

const thingId = computed(() => String(route.params.id))

// Logic auto-select Policy trên Sidebar
watch(() => dittoStore.policies, () => {
  // Lấy trực tiếp từ thingsByPolicy trong store thay vì overviewData
  const allThingsByPolicy = dittoStore.thingsByPolicy || {}
  
  // TypeScript sẽ tự hiểu 'things' là mảng { id: string; policyId: string }[] 
  // dựa theo Record<string, { id: string; policyId: string }[]> trong State của bạn
  const foundPolicy = Object.entries(allThingsByPolicy).find(([_, things]) =>
    things.some(t => t.id === thingId.value)
  )
  
  if (foundPolicy) {
    dittoStore.setSelectedPolicy(foundPolicy[0]) // foundPolicy[0] chính là cái key (policyId)
  }
}, { immediate: true })


// Gọi API lần đầu
const fetchInitialThing = async () => {
  try {
    thingStore.setPending(true)
    thingStore.setError(null)
    const data = await getThing(thingId.value)
    thingStore.setThing(data)
  } catch (e) {
    thingStore.setError(e)
  } finally {
    thingStore.setPending(false)
  }
}

// Xử lý Real-time (SSE)
let eventSource: EventSource | null = null

const setupRealtime = () => {
  eventSource = new EventSource(`/api/ditto/things/${encodeURIComponent(thingId.value)}/stream`)

  eventSource.onmessage = (event) => {
    try {
      const updatedThing = JSON.parse(event.data)
      if (updatedThing.features) {
        // Cập nhật thẳng vào store
        thingStore.updateFeatures(updatedThing.features)
      }
    } catch (err) {
      console.error('Lỗi phân tích data SSE:', err)
    }
  }
}

// Load data khi chuyển trang / vào trang
watch(thingId, async () => {
  if (eventSource) eventSource.close()
  await fetchInitialThing()
  setupRealtime()
})

onMounted(async () => {
  await fetchInitialThing()
  setupRealtime()
})

onBeforeUnmount(() => {
  if (eventSource) eventSource.close()
  // Reset store khi rời trang nếu cần
  thingStore.setThing(null)
})
</script>