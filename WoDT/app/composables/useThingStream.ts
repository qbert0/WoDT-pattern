import { ref, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type { DittoThing } from '~/types/ditto'

export const useThingStream = (thingId: Ref<string>, thing: Ref<DittoThing | null>) => {
  const eventSource = ref<EventSource | null>(null)
  const isConnected = ref<boolean>(false)

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

  const startStream = () => {
    stopStream()

    if (!thingId.value) return

    const url = `/api/ditto/things/${encodeURIComponent(thingId.value)}/stream`
    eventSource.value = new EventSource(url)

    eventSource.value.onopen = () => {
      isConnected.value = true
      console.log(`Da ket noi SSE cho Thing: ${thingId.value}`)
    }

    eventSource.value.onmessage = (event) => {
      const updatedThing = parseSseThingUpdate(event.data)

      if (!thing.value || !updatedThing?.features) {
        return
      }

      thing.value = {
        ...thing.value,
        features: {
          ...thing.value.features,
          ...updatedThing.features
        }
      }
    }

    eventSource.value.onerror = () => {
      console.error('Mat ket noi SSE. Trinh duyet dang tu dong ket noi lai...')
      isConnected.value = false
    }
  }

  const stopStream = () => {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
      isConnected.value = false
      console.log(`Da ngat ket noi SSE cho Thing: ${thingId.value}`)
    }
  }

  onBeforeUnmount(() => {
    stopStream()
  })

  return {
    isConnected,
    startStream,
    stopStream
  }
}
