// Days are identified by a local-time "YYYY-MM-DD" key, which also sorts correctly as a string.
import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayKey = () => dateKey(new Date())

export function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number) {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

/** The Monday of the week containing the given day. */
export function weekStart(key: string) {
  return addDays(key, -((parseKey(key).getDay() + 6) % 7))
}

/** First day of the month `months` away from the given day's month. */
export function monthStart(key: string, months = 0) {
  const d = parseKey(key)
  return new Date(d.getFullYear(), d.getMonth() + months, 1)
}

const format = (d: Date, options: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', options)

export const longLabel = (key: string) => format(parseKey(key), { weekday: 'long', month: 'long', day: 'numeric' })
export const weekdayLong = (key: string) => format(parseKey(key), { weekday: 'long' })
export const weekdayShort = (key: string) => format(parseKey(key), { weekday: 'short' })
export const monthDay = (key: string) => format(parseKey(key), { month: 'short', day: 'numeric' })
export const monthShort = (d: Date) => format(d, { month: 'short' })
export const monthYear = (d: Date) => format(d, { month: 'long', year: 'numeric' })

/** Today's key, kept current when midnight passes or the app comes back to the foreground. */
export function useToday() {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const check = () => setToday(todayKey())
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
