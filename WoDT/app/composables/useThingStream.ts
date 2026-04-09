import { ref, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type { DittoThing } from '~/types/ditto' // Đảm bảo đường dẫn này đúng với dự án của bạn

export const useThingStream = (thingId: Ref<string>, thing: Ref<DittoThing | null>) => {
  const eventSource = ref<EventSource | null>(null)
  const isConnected = ref<boolean>(false)

  const startStream = () => {
    // Đảm bảo ngắt kết nối cũ (nếu có) trước khi mở luồng mới
    stopStream()

    if (!thingId.value) return

    const url = `/api/ditto/things/${encodeURIComponent(thingId.value)}/stream`
    eventSource.value = new EventSource(url)

    eventSource.value.onopen = () => {
      isConnected.value = true
      console.log(`🟢 Đã kết nối SSE cho Thing: ${thingId.value}`)
    }

    eventSource.value.onmessage = (event) => {
      try {
        const updatedThing = JSON.parse(event.data)
        
        // Cập nhật trực tiếp vào Ref được truyền từ Component
        if (thing.value && updatedThing.features) {
          thing.value = {
            ...thing.value,
            features: {
              ...thing.value.features,
              ...updatedThing.features
            }
          }
        }
      } catch (err) {
        console.error('Lỗi phân tích data SSE:', err)
      }
    }

    eventSource.value.onerror = () => {
      console.error('🔴 Mất kết nối SSE. Trình duyệt đang tự động kết nối lại...')
      isConnected.value = false
    }
  }

  const stopStream = () => {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
      isConnected.value = false
      console.log(`⭕ Đã ngắt kết nối SSE cho Thing: ${thingId.value}`)
    }
  }

  // Tự động dọn dẹp khi người dùng rời khỏi trang
  onBeforeUnmount(() => {
    stopStream()
  })

  return {
    isConnected,
    startStream,
    stopStream
  }
}