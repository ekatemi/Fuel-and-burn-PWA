// Weight trend: raw weigh-ins → drop obvious anomalies → 7-day smoothing.
// Day-to-day scale readings swing by 0.5–1 kg with water and food, so only the trend is used.
import { addDays, parseKey } from './dates'

export interface WeighIn {
  date: string
  kg: number
  /** Far from the surrounding weigh-ins; shown, but left out of the trend. */
  anomaly: boolean
}

export interface TrendPoint {
  date: string
  /** Smoothed value (kg or %), or null when there is no reading in the window up to this day. */
  value: number | null
}

const SMOOTHING_DAYS = 7
const NEIGHBOUR_DAYS = 7
const MIN_NEIGHBOURS = 3

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const daysBetween = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000)

/** All weigh-ins, oldest first, with anomalies flagged against their neighbours. */
export function weighInList(weighIns: Record<string, number>): WeighIn[] {
  const list = Object.entries(weighIns)
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return list.map(({ date, kg }) => {
    const neighbours = list.filter((w) => w.date !== date && Math.abs(daysBetween(w.date, date)) <= NEIGHBOUR_DAYS)
    if (neighbours.length < MIN_NEIGHBOURS) return { date, kg, anomaly: false }
    const typical = median(neighbours.map((w) => w.kg))
    // More than 1.5 kg (or 2.5% for heavier people) from the neighbours is not a real change.
    return { date, kg, anomaly: Math.abs(kg - typical) > Math.max(1.5, typical * 0.025) }
  })
}

/** Smoothed weight for each day from `from` to `to`: the mean of good weigh-ins in the 7 days up to it. */
export function trendSeries(weighIns: WeighIn[], from: string, to: string): TrendPoint[] {
  const good = weighIns.filter((w) => !w.anomaly)
  const points: TrendPoint[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const windowStart = addDays(date, -(SMOOTHING_DAYS - 1))
    const inWindow = good.filter((w) => w.date >= windowStart && w.date <= date)
    points.push({ date, value: inWindow.length ? inWindow.reduce((a, w) => a + w.kg, 0) / inWindow.length : null })
  }
  return points
}

export function trendOn(weighIns: WeighIn[], date: string): number | null {
  return trendSeries(weighIns, date, date)[0].value
}

const MIN_SPAN_DAYS = 4

/** Change in trend weight across the series, or null when it covers too few days to mean anything. */
export function trendChange(series: TrendPoint[]): number | null {
  const known = series.filter((p): p is { date: string; value: number } => p.value != null)
  if (known.length < 2) return null
  const first = known[0]
  const last = known[known.length - 1]
  return daysBetween(first.date, last.date) >= MIN_SPAN_DAYS ? last.value - first.value : null
}

const round1 = (kg: number) => Math.round(kg * 10) / 10

/** "−0.4 kg", "+0.2 kg" or "±0.0 kg". */
export function formatChange(kg: number) {
  const rounded = round1(kg)
  return (rounded > 0 ? '+' : rounded < 0 ? '−' : '±') + Math.abs(rounded).toFixed(1) + ' kg'
}

/** Words for calm view, matching what formatChange shows. */
export function changeWords(kg: number) {
  const rounded = round1(kg)
  return rounded < 0 ? 'trending down' : rounded > 0 ? 'trending up' : 'holding steady'
}

// ---- Body fat --------------------------------------------------------------
// Readings are optional and usually sparse (and home scales are noisy), so they are smoothed
// over a longer window than weight.

const BODY_FAT_WINDOW_DAYS = 14

/** Smoothed body fat % for each day: the mean of readings in the 14 days up to it. */
export function bodyFatSeries(bodyFat: Record<string, number>, from: string, to: string): TrendPoint[] {
  const readings = Object.entries(bodyFat)
  const points: TrendPoint[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const windowStart = addDays(date, -(BODY_FAT_WINDOW_DAYS - 1))
    const inWindow = readings.filter(([d]) => d >= windowStart && d <= date).map(([, pct]) => pct)
    points.push({ date, value: inWindow.length ? inWindow.reduce((a, b) => a + b, 0) / inWindow.length : null })
  }
  return points
}

/** Readings needed before body fat is used in calculations, so one bad reading can't swing them. */
export const MIN_BODY_FAT_READINGS = 2

/**
 * Body fat % to use in calculations: the mean of readings in the 14 days up to the latest one,
 * and always of at least the last two. Null until two readings exist.
 */
export function currentBodyFat(bodyFat: Record<string, number>): number | null {
  const dates = Object.keys(bodyFat).sort()
  if (dates.length < MIN_BODY_FAT_READINGS) return null
  const windowStart = addDays(dates[dates.length - 1], -(BODY_FAT_WINDOW_DAYS - 1))
  const recent = dates.filter((d) => d >= windowStart)
  const used = recent.length >= MIN_BODY_FAT_READINGS ? recent : dates.slice(-MIN_BODY_FAT_READINGS)
  return used.reduce((a, d) => a + bodyFat[d], 0) / used.length
}
