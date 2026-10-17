import { activityAdjustment, restingKcalPerDay } from './activity'
import { addDays, weekdayShort, weekStart } from './dates'
import type {
  ActivityEntry,
  DraftItem,
  Favorite,
  Food,
  Goal,
  GoalType,
  KnownItem,
  MacroKey,
  Meal,
  MealSlot,
  Pace,
  Period,
  PortionSize,
  Profile,
  Activity,
  Targets,
} from '../types'

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
export const r10 = (x: number) => Math.round(x / 10) * 10

export const nowTime = () => {
  const d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

export const MACROS: { key: MacroKey; icon: string; label: string }[] = [
  { key: 'protein', icon: '🥩', label: 'Protein' },
  { key: 'fat', icon: '🥑', label: 'Fat' },
  { key: 'carbs', icon: '🍚', label: 'Carbs' },
  { key: 'fiber', icon: '🌾', label: 'Fiber' },
]

export const eaten = (meals: Meal[]) => meals.reduce((a, m) => a + m.kcal, 0)
export const macroSum = (meals: Meal[], key: MacroKey) => meals.reduce((a, m) => a + m[key], 0)
export const mealsOn = (meals: Meal[], date: string) => meals.filter((m) => m.date === date)
export const activitiesOn = (activities: ActivityEntry[], date: string) => activities.filter((a) => a.date === date)
export const activityKcal = (activities: ActivityEntry[]) => activities.reduce((a, e) => a + e.burn.kcal, 0)

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const TYPICAL_WINDOW_DAYS = 14

/**
 * Logged activity on a typical day: the median over the previous 14 days that have anything
 * in the diary, counting days without logged activity as 0. 0 while there is no history.
 */
export function typicalActivityKcal(meals: Meal[], activities: ActivityEntry[], date: string) {
  const from = addDays(date, -TYPICAL_WINDOW_DAYS)
  const days = new Set(
    [...meals, ...activities].map((e) => e.date).filter((d) => d >= from && d < date),
  )
  return median([...days].map((d) => activityKcal(activitiesOn(activities, d))))
}

/** Burn for one day: maintenance plus how far that day's logged activity was from a typical day. */
export function dayBurn(maint: number, meals: Meal[], activities: ActivityEntry[], date: string) {
  const logged = activityKcal(activitiesOn(activities, date))
  return maint + activityAdjustment(logged, typicalActivityKcal(meals, activities, date))
}

// ---- Burn ------------------------------------------------------------------

export const ACTIVITY: Record<Activity, { name: string; desc: string; factor: number }> = {
  sedentary: { name: 'Mostly sitting', desc: 'Desk job, little exercise', factor: 1.2 },
  light: { name: 'Lightly active', desc: 'Light exercise 1–3 days a week', factor: 1.375 },
  moderate: { name: 'Moderately active', desc: 'Exercise 3–5 days a week', factor: 1.55 },
  active: { name: 'Very active', desc: 'Hard exercise 6–7 days a week', factor: 1.725 },
}

/** Resting energy use in kcal a day: Katch–McArdle when body fat is logged, otherwise Mifflin–St Jeor. */
export function restingBurn(profile: Profile, weightKg: number, bodyFatPct?: number | null) {
  return restingKcalPerDay({ ...profile, weightKg, bodyFatPct: bodyFatPct ?? undefined })
}

/** Estimated kcal burned on a typical day. */
export function maintenance(profile: Profile, weightKg: number, bodyFatPct?: number | null) {
  return r10(restingBurn(profile, weightKg, bodyFatPct) * ACTIVITY[profile.activity].factor)
}

const r5 = (x: number) => Math.round(x / 5) * 5

/** Starting macro targets: 2 g of protein per kg, 30% of energy from fat, the rest from carbs. */
export function suggestedTargets(weightKg: number, planKcal: number): Targets {
  const protein = r5(weightKg * 2)
  const fat = r5((planKcal * 0.3) / 9)
  return {
    protein,
    fat,
    carbs: Math.max(0, r5((planKcal - 4 * protein - 9 * fat) / 4)),
    fiber: Math.round((planKcal / 1000) * 14),
  }
}

// ---- Goals -----------------------------------------------------------------

type Range = [number, number]

// Paces are fractions of maintenance: [low, high] of the allowed balance.
export const GOALS: Record<GoalType, { name: string; desc: string; paces: { gentle: Range; steady?: Range } }> = {
  cut: {
    name: 'Lose fat',
    desc: 'Lose fat slowly and keep your muscle',
    paces: { gentle: [-0.15, -0.1], steady: [-0.2, -0.15] },
  },
  maintain: {
    name: 'Maintain',
    desc: 'Hold your weight and improve body composition',
    paces: { gentle: [-0.05, 0.05] },
  },
  gain: {
    name: 'Build muscle',
    desc: 'A small surplus plus strength training',
    paces: { gentle: [0.05, 0.1], steady: [0.1, 0.15] },
  },
}

export const PACE_NAMES: Record<Pace, string> = { gentle: 'Gentle', steady: 'Steady' }

export function goalRange(goal: Goal): Range {
  const paces = GOALS[goal.type].paces
  return paces[goal.pace] ?? paces.gentle
}

/** Never suggested below this, whatever the formulas say. */
const MIN_INTAKE = 1250

/**
 * The kcal-a-day range for a goal, never below `floor`: the person's estimated resting burn,
 * so even the steadiest pace never asks someone to eat less than their body uses at rest.
 */
export function goalIntake(burn: number, goal: Goal, floor = 0): Range {
  const [lo, hi] = goalRange(goal)
  const min = Math.max(MIN_INTAKE, floor)
  return [r10(Math.max(min, burn * (1 + lo))), r10(Math.max(min, burn * (1 + hi)))]
}

export function planKcal(goal: Goal, maint: number, floor = 0) {
  const [a, b] = goalIntake(maint, goal, floor)
  return (a + b) / 2
}

export function goalLabel(goal: Goal) {
  return GOALS[goal.type].name + (goal.type === 'maintain' ? '' : ' · ' + PACE_NAMES[goal.pace])
}

export type StatusKind = 'on' | 'big' | 'under' | 'over'
export interface Status {
  kind: StatusKind
  title: string
  text: string
}

export function status(balance: number, burn: number, goal: Goal, floor = 0): Status {
  // The goal range as a balance, raised with the intake range when the floor lifts it.
  const [intakeLo, intakeHi] = goalIntake(burn, goal, floor)
  const balLo = intakeLo - burn
  const balHi = intakeHi - burn
  if (balance >= balLo - 40 && balance <= balHi + 40) {
    return {
      kind: 'on',
      title: 'On target',
      text:
        goal.type === 'cut'
          ? 'Right on your chosen pace. Keep going as you are.'
          : goal.type === 'gain'
            ? 'A steady small surplus, just right for building muscle with training.'
            : 'Eating about what you burn. Protein and training do the rest.',
    }
  }
  if (balance < balLo) {
    if (goal.type !== 'gain' && balance < balLo - 150) {
      return {
        kind: 'big',
        title: 'More than planned',
        text: 'You’re eating quite a bit less than your goal. Eating closer to it helps you keep muscle and energy.',
      }
    }
    return {
      kind: 'under',
      title: goal.type === 'gain' ? 'Under your goal' : 'A bit under your goal',
      text:
        goal.type === 'gain'
          ? 'You’re eating a little less than your goal. Muscle grows best with a small, steady surplus.'
          : 'A little less than your goal. That’s fine; if you feel hungry or tired, eat a bit more.',
    }
  }
  return {
    kind: 'over',
    title:
      goal.type === 'cut'
        ? 'Lighter deficit than planned'
        : goal.type === 'gain'
          ? 'Above your goal'
          : 'A bit above maintenance',
    text: 'A little more than your goal. No need to make up for it; the average evens out over time.',
  }
}

// ---- Periods ---------------------------------------------------------------

export interface PeriodItem {
  label: string
  /** Set for single days. */
  date?: string
  /** Average daily balance; null when there is nothing to show (future or unlogged). */
  value: number | null
  live?: boolean
}

export interface WeekSummary {
  /** Monday to Sunday of the current week. */
  items: PeriodItem[]
  /** Finished days with something logged; today is not counted. */
  loggedDays: number
  balance: number
  avgEaten: number
  avgBurn: number
}

/**
 * The current week, averaged over the finished days that have something logged.
 * Today is left out of the average because it is still being logged.
 */
export function weekSummary(meals: Meal[], today: string, burnOn: (date: string) => number): WeekSummary {
  const start = weekStart(today)
  const items: PeriodItem[] = []
  let eatenSum = 0
  let burnSum = 0
  let loggedDays = 0
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i)
    const dayMeals = date <= today ? mealsOn(meals, date) : []
    const logged = dayMeals.length > 0
    if (logged && date < today) {
      eatenSum += eaten(dayMeals)
      burnSum += burnOn(date)
      loggedDays++
    }
    items.push({
      label: weekdayShort(date),
      date,
      value: logged ? eaten(dayMeals) - burnOn(date) : null,
      live: date === today,
    })
  }
  const avgEaten = loggedDays ? eatenSum / loggedDays : 0
  const avgBurn = loggedDays ? burnSum / loggedDays : burnOn(today)
  return { items, loggedDays, avgEaten, avgBurn, balance: loggedDays ? avgEaten - avgBurn : 0 }
}

