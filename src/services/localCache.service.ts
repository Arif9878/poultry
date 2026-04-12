const CACHE_PREFIX = 'poultry-supabase-cache-v1'

function getKey(key: string) {
  return `${CACHE_PREFIX}:${key}`
}

export function readCache<T>(key: string) {
  const raw = localStorage.getItem(getKey(key))
  if (!raw) {
    return null
  }

  return JSON.parse(raw) as T
}

export function writeCache<T>(key: string, value: T) {
  localStorage.setItem(getKey(key), JSON.stringify(value))
}

export function clearCache(prefix?: string) {
  const scopedPrefix = prefix ? getKey(prefix) : CACHE_PREFIX

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith(scopedPrefix)) {
      localStorage.removeItem(key)
    }
  }
}

export async function withCache<T>(key: string, fetcher: () => Promise<T>) {
  try {
    const value = await fetcher()
    writeCache(key, value)
    return value
  } catch (error) {
    const cached = readCache<T>(key)
    if (cached !== null) {
      return cached
    }

    throw error
  }
}
