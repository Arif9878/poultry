import type { DailyLogInput, Flock } from '../types/models'

export function requiredText(value: string, label: string) {
  if (!value.trim()) {
    return `${label} wajib diisi`
  }

  return null
}

export function nonNegativeNumber(value: number | null, label: string) {
  if (value === null || Number.isNaN(value)) {
    return `${label} wajib diisi`
  }

  if (value < 0) {
    return `${label} tidak boleh negatif`
  }

  return null
}

export function positiveNumber(value: number | null, label: string) {
  if (value === null || Number.isNaN(value)) {
    return `${label} wajib diisi`
  }

  if (value <= 0) {
    return `${label} harus lebih dari 0`
  }

  return null
}

export function validateDailyLog(
  flock: Flock,
  form: DailyLogInput,
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.log_date) {
    errors.log_date = 'Tanggal log wajib diisi'
  }

  const feedError = nonNegativeNumber(form.feed_used_kg, 'Pakan')
  if (feedError) {
    errors.feed_used_kg = feedError
  }

  const feedPriceError = nonNegativeNumber(form.feed_price_per_kg_rp, 'Harga pakan / kg')
  if (feedPriceError) {
    errors.feed_price_per_kg_rp = feedPriceError
  }

  const mortalityError = nonNegativeNumber(form.mortality_count, 'Ayam mati')
  if (mortalityError) {
    errors.mortality_count = mortalityError
  } else if ((form.mortality_count ?? 0) > flock.current_chicken_count) {
    errors.mortality_count = 'Ayam mati melebihi populasi saat ini'
  }

  const livePopulationError = nonNegativeNumber(form.live_population, 'Populasi hidup')
  if (livePopulationError) {
    errors.live_population = livePopulationError
  } else if ((form.live_population ?? 0) > flock.current_chicken_count) {
    errors.live_population = 'Populasi hidup melebihi populasi kandang saat ini'
  } else if ((form.live_population ?? 0) > flock.initial_chicken_count) {
    errors.live_population = 'Populasi hidup melebihi populasi awal'
  } else if ((form.live_population ?? 0) !== flock.current_chicken_count - (form.mortality_count ?? 0)) {
    errors.live_population = 'Populasi hidup harus sama dengan populasi saat ini dikurangi ayam mati'
  }

  if (flock.flock_type === 'layer') {
    const eggError = nonNegativeNumber(form.egg_count, 'Produksi telur')
    if (eggError) {
      errors.egg_count = eggError
    } else if ((form.egg_count ?? 0) > (form.live_population ?? 0)) {
      errors.egg_count = 'Produksi telur tidak boleh melebihi populasi hidup'
    }

    const eggPriceError = nonNegativeNumber(form.egg_price_per_kg_rp, 'Harga telur / kg')
    if (eggPriceError) {
      errors.egg_price_per_kg_rp = eggPriceError
    }

    const eggWeightError = positiveNumber(form.egg_weight_per_egg_kg, 'Berat telur per butir')
    if (eggWeightError) {
      errors.egg_weight_per_egg_kg = eggWeightError
    }
  }

  if (flock.flock_type === 'broiler') {
    const weightError = positiveNumber(form.avg_weight_gram, 'Bobot rata-rata')
    const sampleError = positiveNumber(form.sample_count, 'Jumlah sampel')

    if (weightError) {
      errors.avg_weight_gram = weightError
    }

    if (sampleError) {
      errors.sample_count = sampleError
    }
  }

  return errors
}