export interface PeriodData {
  title: string
  /** Replaces "this week" in status text. */
  phrase: string
  items: PeriodItem[]
  /** True when the period has no logged days to average. */
  empty: boolean
  balance: number
  avgEaten: number
  avgBurn: number
  /** Today, still going: what was eaten so far against the day's plan, no balance shown. */
  soFar?: boolean
}

/**
 * Averages over the days from `from` to `to` with something logged; days without food are left out,
 * since an empty day is a day not logged, not a day without eating.
 */
export function rangeSummary(meals: Meal[], from: string, to: string, burnOn: (date: string) => number) {
  const eatenByDay = new Map<string, number>()
  for (const m of meals) if (m.date >= from && m.date <= to) eatenByDay.set(m.date, (eatenByDay.get(m.date) ?? 0) + m.kcal)
  let eatenSum = 0
  let burnSum = 0
  for (const [date, kcal] of eatenByDay) {
    eatenSum += kcal
    burnSum += burnOn(date)
  }
  const loggedDays = eatenByDay.size
  const avgEaten = loggedDays ? eatenSum / loggedDays : 0
  const avgBurn = loggedDays ? burnSum / loggedDays : 0
  return { loggedDays, avgEaten, avgBurn, balance: avgEaten - avgBurn }
}

export function periodData(
  period: Period,
  meals: Meal[],
  today: string,
  burnOn: (date: string) => number,
): PeriodData {
  if (period === 'today') {
    const eatenToday = eaten(mealsOn(meals, today))
    const burn = burnOn(today)
    return { title: 'So far today', phrase: 'today', items: [], empty: false, balance: eatenToday - burn, avgEaten: eatenToday, avgBurn: burn, soFar: true }
  }

  const week = weekSummary(meals, today, burnOn)
  if (period === 'week') {
    return {
      title: 'This week',
      phrase: 'this week',
      items: week.items,
      empty: week.loggedDays === 0,
      balance: week.balance,
      avgEaten: week.avgEaten,
      avgBurn: week.avgBurn,
    }
  }

  const base =
    period === 'month'
      ? { title: 'Past 30 days', phrase: 'over the past 30 days', days: 30 }
      : { title: 'Past 12 months', phrase: 'over the past year', days: 365 }
  const range = rangeSummary(meals, addDays(today, -base.days), addDays(today, -1), burnOn)
  return {
    title: base.title,
    phrase: base.phrase,
    items: [],
    empty: range.loggedDays === 0,
    balance: range.balance,
    avgEaten: range.avgEaten,
    avgBurn: range.loggedDays ? range.avgBurn : burnOn(today),
  }
}

