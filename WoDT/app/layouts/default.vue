<template>
  <div class="min-h-screen bg-slate-100">
    <div class="container mx-auto max-w-[1400px] px-4 py-6">
      <Header />
      
      <div class="flex flex-col lg:flex-row gap-6 mt-6">
        <aside class="w-full lg:w-96 bg-white rounded-2xl shadow-lg h-fit lg:sticky lg:top-5 overflow-hidden border border-slate-200">
          <div class="p-4 border-b border-gray-200">
            <PolicySelector
              :policies="store.policies"
              :selected="store.selectedPolicyId"
              @select="store.setSelectedPolicy"
            />
          </div>

          <div class="p-4">
            <ThingsList
              :things="store.selectedPolicyThings"
              @select="goToThing"
            />
          </div>
        </aside>

        <main class="flex-1 min-w-0">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Header from '~/components/common/Header.vue'
import PolicySelector from '~/components/dashboard/PolicySelector.vue'
import ThingsList from '~/components/dashboard/ThingsInPolicy.vue' // Đã chuẩn hóa tên

const store = useDittoStore()
const { getOverview } = useDittoApi()

// Fetch data ở cấp độ Layout. Chỉ chạy 1 lần khi load app.
const { data, error } = await useAsyncData('ditto-overview', () => getOverview())

if (error.value) console.error(error.value)

// Theo dõi và cập nhật store ngay khi có data
watchEffect(() => {
  if (data.value) {
    store.setOverview(data.value)
  }
})

// Hàm điều hướng dùng chung
const goToThing = async (thingId: string) => {
  await navigateTo(`/things/${encodeURIComponent(thingId)}`)
}
</script>