export function formatDate(value: string | null | undefined, fallback = '-') {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}