// ---- Logging food ----------------------------------------------------------

export const SIZE: Record<PortionSize, number> = { S: 0.7, M: 1, L: 1.4 }
export const SIZE_NAMES: Record<PortionSize, string> = { S: 'Small', M: 'Medium', L: 'Large' }

export const isKnown = (item: DraftItem): item is KnownItem => !('unknown' in item)

export const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : q === 0.5 ? '½' : q.toFixed(1))
export const fmtAmount = ({ value, unit }: { value: number; unit: string }) => `${Math.round(value)} ${unit}`
export const kcalOf = (item: KnownItem) => Math.round((item.food.kcal * SIZE[item.size] * item.qty) / 5) * 5
/** One item above this is almost certainly a typo in the amount. */
export const SUSPICIOUS_KCAL = 2000

// ---- Dishes ----------------------------------------------------------------
// AI splits a dish into ingredients to look each up; the diary logs the dish, as the person named it.

export interface ItemGroup {
  /** Set for a dish's ingredients, which are logged as one entry. */
  dish?: string
  /** Positions in the item list. */
  indices: number[]
}

/** Items in order, with the ingredients of each dish (which sit next to each other) in one group. */
export function groupItems(items: DraftItem[]): ItemGroup[] {
  const groups: ItemGroup[] = []
  items.forEach((item, i) => {
    const last = groups.at(-1)
    if (item.dish && last?.dish === item.dish) last.indices.push(i)
    else groups.push({ dish: item.dish, indices: [i] })
  })
  return groups
}

