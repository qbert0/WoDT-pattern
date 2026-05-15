import { defineStore } from 'pinia'
import type { DittoThing } from '~/types/ditto'

interface ThingState {
  thing: DittoThing | null
  activeTab: 'ui' | 'json'
  pending: boolean
  error: any
}

export const useThingDetailStore = defineStore('thingDetail', {
  state: (): ThingState => ({
    thing: null,
    activeTab: 'ui',
    pending: false,
    error: null
  }),

  getters: {
    hasData: (state) => state.thing !== null,
    attributes: (state) => state.thing?.attributes || {},
    features: (state) => state.thing?.features || {}
  },

  actions: {
    setThing(data: DittoThing | null) {
      this.thing = data
    },
    setPending(status: boolean) {
      this.pending = status
    },
    setError(err: any) {
      this.error = err
    },
    setActiveTab(tab: 'ui' | 'json') {
      this.activeTab = tab
    },
    // Dùng cho Real-time cập nhật một phần dữ liệu
    updateFeatures(newFeatures: Record<string, any>) {
      if (!this.thing) return
      // Clone lại features hiện tại
      const updatedFeatures = { ...this.thing.features }
      // Merge sâu từng feature một
      for (const [key, value] of Object.entries(newFeatures)) {
        updatedFeatures[key] = {
          ...(updatedFeatures[key] || {}),
          ...value
        }
      }
      // Ép Vue nhận diện sự thay đổi bằng cách gán lại toàn bộ object thing
      this.thing = {
        ...this.thing,
        features: updatedFeatures
      }
    }
  }
})