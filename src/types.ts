import type { Activity as ActivityInput, Burn } from './lib/activity'

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
}

export interface Favorite extends Food {
  id: number
}

export interface Meal extends Food {
  id: number
  /** Local day, as YYYY-MM-DD. */
  date: string
  time: string
}

export interface ActivityEntry {
  id: number
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
export type SheetName = 'add' | 'activity' | 'goal' | 'profile' | 'newfav' | 'favs' | 'targets' | 'weight' | 'snacks'

export type PortionSize = 'S' | 'M' | 'L'
export interface KnownItem {
  food: Food
  qty: number
  size: PortionSize
}
export interface UnknownItem {
  unknown: true
  raw: string
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
  favs: Favorite[]
  dismissed: Record<string, boolean>
  nextId: number
}