type Nutrient = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'

/** One dish from its ingredients: their total weight and nutrition under the dish's name. */
export function combineDish(name: string, parts: KnownItem[]): KnownItem {
  const sum = (key: Nutrient) => parts.reduce((a, p) => a + p.food[key] * SIZE[p.size] * p.qty, 0)
  const grams = parts.every((p) => p.amount?.unit === 'g') ? parts.reduce((a, p) => a + p.amount!.value, 0) : 0
  return {
    food: {
      name,
      portion: grams ? `${Math.round(grams)} g` : '1 portion',
      kcal: sum('kcal'),
      protein: sum('protein'),
      carbs: sum('carbs'),
      fat: sum('fat'),
      fiber: sum('fiber'),
    },
    qty: 1,
    size: 'M',
  }
}

/** Dishes with an ingredient still to be matched: logging them now would leave its calories out. */
export function unmatchedDishes(items: DraftItem[]): string[] {
  return groupItems(items).flatMap(({ dish, indices }) => (dish && indices.some((i) => !isKnown(items[i])) ? [dish] : []))
}

/** What goes into the diary: each dish as one entry, other items as they are. Unmatched ingredients are left out. */
export function itemsToLog(items: DraftItem[]): KnownItem[] {
  return groupItems(items).flatMap(({ dish, indices }) => {
    const known = indices.map((i) => items[i]).filter(isKnown)
    if (!known.length) return []
    return dish ? [combineDish(dish, known)] : known
  })
}

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'snack', 'lunch', 'dinner']
export const SLOT_NAMES: Record<MealSlot, string> = { breakfast: 'Breakfast', snack: 'Snack', lunch: 'Lunch', dinner: 'Dinner' }

/** The usual meal at a time of day (HH:MM), used as the default and for entries from before slots. */
export function slotForTime(time: string): MealSlot {
  if (time < '05:00') return 'snack'
  if (time < '11:00') return 'breakfast'
  if (time < '12:30') return 'snack'
  if (time < '16:00') return 'lunch'
  if (time < '19:00') return 'snack'
  return 'dinner'
}

export function toMeal(item: KnownItem, id: string, date: string, time: string, slot: MealSlot): Meal {
  const scale = SIZE[item.size] * item.qty
  const { food } = item
  return {
    id,
    date,
    time,
    slot,
    name: (item.qty !== 1 && !item.amount ? fmtQty(item.qty) + ' × ' : '') + food.name,
    portion: item.amount ? fmtAmount(item.amount) : { S: 'small, ', M: '', L: 'large, ' }[item.size] + food.portion,
    kcal: kcalOf(item),
    protein: Math.round(food.protein * scale),
    carbs: Math.round(food.carbs * scale),
    fat: Math.round(food.fat * scale),
    fiber: Math.round(food.fiber * scale),
  }
}

export interface QuickEntry {
  source: 'fav' | 'freq'
  food: Food
}

/** Saved foods first, then the most frequently logged foods that aren't saved. */
export function quickList(favs: Favorite[], meals: Meal[]): QuickEntry[] {
  const favNames = new Set(favs.map((f) => f.name.toLowerCase()))
  const counts = new Map<string, { food: Food; count: number }>()
  for (const { id: _id, date: _date, time: _time, slot: _slot, ...food } of meals) {
    const entry = counts.get(food.name)
    if (entry) entry.count++
    else counts.set(food.name, { food, count: 1 })
  }
  const frequent = [...counts.values()]
    .filter((x) => x.count >= 2 && !favNames.has(x.food.name.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  return [
    ...favs.map((food): QuickEntry => ({ source: 'fav', food })),
    ...frequent.map(({ food }): QuickEntry => ({ source: 'freq', food })),
  ]
}
