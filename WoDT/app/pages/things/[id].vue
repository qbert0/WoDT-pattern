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

watch(
  () => dittoStore.policies,
  () => {
    const allThingsByPolicy = dittoStore.thingsByPolicy || {}
    const foundPolicy = Object.entries(allThingsByPolicy).find(([_, things]) =>
      things.some(t => t.id === thingId.value)
    )

    if (foundPolicy) {
      dittoStore.setSelectedPolicy(foundPolicy[0])
    }
  },
  { immediate: true }
)

const fetchInitialThing = async () => {
  try {
    thingStore.setPending(true)
    thingStore.setError(null)
    const data = await getThing(thingId.value)
    thingStore.setThing(data)
  } catch (error) {
    thingStore.setError(error)
  } finally {
    thingStore.setPending(false)
  }
}

let eventSource: EventSource | null = null

const parseSseThingUpdate = (rawData: string) => {
  const payload = rawData?.trim()

  if (!payload) {
    return null
  }

  try {
    return JSON.parse(payload)
  } catch (error) {
    console.warn('Bo qua SSE payload khong hop le:', payload, error)
    return null
  }
}

const setupRealtime = () => {
  eventSource = new EventSource(`/api/ditto/things/${encodeURIComponent(thingId.value)}/stream`)

  eventSource.onmessage = (event) => {
    const updatedThing = parseSseThingUpdate(event.data)

    if (!updatedThing?.features) {
      return
    }

    thingStore.updateFeatures(updatedThing.features)
  }
}

watch(thingId, async () => {
  if (eventSource) {
    eventSource.close()
  }

  await fetchInitialThing()
  setupRealtime()
})

onMounted(async () => {
  await fetchInitialThing()
  setupRealtime()
})

onBeforeUnmount(() => {
  if (eventSource) {
    eventSource.close()
  }

  thingStore.setThing(null)
})
</script>