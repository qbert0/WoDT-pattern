<template>
  <div class="space-y-8">
    
    <section v-if="Object.keys(store.attributes).length > 0">
      </section>

    <section v-if="Object.keys(store.features).length > 0">
      <h3 class="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        Features & Controls
      </h3>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div 
          v-for="(feature, featureName) in store.features" 
          :key="featureName"
          class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col"
        >
          <div class="font-semibold text-slate-800 mb-4 border-b pb-2 flex justify-between items-center">
            <span>{{ featureName }}</span>
          </div>
          
          <div class="space-y-3 flex-1 mb-4">
            <div 
              v-for="(propData, propName) in feature.properties" 
              :key="propName"
              class="flex justify-between items-center bg-slate-50 p-3 rounded-lg"
            >
              <span class="text-sm font-medium text-slate-600">{{ propName }}</span>
              <span class="text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded border border-slate-200">
                {{ propData }}
              </span>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100">
            <p class="text-xs text-slate-400 mb-2 uppercase font-semibold">Gửi lệnh điều khiển</p>
            <div class="flex flex-wrap gap-2">
              <button 
                @click="handleCommand(featureName, 'turnOn')"
                :disabled="isSending"
                class="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Bật (On)
              </button>
              
              <button 
                @click="handleCommand(featureName, 'turnOff')"
                :disabled="isSending"
                class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Tắt (Off)
              </button>

              <button 
                @click="demoUpdateKettlePower"
                :disabled="isSending"
                class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useThingDetailStore } from '~/stores/thing'
// Lấy hàm sendMessage từ composable
const { sendMessage } = useDittoApi() 

const store = useThingDetailStore()
const isSending = ref(false)

// Hàm xử lý khi bấm nút
const handleCommand = async (featureName: string, action: string, payload: any = {}) => {
  if (!store.thing?.thingId) return

  try {
    isSending.value = true
    
    // Format subject theo chuẩn: {featureName}/{action}
    // Ví dụ: "lamp/turnOn"
    const subject = `${featureName}/${action}`
    
    console.log(`Đang gửi lệnh: ${subject}...`)
    
    // Gọi API
    await sendMessage(store.thing.thingId, subject, payload)
    
    // Gửi thành công - Bạn có thể thêm Toast Notification ở đây
    console.log('✅ Đã gửi lệnh thành công!')
    
  } catch (error) {
    console.error('❌ Lỗi khi gửi lệnh:', error)
    alert('Không thể gửi lệnh đến thiết bị!')
  } finally {
    isSending.value = false
  }
}

const demoUpdateKettlePower = async () => {
  const thingId = 'smart-home:kettle-01'
  const featureId = 'power'
  const subject = 'setPower' // Subject do thiết bị/adapter quy định
  
  const payload = {
    properties: {
      powerConsumption: 300
    }
  }

  try {
    console.log('Đang ép giá trị kettle...')
    await sendMessage(thingId, featureId, subject, payload, {
      timeout: 0, // 0 = Fire and forget (không block chờ thiết bị phản hồi)
      // requestedAcks: 'live-response' // Dùng nếu muốn chắc chắn thiết bị đã nhận
    })
    alert('Đã gửi lệnh ép công suất về 300W thành công!')
  } catch (error) {
    console.error('Lỗi:', error)
    alert('Lỗi khi ép giá trị thiết bị')
  }
}
</script>