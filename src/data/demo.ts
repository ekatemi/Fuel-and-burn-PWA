// Sample data carried over from the prototype. The diary itself is real and dated;
// what is here stands in for a watch sync and for history older than the diary.
import { addDays } from '../lib/dates'
import { newId } from '../lib/ids'
import type { AppState, Favorite, Food, Meal, Profile } from '../types'


// Average daily balance for the three weeks, and the fifteen months, before the current one.
export const SAMPLE_WEEKS = [-300, -280, -210]
export const SAMPLE_MONTHS = [-50, 120, 80, -150, -220, -180, 160, -260, -240, -210, -90, -200, -230, 40, -190]

export const SNACKS = [
  { name: 'Greek yogurt with berries', kcal: '~150 kcal', note: 'lots of protein' },
  { name: 'Apple with a few almonds', kcal: '~180 kcal', note: 'crunchy' },
  { name: 'Popcorn, air-popped', kcal: '~100 kcal a bowl', note: 'salty like chips' },
  { name: 'Cottage cheese', kcal: '~180 kcal', note: 'filling' },
]

// How often each food was logged before the diary starts, for "Often in your diary".
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
  { id: newId(), name: 'Coffee with milk', portion: '1 cup', kcal: 60, protein: 3, carbs: 5, fat: 3, fiber: 0 },
  { id: newId(), name: 'Greek yogurt with chia', portion: '1 bowl', kcal: 220, protein: 17, carbs: 14, fat: 10, fiber: 6 },
  { id: newId(), name: 'Croissant', portion: '1 piece', kcal: 230, protein: 5, carbs: 26, fat: 12, fiber: 1 },
]

type Entry = [time: string, name: string, portion: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number]

// Sample diary, as days before today (0 = today).
const SAMPLE_DIARY: [daysAgo: number, entries: Entry[]][] = [
  [3, [
    ['08:10', 'Oatmeal', '1 bowl', 300, 10, 50, 6, 8],
    ['13:00', 'Chicken breast with rice', '150 g, 1 cup', 460, 50, 45, 6, 1],
    ['16:20', 'Apple', '1 medium', 95, 0, 25, 0, 4],
    ['16:20', 'Almonds', '30 g', 175, 6, 6, 15, 4],
    ['19:30', 'Salmon with salad', '150 g, 1 bowl', 460, 33, 10, 30, 3],
    ['21:00', 'Greek yogurt', '1 pot, 150 g', 130, 15, 6, 5, 0],
  ]],
  [2, [
    ['08:30', 'Avocado toast with eggs', '2 slices, 2 eggs', 480, 24, 38, 26, 8],
    ['11:00', 'Coffee with milk', '1 cup', 60, 3, 5, 3, 0],
    ['13:45', 'Pasta with sauce', '1 plate', 600, 22, 85, 15, 5],
    ['17:00', 'Banana', '1 medium', 105, 1, 27, 0, 3],
    ['20:30', 'Tortilla española', '1 slice', 230, 8, 15, 15, 1],
    ['20:30', '2 × Beer', '330 ml', 290, 2, 26, 0, 0],
    ['22:00', 'Potato chips', '1 bag, 45 g', 240, 3, 24, 15, 2],
  ]],
  [1, [
    ['08:20', 'Greek yogurt with chia', '1 bowl', 220, 17, 14, 10, 6],
    ['13:10', 'Grilled chicken salad', '1 large bowl', 620, 48, 22, 34, 5],
    ['16:00', 'Apple', '1 medium', 95, 0, 25, 0, 4],
    ['17:30', 'Protein shake', '1 scoop with milk', 205, 30, 12, 5, 0],
    ['20:00', 'Vegetable soup', '1 bowl', 120, 4, 18, 3, 4],
    ['20:00', '2 × Toast', '1 slice', 180, 6, 30, 2, 4],
    ['21:30', 'Banana', '1 medium', 105, 1, 27, 0, 3],
  ]],
  [0, [
    ['08:40', 'Avocado toast with eggs', '2 slices, 2 eggs', 480, 24, 38, 26, 8],
    ['13:15', 'Grilled chicken salad', '1 large bowl', 620, 48, 22, 34, 5],
    ['17:30', 'Protein shake', '1 scoop with milk', 205, 30, 12, 5, 0],
    ['17:30', 'Banana', '1 medium', 105, 1, 27, 0, 3],
  ]],
]

function sampleMeals(today: string): Meal[] {
  return SAMPLE_DIARY.flatMap(([daysAgo, entries]) =>
    entries.map(([time, name, portion, kcal, protein, carbs, fat, fiber]) => ({
      id: newId(),
      date: addDays(today, -daysAgo),
      time,
      name,
      portion,
      kcal,
      protein,
      carbs,
      fat,
      fiber,
    })),
  )
}

const SAMPLE_PROFILE: Profile = { sex: 'female', age: 37, heightCm: 160, activity: 'moderate' }

/** A first launch: no profile yet, so the app opens on onboarding with an empty diary. */
export const freshState = (): AppState => ({
  view: 'today',
  profile: null,
  period: 'week',
  goal: { type: 'cut', pace: 'gentle' },
  numbers: true,
  targets: { protein: 115, fat: 60, carbs: 140, fiber: 22 },
  weight: 55.4,
  weighIns: {},
  bodyFat: {},
  favs: defaultFavs(),
  dismissed: {},
  meals: [],
  activities: [],
  activityShortcuts: ['steps', 'walk', 'run', 'other'],
})

// Eight weeks of morning weigh-ins on most days, drifting down about 0.1 kg a week, with
// normal day-to-day noise and one odd reading.
function sampleWeighIns(today: string): Record<string, number> {
  const weighIns: Record<string, number> = {}
  for (let daysAgo = 55; daysAgo >= 0; daysAgo--) {
    if (daysAgo % 7 === 3 || daysAgo % 11 === 5) continue
    const noise = Math.sin(daysAgo * 2.3) * 0.35 + Math.sin(daysAgo * 0.9) * 0.2
    weighIns[addDays(today, -daysAgo)] = Math.round((56.2 - (55 - daysAgo) * 0.015 + noise) * 10) / 10
  }
  weighIns[addDays(today, -20)] += 2.4
  return weighIns
}

/** A filled-in profile with a few days of diary, for looking around. */
export const sampleState = (today: string): AppState => {
  const weighIns = sampleWeighIns(today)
  return {
    ...freshState(),
    profile: SAMPLE_PROFILE,
    meals: sampleMeals(today),
    weighIns,
    weight: weighIns[today],
    // A body-fat reading roughly every ten days, from a home scale.
    bodyFat: Object.fromEntries(
      [27.8, 27.6, 27.7, 27.3, 27.0, 26.7].map((pct, i) => [addDays(today, -(50 - i * 10)), pct]),
    ),
  }
}
