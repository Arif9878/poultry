import { reactive, toRefs, watch } from 'vue'
import { listDailyLogHistory } from '../services/dailyLogs.service'
import { listAccessibleFarms } from '../services/farms.service'
import { listFlocksByFarm } from '../services/flocks.service'
import type { DailyLog } from '../types/models'
import { getTodayDate } from '../utils/formatDate'

export function useHistory() {
  const state = reactive({
    farms: [] as Array<{ id: string; name: string }>,
    flocks: [] as Array<{ id: string; name: string }>,
    farmId: '',
    flockId: '',
    startDate: '',
    endDate: getTodayDate(),
    logs: [] as DailyLog[],
    loading: false,
    error: '',
  })

  async function loadHistory() {
    state.loading = true
    state.error = ''

    try {
      state.logs = await listDailyLogHistory({
        farmId: state.farmId || undefined,
        flockId: state.flockId || undefined,
        startDate: state.startDate || undefined,
        endDate: state.endDate || undefined,
      })
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat riwayat log'
    } finally {
      state.loading = false
    }
  }

  async function loadFilters() {
    state.farms = await listAccessibleFarms()

    if (state.farmId) {
      state.flocks = await listFlocksByFarm(state.farmId, 'all')
    } else {
      state.flocks = []
    }
  }

  watch(
    () => state.farmId,
    () => {
      state.flockId = ''
      void loadFilters()
    },
  )

  watch(
    () => [state.farmId, state.flockId, state.startDate, state.endDate],
    () => {
      void loadHistory()
    },
  )

  return {
    ...toRefs(state),
    loadHistory,
    loadFilters,
  }
}
