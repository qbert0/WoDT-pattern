import { defineStore } from 'pinia'
import type { OverviewResponse } from '~/types/ditto'

interface DittoState {
  totalThings: number
  totalPolicies: number
  policies: { policyId: string; count: number }[]
  thingsByPolicy: Record<string, { id: string; policyId: string }[]>
  selectedPolicyId: string | null
  loadingOverview: boolean
}

export const useDittoStore = defineStore('ditto', {
  state: (): DittoState => ({
    totalThings: 0,
    totalPolicies: 0,
    policies: [],
    thingsByPolicy: {},
    selectedPolicyId: null,
    loadingOverview: false
  }),

  getters: {
    selectedPolicyThings: (state) => {
      if (!state.selectedPolicyId) return []
      return state.thingsByPolicy[state.selectedPolicyId] || []
    }
  },

  actions: {
    setOverview(data: OverviewResponse) {
      this.totalThings = data.totalThings
      this.totalPolicies = data.totalPolicies
      this.policies = data.policies
      this.thingsByPolicy = data.thingsByPolicy
      if (!this.selectedPolicyId && data.policies.length > 0) {
        if(data.policies[0] == null) return;
        this.selectedPolicyId = data.policies[0].policyId
      }
    },

    setSelectedPolicy(policyId: string) {
      this.selectedPolicyId = policyId
    }
  }
})