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
  /** The whole food this is a part of (a yolk of an egg): when the part is named, the whole isn't counted too. */
  partOf?: string
}

/** A packaged food as its label gives it, per 100 g (or 100 ml for drinks). */
export interface Product {
  name: string
  unit: 'g' | 'ml'
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** null when the label doesn't give it. */
  fiber: number | null
  /** One serving as printed, in g or ml, if given. */
  serving: number | null
}

export interface Favorite extends Food {
  id: string
}

export type MealSlot = 'breakfast' | 'snack' | 'lunch' | 'dinner'

export interface Meal extends Food {
  id: string
  /** Local day, as YYYY-MM-DD. */
  date: string
  time: string
  slot: MealSlot
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

export type Period = 'today' | 'week' | 'month' | 'year'
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
  /** The dish this is an ingredient of, as the person named it; the diary logs the dish as one entry. */
  dish?: string
}
export interface UnknownItem {
  unknown: true
  raw: string
  /** The words left once numbers, units and sizes are removed: what to search the database for. */
  query: string
  /** Grams or ml, when the text gave them. */
  amount?: number
  dish?: string
}
export type DraftItem = KnownItem | UnknownItem

/** When the person confirmed they are 18 or over and agreed to their health data being kept on the device. */
export interface Consent {
  /** ISO timestamp. */
  at: string
}

export interface AppState {
  view: View
  /** null until onboarding is finished. */
  profile: Profile | null
  /** null until given; the app asks for it before anything else. */
  consent: Consent | null
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
  /** When a backup was last exported, as an ISO timestamp; null if never. */
  lastBackupAt: string | null
  /** Packaged foods read from their label, by barcode, for products Open Food Facts doesn't have. */
  products: Record<string, Product>
}
