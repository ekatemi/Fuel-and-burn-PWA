// Sample data carried over from the prototype. Everything here stands in for
// what will later come from real logging and a watch sync.
import type { AppState, Favorite, Food } from '../types'

export const TODAY_LABEL = 'Thursday, September 24'
export const MAINT = 1870
export const TODAY_BURN = 1870
export const AVG_BURN = 1880

export const PAST = [
  { day: 'Mon', eaten: 1620, burn: 1990 },
  { day: 'Tue', eaten: 1980, burn: 1850 },
  { day: 'Wed', eaten: 1550, burn: 1840 },
]

// Average daily balance for the seven weeks before the current one.
export const OLD_WEEKS = [-310, -220, 150, -260, -40, -300, -280]
export const BODYFAT = [27.8, 27.6, 27.7, 27.3, 27.2, 26.9, 26.7, 26.5]

export const SEP_WEEKS: [string, number][] = [
  ['Sep 1', -300],
  ['Sep 8', -280],
  ['Sep 15', -210],
]
export const MONTHS: [string, number][] = [
  ['Jun', -50],
  ['Jul', 120],
  ['Aug', 80],
  ['Sep', -150],
  ['Oct', -220],
  ['Nov', -180],
  ['Dec', 160],
  ['Jan', -260],
  ['Feb', -240],
  ['Mar', -210],
  ['Apr', -90],
  ['May', -200],
  ['Jun', -230],
  ['Jul', 40],
  ['Aug', -190],
]

export const BURN_PARTS = [
  { key: 'bmr', name: 'Resting burn', note: 'keeps your body running', kcal: 1250 },
  { key: 'act', name: 'Daily activity', note: 'steps, chores, moving around', kcal: 440 },
  { key: 'sport', name: 'Workout', note: 'strength, 45 min', kcal: 180 },
]

export const SNACKS = [
  { name: 'Greek yogurt with berries', kcal: '~150 kcal', note: 'lots of protein' },
  { name: 'Apple with a few almonds', kcal: '~180 kcal', note: 'crunchy' },
  { name: 'Popcorn, air-popped', kcal: '~100 kcal a bowl', note: 'salty like chips' },
  { name: 'Cottage cheese', kcal: '~180 kcal', note: 'filling' },
]

// How often each food was logged before today, for "Often in your diary".
export const HISTORY: (Food & { count: number })[] = [
  { name: 'Oatmeal', portion: '1 bowl', kcal: 300, protein: 10, carbs: 50, fat: 6, fiber: 8, count: 9 },
  { name: 'Banana', portion: '1 medium', kcal: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, count: 7 },
  { name: 'Protein shake', portion: '1 scoop with milk', kcal: 205, protein: 30, carbs: 12, fat: 5, fiber: 0, count: 6 },
  { name: 'Apple', portion: '1 medium', kcal: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, count: 5 },
  { name: 'Grilled chicken salad', portion: '1 large bowl', kcal: 620, protein: 48, carbs: 22, fat: 34, fiber: 5, count: 4 },
  { name: 'Tortilla española', portion: '1 slice', kcal: 230, protein: 8, carbs: 15, fat: 15, fiber: 1, count: 3 },
  { name: 'Latte', portion: '1 cup', kcal: 130, protein: 7, carbs: 12, fat: 5, fiber: 0, count: 2 },
]

const defaultFavs = (): Favorite[] => [
  { id: 101, name: 'Coffee with milk', portion: '1 cup', kcal: 60, protein: 3, carbs: 5, fat: 3, fiber: 0 },
  { id: 102, name: 'Greek yogurt with chia', portion: '1 bowl', kcal: 220, protein: 17, carbs: 14, fat: 10, fiber: 6 },
  { id: 103, name: 'Croissant', portion: '1 piece', kcal: 230, protein: 5, carbs: 26, fat: 12, fiber: 1 },
]

export const freshState = (): AppState => ({
  view: 'today',
  period: 'week',
  goal: { type: 'cut', pace: 'gentle' },
  numbers: true,
  targets: { protein: 115, fat: 60, carbs: 140, fiber: 22 },
  weight: 55.4,
  favs: defaultFavs(),
  dismissed: {},
  nextId: 200,
  meals: [
    { id: 1, time: '08:40', name: 'Avocado toast with eggs', portion: '2 slices, 2 eggs', kcal: 480, protein: 24, carbs: 38, fat: 26, fiber: 8 },
    { id: 2, time: '13:15', name: 'Grilled chicken salad', portion: '1 large bowl', kcal: 620, protein: 48, carbs: 22, fat: 34, fiber: 5 },
    { id: 3, time: '17:30', name: 'Protein shake', portion: '1 scoop with milk', kcal: 205, protein: 30, carbs: 12, fat: 5, fiber: 0 },
    { id: 4, time: '17:30', name: 'Banana', portion: '1 medium', kcal: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 },
  ],
})
