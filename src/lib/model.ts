import { AVG_BURN, HISTORY, MAINT, MONTHS, PAST, SEP_WEEKS, TODAY_BURN } from '../data/demo'
import { FOODS } from '../data/foods'
import type {
  DraftItem,
  Favorite,
  Food,
  Goal,
  GoalType,
  KnownItem,
  MacroKey,
  Meal,
  Pace,
  Period,
  PortionSize,
} from '../types'

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
export const r10 = (x: number) => Math.round(x / 10) * 10
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

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

/** Average daily balance (eaten − burned) for the current week so far. */
export function weekBalance(meals: Meal[]) {
  const e = PAST.reduce((a, d) => a + d.eaten, 0) + eaten(meals)
  const b = PAST.reduce((a, d) => a + d.burn, 0) + TODAY_BURN
  return (e - b) / (PAST.length + 1)
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

const MIN_INTAKE = 1250

export function goalIntake(burn: number, goal: Goal): Range {
  const [lo, hi] = goalRange(goal)
  return [r10(Math.max(MIN_INTAKE, burn * (1 + lo))), r10(Math.max(MIN_INTAKE, burn * (1 + hi)))]
}

export function planKcal(goal: Goal) {
  const [a, b] = goalIntake(MAINT, goal)
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

export function status(balance: number, burn: number, goal: Goal): Status {
  const [lo, hi] = goalRange(goal)
  const balLo = burn * lo
  const balHi = burn * hi
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
  /** Average daily balance; null for days that haven't happened yet. */
  value: number | null
  live?: boolean
}

export interface PeriodData {
  title: string
  /** Replaces "this week" in status text. */
  phrase: string
  items: PeriodItem[]
  balance: number
  avgEaten: number
  avgBurn: number
  fatChange: string
  weightChange: string
  trendLabel: string
}

export function periodData(period: Period, meals: Meal[]): PeriodData {
  const week = weekBalance(meals)
  if (period === 'week') {
    const items: PeriodItem[] = [
      ...PAST.map((d) => ({ label: d.day, value: d.eaten - d.burn })),
      { label: 'Thu', value: eaten(meals) - TODAY_BURN, live: true },
      { label: 'Fri', value: null },
      { label: 'Sat', value: null },
      { label: 'Sun', value: null },
    ]
    const n = PAST.length + 1
    return {
      title: 'This week',
      phrase: 'this week',
      items,
      balance: week,
      avgEaten: (PAST.reduce((x, d) => x + d.eaten, 0) + eaten(meals)) / n,
      avgBurn: (PAST.reduce((x, d) => x + d.burn, 0) + TODAY_BURN) / n,
      fatChange: '−0.1 kg',
      weightChange: '−0.1 kg',
      trendLabel: 'this week',
    }
  }

  const monthItems: PeriodItem[] = [
    ...SEP_WEEKS.map(([label, value]) => ({ label, value })),
    { label: 'Sep 22', value: week, live: true },
  ]
  const monthBalance = avg(monthItems.map((i) => i.value ?? 0))
  const months: PeriodItem[] = [
    ...MONTHS.map(([label, value]) => ({ label, value })),
    { label: 'Sep', value: monthBalance, live: true },
  ]

  const base =
    period === 'month'
      ? { title: 'This month', phrase: 'this month', items: monthItems, fatChange: '−0.5 kg', weightChange: '−0.4 kg', trendLabel: 'this month' }
      : period === 'year'
        ? { title: 'Past 12 months', phrase: 'over the past year', items: months.slice(-12), fatChange: '−2.4 kg', weightChange: '−2.0 kg', trendLabel: 'past 12 months' }
        : { title: 'Since you started, June 2025', phrase: 'overall', items: months, fatChange: '−2.6 kg', weightChange: '−2.1 kg', trendLabel: 'since June 2025' }

  const balance = avg(base.items.map((i) => i.value ?? 0))
  return { ...base, balance, avgBurn: AVG_BURN, avgEaten: AVG_BURN + balance }
}

// ---- Logging food ----------------------------------------------------------

export const SIZE: Record<PortionSize, number> = { S: 0.7, M: 1, L: 1.4 }
export const SIZE_NAMES: Record<PortionSize, string> = { S: 'Small', M: 'Medium', L: 'Large' }
const WORD_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 }

export const isKnown = (item: DraftItem): item is KnownItem => !('unknown' in item)

export const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : q === 0.5 ? '½' : q.toFixed(1))
export const kcalOf = (item: KnownItem) => Math.round((item.food.kcal * SIZE[item.size] * item.qty) / 5) * 5

export function toMeal(item: KnownItem, id: number, time: string): Meal {
  const scale = SIZE[item.size] * item.qty
  const { food } = item
  return {
    id,
    time,
    name: (item.qty !== 1 ? fmtQty(item.qty) + ' × ' : '') + food.name,
    portion: { S: 'small, ', M: '', L: 'large, ' }[item.size] + food.portion,
    kcal: kcalOf(item),
    protein: Math.round(food.protein * scale),
    carbs: Math.round(food.carbs * scale),
    fat: Math.round(food.fat * scale),
    fiber: Math.round(food.fiber * scale),
  }
}

/** A keyword parser standing in for real food recognition. */
export function parseFoodText(text: string): DraftItem[] {
  const parts = text
    .toLowerCase()
    .split(/,|;|\+|\n|\band\b|\bwith\b|\by\b|\bcon\b/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: DraftItem[] = []
  for (const part of parts) {
    let qty = 1
    const num = part.match(/^(\d+(?:[.,]\d+)?)/)
    if (num) qty = parseFloat(num[1].replace(',', '.'))
    else qty = WORD_NUMBERS[part.split(/\s+/)[0]] ?? 1
    if (/\bhalf\b|\bmedia\b|½/.test(part)) qty *= 0.5

    let size: PortionSize = 'M'
    if (/\b(small|little|mini|pequeñ[oa])\b/.test(part)) size = 'S'
    else if (/\b(large|big|huge|double|grande)\b/.test(part)) size = 'L'

    let rest = part
    let found = false
    for (const food of FOODS) {
      const keyword = food.keywords.find((k) => rest.includes(k))
      if (keyword) {
        found = true
        out.push({ food, qty, size })
        rest = rest.replace(keyword, ' ')
      }
    }
    if (!found) out.push({ unknown: true, raw: part })
  }
  return out
}

export interface QuickEntry {
  source: 'fav' | 'freq'
  food: Food
}

/** Saved foods first, then the most frequently logged foods that aren't saved. */
export function quickList(favs: Favorite[], meals: Meal[]): QuickEntry[] {
  const favNames = new Set(favs.map((f) => f.name.toLowerCase()))
  const counts = new Map<string, { food: Food; count: number }>()
  for (const { count, ...food } of HISTORY) counts.set(food.name, { food, count })
  for (const { id: _id, time: _time, ...food } of meals) {
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
