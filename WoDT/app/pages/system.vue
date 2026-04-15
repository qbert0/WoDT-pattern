<template>
  <div class="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
    <section>
      <h2 class="mb-2 text-2xl font-bold text-slate-800">System</h2>
      <p class="text-sm text-slate-500">
        Execute coordinator goals across multiple digital twins.
      </p>
    </section>

    <section>
      <div class="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-700">
        <span class="h-2 w-2 rounded-full bg-green-500"></span>
        Connected Things
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div
          v-for="thing in things"
          :key="thing.thingId"
          class="rounded-2xl border border-slate-200 bg-slate-50 p-5"
        >
          <div class="mb-3">
            <div class="font-semibold text-slate-900">{{ thing.thingId }}</div>
            <div class="text-xs text-slate-500">{{ thing.goalRootId || 'No goal root' }}</div>
          </div>

          <div class="space-y-3">
            <div
              v-for="(feature, featureName) in thing.features"
              :key="featureName"
              class="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div class="mb-2 text-sm font-medium text-slate-700">{{ featureName }}</div>
              <div
                v-for="(value, propertyName) in feature.properties"
                :key="propertyName"
                class="flex items-center justify-between py-1 text-sm"
              >
                <span class="text-slate-500">{{ propertyName }}</span>
                <span class="font-medium text-slate-900">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="directParameters.length || relationSettings.length">
      <div class="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-700">
        <span class="h-2 w-2 rounded-full bg-amber-500"></span>
        Advanced Settings
      </div>

      <div class="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div v-if="directParameters.length" class="grid gap-4 md:grid-cols-2">
          <label
            v-for="item in directParameters"
            :key="`${item.taskId}-${item.parameterName}`"
            class="block rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {{ item.taskName }} / {{ item.label }}
            </span>
            <input
              v-model.number="taskInputs[item.taskId][item.parameterName]"
              :type="getInputType(item.inputType)"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400"
            >
          </label>
        </div>

        <div v-if="relationSettings.length" class="grid gap-4 md:grid-cols-2">
          <div
            v-for="relation in relationSettings"
            :key="relation.relationKey"
            class="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div class="mb-2 text-sm font-semibold text-slate-800">
              {{ relation.sourceTaskName }} -> {{ relation.targetTaskName }}
            </div>
            <p v-if="relation.description" class="mb-3 text-sm text-slate-500">
              {{ relation.description }}
            </p>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Factor
                </span>
                <input
                  v-model.number="relationInputs[relation.relationKey].factor"
                  type="number"
                  step="0.1"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                >
              </label>

              <label class="block">
                <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Offset
                </span>
                <input
                  v-model.number="relationInputs[relation.relationKey].offset"
                  type="number"
                  step="0.1"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                >
              </label>
            </div>

            <div class="mt-3 text-sm text-slate-600">
              Derived {{ relation.targetParameter }}:
              <span class="font-semibold text-slate-900">
                {{ getDerivedValue(relation) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-700">
          <span class="h-2 w-2 rounded-full bg-blue-500"></span>
          System Goals
        </h3>
        <span v-if="pending" class="text-sm text-slate-400">Loading system...</span>
      </div>

      <div
        v-if="errorMessage"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ errorMessage }}
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
            :disabled="executing"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            @click="runSystemGoal(goal.goalId)"
          >
            Execute System Goal
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { SystemAdvancedInput, SystemRelationSetting, SystemThingSummary, ThingGoal } from '~/types/ditto'

definePageMeta({ layout: 'default' })

const { getSystemActions, executeSystemGoal } = useDittoApi()

const pending = ref(false)
const executing = ref(false)
const errorMessage = ref('')
const things = ref<SystemThingSummary[]>([])
const availableGoals = ref<ThingGoal[]>([])
const directParameters = ref<SystemAdvancedInput[]>([])
const relationSettings = ref<SystemRelationSetting[]>([])
const taskInputs = reactive<Record<string, Record<string, number>>>({})
const relationInputs = reactive<Record<string, { factor: number; offset: number }>>({})

const getInputType = (type: string) => {
  const normalized = type.toLowerCase()
  if (normalized.includes('int') || normalized.includes('float') || normalized.includes('number')) {
    return 'number'
  }
  return 'text'
}

const getDerivedValue = (relation: SystemRelationSetting) => {
  const sourceValue = Number(taskInputs[relation.sourceTaskId]?.[relation.sourceParameter] ?? 0)
  const factor = Number(relationInputs[relation.relationKey]?.factor ?? relation.factor)
  const offset = Number(relationInputs[relation.relationKey]?.offset ?? relation.offset)
  return (sourceValue * factor) + offset
}

const loadSystem = async () => {
  pending.value = true
  errorMessage.value = ''

  try {
    const data = await getSystemActions()
    things.value = data.things || []
    availableGoals.value = data.availableGoals || []
    directParameters.value = data.advancedSettings?.directParameters || []
    relationSettings.value = data.advancedSettings?.relationSettings || []

    for (const item of directParameters.value) {
      if (!taskInputs[item.taskId]) {
        taskInputs[item.taskId] = {}
      }
      taskInputs[item.taskId][item.parameterName] = Number(item.value)
    }

    for (const relation of relationSettings.value) {
      relationInputs[relation.relationKey] = {
        factor: Number(relation.factor),
        offset: Number(relation.offset)
      }
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Failed to load system'
  } finally {
    pending.value = false
  }
}

const runSystemGoal = async (goalId: string) => {
  try {
    executing.value = true
    await executeSystemGoal(goalId, {
      taskInputs,
      relationInputs
    })
  } catch (error: any) {
    console.error('Failed to execute system goal:', error)
    alert(error?.data?.statusMessage || 'Khong the thuc hien system goal')
  } finally {
    executing.value = false
  }
}

await loadSystem()
</script>