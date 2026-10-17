// Personal maintenance (TDEE) learned from the user's own diary and weight trend.
//
// Each of the last few full weeks gives an observed burn: average intake on logged days minus the change
// in trend weight turned into kcal (7700 kcal/kg). Weeks that are implausible or far from the others are
// flagged and left out, so one strange week doesn't move the baseline. The rest are blended with the
// formula estimate (the prior); the more good weeks, the more weight they get.
import { addDays } from './dates'
import { eaten, mealsOn } from './model'
import { trendOn, type WeighIn } from './weight'
import type { Meal } from '../types'

export const KCAL_PER_KG = 7700

/** Full weeks looked at, counting back from yesterday (today isn't over yet). */
const WEEKS = 4
/** A week needs food logged on this many days to say anything about intake. */
const MIN_LOGGED_DAYS = 4
/**
 * A day with less than this share of the formula logged is most likely incomplete (a forgotten meal),
 * not what was eaten. Counting it would pull maintenance down and the plan with it, so it is skipped.
 */
const INCOMPLETE_DAY = 0.5
/** Most weight the observed burn ever gets: the formula always keeps a say. */
const MAX_ALPHA = 0.8
/** A week this far from the formula (as a fraction of it) is not a believable burn. */
const IMPLAUSIBLE = 0.35
/** With three or more weeks, one this far from their median (as a fraction of the formula) is an outlier. */
const OUTLIER = 0.2
/** Formula estimates are typically within about 10% of a person's real burn. */
const FORMULA_ERROR = 0.1
/** Even with plenty of data, logging and the 7700 kcal/kg rule leave some uncertainty. */
const LEARNED_ERROR = 0.05

export interface WeekObservation {
  /** First and last day of the week, as YYYY-MM-DD. */
  from: string
  to: string
  /** Days with a complete-looking food log, as YYYY-MM-DD. */
  days: string[]
  loggedDays: number
  /** Average kcal eaten on logged days. */
  intake: number
  /** Change in trend weight across the week, in kg. */
  weightChange: number
  /** Observed burn: intake minus the energy stored or released as weight. */
  observed: number
  /** Left out of the estimate. */
  anomaly: boolean
}

export interface MaintenanceEstimate {
  /** Best estimate, kcal a day. */
  kcal: number
  /** Likely range, kcal a day. */
  low: number
  high: number
  /** The formula estimate it started from. */
  formula: number
  /** Share of the estimate that comes from the user's own data, 0 to MAX_ALPHA. */
  alpha: number
  /** Weeks used in the estimate. */
  goodWeeks: number
  /** Weeks with enough data but left out as unusual. */
  unusualWeeks: number
  confidence: 'low' | 'medium' | 'high'
}

const r10 = (x: number) => Math.round(x / 10) * 10

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Observed burn for each of the last full weeks with enough data, newest first, unusual ones flagged. */
export function weekObservations(meals: Meal[], weighIns: WeighIn[], today: string, formula: number): WeekObservation[] {
  const weeks: WeekObservation[] = []
  for (let k = 0; k < WEEKS; k++) {
    const to = addDays(today, -1 - 7 * k)
    const from = addDays(to, -6)
    // Trend at the end of the week before against the end of this one: seven days of change.
    const start = trendOn(weighIns, addDays(from, -1))
    const end = trendOn(weighIns, to)
    if (start == null || end == null) continue
    const days: string[] = []
    let total = 0
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const kcal = eaten(mealsOn(meals, d))
      if (kcal < formula * INCOMPLETE_DAY) continue
      days.push(d)
      total += kcal
    }
    if (days.length < MIN_LOGGED_DAYS) continue
    const intake = total / days.length
    const weightChange = end - start
    const observed = intake - (weightChange * KCAL_PER_KG) / 7
    weeks.push({ from, to, days, loggedDays: days.length, intake, weightChange, observed, anomaly: false })
  }

  for (const w of weeks) if (Math.abs(w.observed - formula) > formula * IMPLAUSIBLE) w.anomaly = true
  const plausible = weeks.filter((w) => !w.anomaly)
  if (plausible.length >= 3) {
    const typical = median(plausible.map((w) => w.observed))
    for (const w of plausible) if (Math.abs(w.observed - typical) > formula * OUTLIER) w.anomaly = true
  }
  return weeks
}

/** Maintenance from the formula, moved towards what the diary and weight trend show. */
export function learnMaintenance(meals: Meal[], weighIns: WeighIn[], today: string, formula: number): MaintenanceEstimate {
  const weeks = weekObservations(meals, weighIns, today, formula)
  const good = weeks.filter((w) => !w.anomaly)
  const alpha = (MAX_ALPHA * good.length) / WEEKS
  const observed = good.length ? good.reduce((a, w) => a + w.observed, 0) / good.length : formula
  const kcal = r10((1 - alpha) * formula + alpha * observed)
  // The range narrows from the formula's ±10% towards ±5% as the user's own data takes over.
  const error = FORMULA_ERROR - ((FORMULA_ERROR - LEARNED_ERROR) * alpha) / MAX_ALPHA
  return {
    kcal,
    low: r10(kcal * (1 - error)),
    high: r10(kcal * (1 + error)),
    formula,
    alpha,
    goodWeeks: good.length,
    unusualWeeks: weeks.length - good.length,
    confidence: good.length >= 3 ? 'high' : good.length >= 1 ? 'medium' : 'low',
  }
}

// ---- Expected vs actual ----------------------------------------------------

/** A difference in trend weight this small per week is within water and logging noise. */
const NOISE_KG_PER_WEEK = 0.15

export interface ExpectedVsActual {
  /** Weeks compared, each with enough food logged and weigh-ins around it. */
  weeks: number
  /** First day of the oldest week compared, as YYYY-MM-DD. */
  from: string
  /** Change in kg the food diary predicts against the burn estimate. */
  expected: number
  /** Change in trend weight over the same weeks, in kg. */
  actual: number
  /** How the actual change compares, beyond day-to-day noise. */
  verdict: 'as-expected' | 'lower' | 'higher'
}

/**
 * What the food diary predicts for weight, against what the trend did, over the same weeks as the
 * maintenance estimate. Unusual weeks count here too: it compares, it doesn't learn.
 */
export function expectedVsActual(
  meals: Meal[],
  weighIns: WeighIn[],
  today: string,
  formula: number,
  burnOn: (date: string) => number,
): ExpectedVsActual | null {
  const weeks = weekObservations(meals, weighIns, today, formula)
  if (!weeks.length) return null
  let expected = 0
  let actual = 0
  for (const w of weeks) {
    const balance = w.days.reduce((a, d) => a + eaten(mealsOn(meals, d)) - burnOn(d), 0) / w.days.length
    expected += (balance * 7) / KCAL_PER_KG
    actual += w.weightChange
  }
  const noise = NOISE_KG_PER_WEEK * weeks.length
  const diff = actual - expected
  return {
    weeks: weeks.length,
    from: weeks[weeks.length - 1].from,
    expected,
    actual,
    verdict: Math.abs(diff) <= noise ? 'as-expected' : diff < 0 ? 'lower' : 'higher',
  }
}
