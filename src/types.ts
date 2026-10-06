import type { Activity as ActivityInput, Burn } from './lib/activity'
import type { Shortcut } from './lib/activityLabels'

export interface Food {
  name: string
  portion: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface CatalogFood extends Food {
  keywords: string[]
  /** Weight of one portion, in g, or ml for drinks. */
  grams: number
  unit: 'g' | 'ml'
}

export interface Favorite extends Food {
  id: string
}

export interface Meal extends Food {
  id: string
  /** Local day, as YYYY-MM-DD. */
  date: string
  time: string
}

export interface ActivityEntry {
  id: string
  /** Local day, as YYYY-MM-DD. */
  date: string
  time: string
  input: ActivityInput
  /** Calculated when logged, with the weight at that time. */
  burn: Burn
}

export type MacroKey = 'protein' | 'fat' | 'carbs' | 'fiber'
export type Targets = Record<MacroKey, number>

export type GoalType = 'cut' | 'maintain' | 'gain'
export type Pace = 'gentle' | 'steady'
export interface Goal {
  type: GoalType
  pace: Pace
}

export type Sex = 'female' | 'male'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active'
export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  activity: Activity
}

export type Period = 'week' | 'month' | 'year' | 'all'
export type View = 'today' | 'fuel' | 'burn' | 'trends'
export type SheetName = 'add' | 'share' | 'activity' | 'goal' | 'profile' | 'newfav' | 'favs' | 'targets' | 'weight' | 'snacks'

export type PortionSize = 'S' | 'M' | 'L'
export interface KnownItem {
  food: Food
  /** Number of catalog portions (fractional when an amount is given). */
  qty: number
  size: PortionSize
  /** Set when the text gave a weight or volume ("200 g"); then size doesn't apply. */
  amount?: { value: number; unit: 'g' | 'ml' }
  /** Grams (or ml) in one unit of qty, so an amount can be edited. */
  portionGrams?: number
}
export interface UnknownItem {
  unknown: true
  raw: string
  /** The words left once numbers, units and sizes are removed: what to search the database for. */
  query: string
  /** Grams or ml, when the text gave them. */
  amount?: number
}
export type DraftItem = KnownItem | UnknownItem

export interface AppState {
  view: View
  /** null until onboarding is finished. */
  profile: Profile | null
  period: Period
  goal: Goal
  numbers: boolean
  targets: Targets
  /** Latest weigh-in, in kg. */
  weight: number
  /** Weigh-ins by day (YYYY-MM-DD), in kg. */
  weighIns: Record<string, number>
  /** Optional body-fat readings by day (YYYY-MM-DD), in %. */
  bodyFat: Record<string, number>
  meals: Meal[]
  activities: ActivityEntry[]
  /** The four buttons at the top of "Add activity", chosen by the user. */
  activityShortcuts: Shortcut[]
  favs: Favorite[]
  dismissed: Record<string, boolean>
}
