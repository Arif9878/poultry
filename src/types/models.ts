export type UserRole = 'admin' | 'manager' | 'operator'
export type FlockType = 'broiler' | 'layer'
export type FlockStatus = 'active' | 'closed'
export type SyncStatus = 'synced' | 'pending'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface UserSession {
  user_id: string
  email: string
}

export interface Farm {
  id: string
  name: string
  location: string | null
  manager_name: string | null
  created_by: string
  created_at: string
  updated_at: string
  membershipRole?: UserRole
}

export interface House {
  id: string
  farm_id: string
  name: string
  capacity: number
  created_at: string
  updated_at: string
}

export interface Flock {
  id: string
  farm_id: string
  house_id: string
  code: string
  name: string
  house_name: string | null
  flock_type: FlockType
  start_date: string
  initial_chicken_count: number
  current_chicken_count: number
  strain: string | null
  source_vendor: string | null
  status: FlockStatus
  last_log_date: string | null
  egg_price_per_kg_rp: number
  egg_weight_per_egg_kg: number
  target_hd_percent: number
  max_fcr: number
  safety_stock_days: number
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface DailyLog {
  id: string
  flock_id: string
  client_request_id?: string
  log_date: string
  feed_used_kg: number
  feed_price_per_kg_rp: number
  mortality_count: number
  live_population: number
  egg_count: number | null
  egg_price_per_kg_rp: number
  egg_weight_per_egg_kg: number
  avg_weight_gram: number | null
  sample_count: number | null
  notes: string | null
  sync_status: SyncStatus
  created_by: string
  created_at: string
  updated_at: string
  flock?: Pick<Flock, 'id' | 'farm_id' | 'name' | 'code' | 'flock_type'>
}

export interface DashboardSummary {
  currentPopulation: number
  totalMortality: number
  totalFeedUsedKg: number
  averageDailyFeedUsageKg: number
  averageFeedPerBirdKg: number | null
  eggProduction: number
  latestAvgWeightGram: number | null
  activeFlockCount: number
  pendingSyncCount: number
  totalEggWeightKg: number
  averageHdPercent: number
  averageFcr: number | null
  totalProfitRp: number
  lastFeedStockKg: number
  estimatedFeedStockDays: number | null
  targetHdPercent: number | null
  maxFcr: number | null
  safetyStockDays: number | null
  feedStockStatus: FeedStockStatus
  hdBelowTarget: boolean
  fcrAboveLimit: boolean
  feedBelowSafetyStock: boolean
}

export interface DailyLogInput {
  log_date: string
  feed_used_kg: number | null
  feed_price_per_kg_rp: number | null
  mortality_count: number | null
  live_population: number | null
  egg_count: number | null
  egg_price_per_kg_rp: number | null
  egg_weight_per_egg_kg: number | null
  avg_weight_gram: number | null
  sample_count: number | null
  notes: string
}

export interface DashboardTrendPoint {
  date: string
  label: string
  feed_used_kg: number
  mortality_count: number
  egg_count: number
  egg_weight_kg: number
  profit_rp: number
}

export interface FlockKpi {
  mortalityRate: number
  feedPerBird: number
  henDayProduction: number | null
  averageSampleWeight: number | null
}

export interface PendingDailyLog {
  id: string
  flock_id: string
  client_request_id: string
  log_date: string
  feed_used_kg: number
  feed_price_per_kg_rp: number
  mortality_count: number
  live_population: number
  egg_count: number | null
  egg_price_per_kg_rp: number
  egg_weight_per_egg_kg: number
  avg_weight_gram: number | null
  sample_count: number | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type FeedTransactionType = 'in' | 'out' | 'adjustment'

export interface FeedItem {
  id: string
  farm_id: string
  name: string
  brand: string | null
  unit: string
  price_per_kg_rp: number
  current_stock_kg: number
  opening_stock_kg: number
  reorder_level_kg: number
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface FeedTransaction {
  id: string
  feed_item_id: string
  farm_id: string
  transaction_type: FeedTransactionType
  quantity_kg: number
  unit_cost: number | null
  transaction_date: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  feed_item?: Pick<FeedItem, 'id' | 'name' | 'brand' | 'unit'>
}

export type FeedStockStatus = 'aman' | 'warning' | 'kritis'

export interface FeedSummary {
  totalStockKg: number
  grossStockKg: number
  lowStockCount: number
  totalItems: number
  averageFeedPricePerKgRp: number
  totalUsedTodayKg: number
  averageDailyUsageKg: number
  averageFeedPerBirdKg: number | null
  estimatedStockDays: number | null
  stockStatus: FeedStockStatus
}

export interface FeedUsageHistoryRow {
  id: string
  flock_id: string
  flock_code: string
  flock_name: string
  log_date: string
  live_population: number
  feed_used_kg: number
  feed_per_bird_kg: number | null
  sync_status: SyncStatus
}

export interface EggReportRow {
  id: string
  log_date: string
  flock_id: string
  flock_code: string
  flock_name: string
  live_population: number
  egg_count: number
  feed_used_kg: number
  total_egg_weight_kg: number
  hen_day_percentage: number
  fcr: number | null
  egg_revenue_rp: number
  feed_cost_rp: number
  gross_profit_rp: number
  sync_status: SyncStatus
}

export interface EggReportSummary {
  totalEggs: number
  totalEggWeightKg: number
  averageHenDay: number
  averageFcr: number | null
  reportingFlocks: number
  totalFeedKg: number
  totalProfitRp: number
}
