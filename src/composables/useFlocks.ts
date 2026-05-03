import { reactive, toRefs } from 'vue'
import {
  createFlock,
  getFlockById,
  getFlockKpis,
  getFlockTrend,
  getRecentLogsByFlockId,
} from '../services/flocks.service'
import type { DailyLog, Flock, FlockKpi } from '../types/models'

export function useFlocks() {
  const state = reactive({
    flock: null as Flock | null,
    recentLogs: [] as DailyLog[],
    trend: [] as DailyLog[],
    kpis: {
      mortalityRate: 0,
      feedPerBird: 0,
      henDayProduction: null,
      averageSampleWeight: null,
    } as FlockKpi,
    loading: false,
    error: '',
  })

  async function loadFlockDetail(flockId: string) {
    state.loading = true
    state.error = ''

    try {
      const [flock, recentLogs, trend, kpis] = await Promise.all([
        getFlockById(flockId),
        getRecentLogsByFlockId(flockId),
        getFlockTrend(flockId),
        getFlockKpis(flockId),
      ])

      state.flock = flock
      state.recentLogs = recentLogs
      state.trend = trend
      state.kpis = kpis
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat detail kandang'
    } finally {
      state.loading = false
    }
  }

  async function addFlock(input: {
    farmId: string
    houseId: string
    code: string
    name: string
    flockType: Flock['flock_type']
    startDate: string
    initialChickenCount: number
    strain: string
    sourceVendor: string
    eggPricePerKgRp: number
    eggWeightPerEggKg: number
    targetHdPercent: number
    maxFcr: number
    safetyStockDays: number
    notes: string
  }) {
    return createFlock(input)
  }

  return {
    ...toRefs(state),
    loadFlockDetail,
    addFlock,
  }
}
