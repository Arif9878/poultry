import { reactive, toRefs } from 'vue'
import { createDailyLog } from '../services/dailyLogs.service'
import type { DailyLogInput, Flock } from '../types/models'
import { getTodayDate } from '../utils/formatDate'
import { validateDailyLog } from '../utils/validators'

function buildInitialForm(flock: Flock): DailyLogInput {
  return {
    log_date: getTodayDate(),
    feed_used_kg: null,
    feed_price_per_kg_rp: null,
    mortality_count: 0,
    live_population: flock.current_chicken_count,
    egg_count: flock.flock_type === 'layer' ? 0 : null,
    egg_price_per_kg_rp: flock.flock_type === 'layer' ? flock.egg_price_per_kg_rp : null,
    egg_weight_per_egg_kg:
      flock.flock_type === 'layer' ? flock.egg_weight_per_egg_kg : null,
    avg_weight_gram: flock.flock_type === 'broiler' ? null : null,
    sample_count: flock.flock_type === 'broiler' ? null : null,
    notes: '',
  }
}

export function useDailyLogForm() {
  const state = reactive({
    form: {
      log_date: getTodayDate(),
      feed_used_kg: null,
      feed_price_per_kg_rp: null,
      mortality_count: 0,
      live_population: null,
      egg_count: null,
      egg_price_per_kg_rp: null,
      egg_weight_per_egg_kg: null,
      avg_weight_gram: null,
      sample_count: null,
      notes: '',
    } as DailyLogInput,
    errors: {} as Record<string, string>,
    submitting: false,
    submitError: '',
    successMessage: '',
  })

  function initializeForFlock(flock: Flock) {
    state.form = buildInitialForm(flock)
    state.errors = {}
    state.submitError = ''
    state.successMessage = ''
  }

  async function submit(flock: Flock) {
    state.errors = validateDailyLog(flock, state.form)
    state.submitError = ''
    state.successMessage = ''

    if (Object.keys(state.errors).length > 0) {
      return false
    }

    state.submitting = true

    try {
      const result = await createDailyLog(flock, state.form)
      state.successMessage =
        result.sync_status === 'pending'
          ? 'Log disimpan ke queue offline dan akan disinkronkan saat online'
          : 'Log harian berhasil disimpan'
      return true
    } catch (error) {
      console.error(error)
      state.submitError =
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan log harian'
      return false
    } finally {
      state.submitting = false
    }
  }

  return {
    ...toRefs(state),
    initializeForFlock,
    submit,
  }
}
