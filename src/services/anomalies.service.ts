import { assertSupabaseConfigured, supabase } from '../lib/supabase'
import type { AnomalyAlert } from '../types/models'
import { getFarmDashboardSummary } from './dashboard.service'
import { listFlocksByFarm } from './flocks.service'
import { listHealthTreatmentsByFarm } from './healthTreatments.service'

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function isoDateOffset(baseDate: string, offset: number) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function getDailyMortalityRate(mortalityCount: number, livePopulation: number) {
  const dailyStartPopulation = Number(mortalityCount ?? 0) + Number(livePopulation ?? 0)
  if (dailyStartPopulation <= 0) {
    return 0
  }

  return (Number(mortalityCount ?? 0) / dailyStartPopulation) * 100
}

function isLatestLogConsistentWithFlock(
  flock: { current_chicken_count: number; last_log_date: string | null },
  latestLog: { log_date: string; live_population: number },
) {
  if (!flock.last_log_date || flock.last_log_date !== latestLog.log_date) {
    return true
  }

  return Number(flock.current_chicken_count ?? 0) === Number(latestLog.live_population ?? 0)
}

export async function listAnomalyAlertsByFarm(farmId: string, selectedDate = getTodayDate()) {
  assertSupabaseConfigured()

  const [summary, flocks, treatments] = await Promise.all([
    getFarmDashboardSummary(farmId, selectedDate),
    listFlocksByFarm(farmId, 'active'),
    listHealthTreatmentsByFarm(farmId, 15),
  ])

  const alerts: AnomalyAlert[] = []

  if (summary.feedStockStatus === 'kritis') {
    alerts.push({
      id: `feed-critical:${farmId}:${selectedDate}`,
      farm_id: farmId,
      category: 'feed',
      severity: 'critical',
      title: 'Stok pakan kritis',
      description: 'Estimasi stok pakan sudah sangat rendah dan perlu pembelian segera.',
      action_label: 'Buka pakan',
      action_to: `/feed?farmId=${farmId}`,
    })
  } else if (summary.feedBelowSafetyStock) {
    alerts.push({
      id: `feed-warning:${farmId}:${selectedDate}`,
      farm_id: farmId,
      category: 'feed',
      severity: 'warning',
      title: 'Stok pakan di bawah safety stock',
      description: 'Konsumsi pakan mendekati batas aman berdasarkan histori pemakaian.',
      action_label: 'Lihat stok',
      action_to: `/feed?farmId=${farmId}`,
    })
  }

  if (summary.hdBelowTarget) {
    alerts.push({
      id: `hd:${farmId}:${selectedDate}`,
      farm_id: farmId,
      category: 'production',
      severity: 'warning',
      title: 'HD di bawah target',
      description: 'Produksi telur layer berada di bawah target harian peternakan.',
      action_label: 'Buka laporan telur',
      action_to: `/egg-report?farmId=${farmId}`,
    })
  }

  if (summary.fcrAboveLimit) {
    alerts.push({
      id: `fcr:${farmId}:${selectedDate}`,
      farm_id: farmId,
      category: 'production',
      severity: 'warning',
      title: 'FCR melewati batas',
      description: 'Efisiensi pakan layer menurun dan perlu investigasi kandang yang bermasalah.',
      action_label: 'Buka dashboard',
      action_to: `/dashboard`,
    })
  }

  const flockIds = flocks.map((flock) => flock.id)
  if (flockIds.length > 0) {
    const recentStartDate = isoDateOffset(selectedDate, -2)
    const { data, error } = await supabase
      .from('daily_logs')
      .select('flock_id, log_date, mortality_count, live_population, avg_weight_gram, sample_count')
      .in('flock_id', flockIds)
      .gte('log_date', recentStartDate)
      .lte('log_date', selectedDate)

    if (error) {
      throw error
    }

    const latestByFlock = new Map<
      string,
      {
        flock_id: string
        log_date: string
        mortality_count: number
        live_population: number
        avg_weight_gram: number | null
        sample_count: number | null
      }
    >()

    for (const row of data ?? []) {
      const existing = latestByFlock.get(row.flock_id)
      if (!existing || row.log_date > existing.log_date) {
        latestByFlock.set(row.flock_id, row)
      }
    }

    for (const flock of flocks) {
      const latestLog = latestByFlock.get(flock.id)
      if (!latestLog) {
        continue
      }

      if (!isLatestLogConsistentWithFlock(flock, latestLog)) {
        continue
      }

      const mortalityRate = getDailyMortalityRate(
        Number(latestLog.mortality_count ?? 0),
        Number(latestLog.live_population ?? 0),
      )

      if (mortalityRate >= 3) {
        alerts.push({
          id: `mortality:${flock.id}:${latestLog.log_date}`,
          farm_id: farmId,
          flock_id: flock.id,
          category: 'mortality',
          severity: mortalityRate >= 5 ? 'critical' : 'warning',
          title: `Ayam mati harian tinggi di ${flock.name}`,
          description: `Ayam mati harian ${mortalityRate.toFixed(1)}% pada log ${latestLog.log_date}.`,
          action_label: 'Buka kandang',
          action_to: `/flocks/${flock.id}`,
        })
      }

      if (
        flock.flock_type === 'broiler' &&
        (!latestLog.avg_weight_gram || !latestLog.sample_count || latestLog.sample_count <= 0)
      ) {
        alerts.push({
          id: `weight:${flock.id}:${latestLog.log_date}`,
          farm_id: farmId,
          flock_id: flock.id,
          category: 'weight',
          severity: 'info',
          title: `Data bobot belum lengkap di ${flock.name}`,
          description: 'Log broiler terbaru belum memiliki bobot rata-rata atau jumlah sampel.',
          action_label: 'Isi log',
          action_to: `/input?farmId=${farmId}&flockId=${flock.id}`,
        })
      }
    }
  }

  const today = getTodayDate()
  for (const treatment of treatments) {
    if (treatment.withdrawal_until && treatment.withdrawal_until >= today) {
      alerts.push({
        id: `treatment:${treatment.id}`,
        farm_id: farmId,
        flock_id: treatment.flock_id,
        category: 'treatment',
        severity: 'info',
        title: `Masa withdrawal aktif di ${treatment.flock?.name ?? 'kandang'}`,
        description: `${treatment.product_name} masih memiliki masa withdrawal sampai ${treatment.withdrawal_until}.`,
        action_label: 'Lihat treatment',
        action_to: `/treatments?farmId=${farmId}&flockId=${treatment.flock_id}`,
      })
    }
  }

  return alerts.sort((left, right) => {
    const weight = { critical: 0, warning: 1, info: 2 }
    return weight[left.severity] - weight[right.severity]
  })
}
