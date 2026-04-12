import type { FlockType } from '../types/models'

export function getFlockAgeInDays(startDate: string, referenceDate = new Date()) {
  const start = new Date(startDate)
  const diffMs = referenceDate.getTime() - start.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function getFlockTypeLabel(flockType: FlockType) {
  return flockType === 'layer' ? 'Layer' : 'Broiler'
}
