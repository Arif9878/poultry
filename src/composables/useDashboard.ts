import { reactive, toRefs, watch } from 'vue'
import { listAccessibleFarms } from '../services/farms.service'
import { listFlocksByFarm } from '../services/flocks.service'
import { getFarmDashboardSummary, getFarmTrend } from '../services/dashboard.service'
import { getTodayDate } from '../utils/formatDate'
import type { DashboardSummary, DashboardTrendPoint, Farm, Flock } from '../types/models'

const emptySummary: DashboardSummary = {
  currentPopulation: 0,
  totalMortality: 0,
  totalFeedUsedKg: 0,
  averageDailyFeedUsageKg: 0,
  averageFeedPerBirdKg: null,
  eggProduction: 0,
  latestAvgWeightGram: null,
  activeFlockCount: 0,
  pendingSyncCount: 0,
  totalEggWeightKg: 0,
  averageHdPercent: 0,
  averageFcr: null,
  totalProfitRp: 0,
  lastFeedStockKg: 0,
  estimatedFeedStockDays: null,
  targetHdPercent: null,
  maxFcr: null,
  safetyStockDays: null,
  feedStockStatus: 'aman',
  hdBelowTarget: false,
  fcrAboveLimit: false,
  feedBelowSafetyStock: false,
}

export function useDashboard() {
  const state = reactive({
    farms: [] as Farm[],
    selectedFarmId: localStorage.getItem('selectedFarmId') ?? '',
    selectedDate: getTodayDate(),
    summary: emptySummary,
    activeFlocks: [] as Flock[],
    trend: [] as DashboardTrendPoint[],
    loading: false,
    error: '',
  })

  async function loadDashboard() {
    state.loading = true
    state.error = ''

    try {
      state.farms = await listAccessibleFarms()

      if (!state.selectedFarmId && state.farms[0]) {
        state.selectedFarmId = state.farms[0].id
      }

      if (state.selectedFarmId) {
        await refreshSummary()
      }
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat dashboard'
    } finally {
      state.loading = false
    }
  }

  async function refreshSummary() {
    if (!state.selectedFarmId) {
      state.summary = emptySummary
      state.activeFlocks = []
      return
    }

    state.loading = true
    state.error = ''

    try {
      const [summary, flocks, trend] = await Promise.all([
        getFarmDashboardSummary(state.selectedFarmId, state.selectedDate),
        listFlocksByFarm(state.selectedFarmId, 'active'),
        getFarmTrend(state.selectedFarmId, 7, state.selectedDate),
      ])

      state.summary = summary
      state.activeFlocks = flocks
      state.trend = trend
      localStorage.setItem('selectedFarmId', state.selectedFarmId)
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat ringkasan farm'
    } finally {
      state.loading = false
    }
  }

  watch(
    () => [state.selectedFarmId, state.selectedDate],
    () => {
      if (state.selectedFarmId) {
        void refreshSummary()
      }
    },
  )

  return {
    ...toRefs(state),
    loadDashboard,
    refreshSummary,
  }
}
