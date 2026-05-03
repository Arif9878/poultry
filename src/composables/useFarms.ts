import { reactive, toRefs } from 'vue'
import {
  createFarm,
  createHouse,
  getFarmById,
  listAccessibleFarms,
  listHousesByFarm,
} from '../services/farms.service'
import { listFlocksByFarm } from '../services/flocks.service'
import type { Farm, Flock, House } from '../types/models'

export function useFarms() {
  const state = reactive({
    farms: [] as Farm[],
    farm: null as Farm | null,
    houses: [] as House[],
    flocks: [] as Flock[],
    loading: false,
    error: '',
  })

  async function loadFarms() {
    state.loading = true
    state.error = ''

    try {
      state.farms = await listAccessibleFarms()
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat daftar peternakan'
    } finally {
      state.loading = false
    }
  }

  async function loadFarmDetail(farmId: string) {
    state.loading = true
    state.error = ''

    try {
      const [farm, houses, flocks] = await Promise.all([
        getFarmById(farmId),
        listHousesByFarm(farmId),
        listFlocksByFarm(farmId, 'all'),
      ])

      state.farm = farm
      state.houses = houses
      state.flocks = flocks
    } catch (error) {
      console.error(error)
      state.error = 'Gagal memuat detail peternakan'
    } finally {
      state.loading = false
    }
  }

  async function addFarm(input: {
    name: string
    location: string
    managerName: string
  }) {
    await createFarm(input)
    await loadFarms()
  }

  async function addHouse(input: {
    farmId: string
    name: string
    capacity: number
  }) {
    await createHouse(input)
    await loadFarmDetail(input.farmId)
  }

  return {
    ...toRefs(state),
    loadFarms,
    loadFarmDetail,
    addFarm,
    addHouse,
  }
}
