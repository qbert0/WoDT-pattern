<template>
  <div class="space-y-8">
    <section v-if="Object.keys(store.features).length > 0">
      <h3 class="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-700">
        <span class="h-2 w-2 rounded-full bg-green-500"></span>
        Features
      </h3>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div
          v-for="(feature, featureName) in store.features"
          :key="featureName"
          class="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="mb-4 flex items-center justify-between border-b pb-2 font-semibold text-slate-800">
            <span>{{ featureName }}</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="(propData, propName) in feature.properties"
              :key="propName"
              class="flex items-center justify-between rounded-lg bg-slate-50 p-3"
            >
              <span class="text-sm font-medium text-slate-600">{{ propName }}</span>
              <span class="rounded border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-900">
                {{ propData }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="advancedTasks.length">
      <div class="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-700">
        <span class="h-2 w-2 rounded-full bg-amber-500"></span>
        Advanced Settings
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="task in advancedTasks"
            :key="task.taskId"
            class="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div class="mb-3">
              <div class="font-medium text-slate-800">{{ task.taskName }}</div>
              <div class="text-xs text-slate-500">{{ task.taskCommand }}</div>
            </div>

            <div class="space-y-3">
              <label
                v-for="input in task.inputParameters"
                :key="`${task.taskId}-${input.name}`"
                class="block"
              >
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {{ formatLabel(input.name) }}
                </span>
                <input
                  v-model.number="taskInputs[task.taskId][input.name]"
                  :type="getInputType(input.type)"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                >
              </label>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            :disabled="isSending"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
            @click="applyAdvancedSettings"
          >
            Apply Settings
          </button>
          <span class="text-sm text-slate-500">
            Goal execution will use these current values.
          </span>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-700">
          <span class="h-2 w-2 rounded-full bg-blue-500"></span>
          Goals You Can Execute
        </h3>
        <span v-if="actionsPending" class="text-sm text-slate-400">Loading goals...</span>
      </div>

      <div
        v-if="actionsError"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ actionsError }}
      </div>

      <div v-else-if="availableGoals.length" class="grid gap-4 md:grid-cols-2">
        <div
          v-for="goal in availableGoals"
          :key="goal.goalId"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="mb-3">
            <div class="text-base font-semibold text-slate-900">{{ goal.goalName }}</div>
            <div class="text-xs text-slate-500">{{ goal.goalId }}</div>
          </div>

          <p v-if="goal.description" class="mb-4 text-sm leading-6 text-slate-600">
            {{ goal.description }}
          </p>

          <button
            :disabled="isSending"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            @click="runGoal(goal.goalId)"
          >
            Execute Goal
          </button>
        </div>
      </div>

      <div
        v-else-if="!actionsPending"
        class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
      >
        No executable goals found for this digital twin.
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { ThingActionTask, ThingGoal } from '~/types/ditto'
import { useThingDetailStore } from '~/stores/thing'

const props = defineProps<{
  thingId: string
}>()

const { getThingActions, executeThingGoal, executeThingTask } = useDittoApi()
const store = useThingDetailStore()

const isSending = ref(false)
const actionsPending = ref(false)
const actionsError = ref('')
const availableGoals = ref<ThingGoal[]>([])
const tasks = ref<ThingActionTask[]>([])
const taskInputs = reactive<Record<string, Record<string, number | string>>>({})

const advancedTasks = computed(() => {
  return tasks.value.filter(task => task.inputParameters.length > 0)
})

const getCurrentValueForTaskInput = (task: ThingActionTask, inputName: string) => {
  const water = store.features?.water?.properties || {}
  const beans = store.features?.beans?.properties || {}

  if (task.taskCommand === 'SET_TEMP') {
    return Number(water.targetTemperature ?? 100)
  }

  if (task.taskCommand === 'SET_VOLUME') {
    return Number(water.waterLevel ?? 0)
  }

  if (task.taskCommand === 'SET_BEAN_AMOUNT') {
    return Number(beans.targetAmount ?? beans.beanAmount ?? 0)
  }

  return typeof taskInputs[task.taskId]?.[inputName] === 'number' ? taskInputs[task.taskId][inputName] : ''
}

const syncAdvancedInputsFromState = () => {
  for (const task of advancedTasks.value) {
    if (!taskInputs[task.taskId]) {
      taskInputs[task.taskId] = {}
    }

    for (const input of task.inputParameters) {
      taskInputs[task.taskId][input.name] = getCurrentValueForTaskInput(task, input.name)
    }
  }
}

const buildTaskPayload = (task: ThingActionTask) => {
  const rawValues = taskInputs[task.taskId] || {}

  if (task.taskCommand === 'SET_TEMP') {
    return {
      temperature: Number(rawValues.temperature)
    }
  }

  if (task.taskCommand === 'SET_VOLUME') {
    return {
      water_level: Number(rawValues.volume ?? rawValues.water_level),
      volume: Number(rawValues.volume ?? rawValues.water_level)
    }
  }

  if (task.taskCommand === 'SET_BEAN_AMOUNT') {
    return {
      amount: Number(rawValues.amount ?? rawValues.bean_amount),
      bean_amount: Number(rawValues.amount ?? rawValues.bean_amount)
    }
  }

  return Object.fromEntries(
    Object.entries(rawValues).map(([key, value]) => [key, typeof value === 'string' ? value : Number(value)])
  )
}

const loadActions = async () => {
  if (!props.thingId) return

  actionsPending.value = true
  actionsError.value = ''

  try {
    const data = await getThingActions(props.thingId)
    availableGoals.value = data.availableGoals || []
    tasks.value = data.tasks || []
    syncAdvancedInputsFromState()
  } catch (error: any) {
    actionsError.value = error?.data?.statusMessage || error?.message || 'Failed to load goals'
  } finally {
    actionsPending.value = false
  }
}

const applyAdvancedSettings = async () => {
  if (!props.thingId) return

  try {
    isSending.value = true

    for (const task of advancedTasks.value) {
      await executeThingTask(props.thingId, task.taskId, buildTaskPayload(task))
    }
  } catch (error: any) {
    console.error('Failed to apply advanced settings:', error)
    alert(error?.data?.statusMessage || 'Khong the cap nhat advanced settings')
  } finally {
    isSending.value = false
  }
}

const runGoal = async (goalId: string) => {
  if (!props.thingId) return

  try {
    isSending.value = true
    await executeThingGoal(props.thingId, goalId)
  } catch (error: any) {
    console.error('Failed to execute goal:', error)
    alert(error?.data?.statusMessage || 'Khong the thuc hien goal')
  } finally {
    isSending.value = false
  }
}

const getInputType = (type: string) => {
  const normalized = type.toLowerCase()
  if (normalized.includes('int') || normalized.includes('float') || normalized.includes('number')) {
    return 'number'
  }
  return 'text'
}

const formatLabel = (value: string) => {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
}

watch(
  () => props.thingId,
  async () => {
    await loadActions()
  },
  { immediate: true }
)

watch(
  () => store.features,
  () => {
    syncAdvancedInputsFromState()
  },
  { deep: true }
)
</script>