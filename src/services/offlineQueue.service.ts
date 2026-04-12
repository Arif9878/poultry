import type { DailyLog, DailyLogInput, PendingDailyLog } from '../types/models'

const QUEUE_KEY = 'poultry-offline-log-queue-v1'

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function listPendingDailyLogs() {
  const raw = localStorage.getItem(QUEUE_KEY)
  if (!raw) {
    return [] as PendingDailyLog[]
  }

  return JSON.parse(raw) as PendingDailyLog[]
}

function writePendingDailyLogs(logs: PendingDailyLog[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(logs))
}

export function enqueuePendingDailyLog(input: {
  flockId: string
  form: DailyLogInput
  createdBy: string
}) {
  const now = new Date().toISOString()
  const pendingLog: PendingDailyLog = {
    id: generateId('pending-log'),
    flock_id: input.flockId,
    client_request_id: crypto.randomUUID(),
    log_date: input.form.log_date,
    feed_used_kg: input.form.feed_used_kg ?? 0,
    feed_price_per_kg_rp: input.form.feed_price_per_kg_rp ?? 0,
    mortality_count: input.form.mortality_count ?? 0,
    live_population: input.form.live_population ?? 0,
    egg_count: input.form.egg_count,
    egg_price_per_kg_rp: input.form.egg_price_per_kg_rp ?? 0,
    egg_weight_per_egg_kg: input.form.egg_weight_per_egg_kg ?? 0.06,
    avg_weight_gram: input.form.avg_weight_gram,
    sample_count: input.form.sample_count,
    notes: input.form.notes.trim() ? input.form.notes.trim() : null,
    created_by: input.createdBy,
    created_at: now,
    updated_at: now,
  }

  const logs = [pendingLog, ...listPendingDailyLogs()]
  writePendingDailyLogs(logs)
  return pendingLog
}

export function removePendingDailyLog(clientRequestId: string) {
  const nextLogs = listPendingDailyLogs().filter(
    (log) => log.client_request_id !== clientRequestId,
  )
  writePendingDailyLogs(nextLogs)
}

export function countPendingDailyLogs() {
  return listPendingDailyLogs().length
}

export function toDailyLog(log: PendingDailyLog): DailyLog {
  return {
    ...log,
    sync_status: 'pending',
  }
}
