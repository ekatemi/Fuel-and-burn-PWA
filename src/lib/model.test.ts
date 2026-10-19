import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { activityFit, busyDay, goalIntake, periodData, portionGrams, quickList, status, swapIdea, weekSummary } from './model'
import type { ActivityEntry, Meal } from '../types'

const TODAY = '2026-10-17'
const burnOn = () => 2000

const meal = (date: string, kcal: number, name = 'Food'): Meal => ({
  id: `${date}-${name}`,
  date,
  time: '12:00',
  slot: 'lunch',
  name,
  portion: '1',
  kcal,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
})

describe('periodData', () => {
  it('averages the logged days of the past 30 days, not sample history', () => {
    const meals = [
      meal(addDays(TODAY, -1), 1800),
      meal(addDays(TODAY, -2), 1600),
      meal(addDays(TODAY, -40), 3000), // outside the month, inside the year
      meal(TODAY, 500), // today is still being logged
    ]
    const month = periodData('month', meals, TODAY, burnOn)
    expect(month.empty).toBe(false)
    expect(month.avgEaten).toBe(1700)
    expect(month.balance).toBe(-300)
    const year = periodData('year', meals, TODAY, burnOn)
    expect(year.avgEaten).toBeCloseTo(2133.3, 1)
  })

  it('leaves out days with too little logged to be complete', () => {
    const meals = [meal(addDays(TODAY, -1), 1800), meal(addDays(TODAY, -2), 200, 'Coffee')]
    const month = periodData('month', meals, TODAY, burnOn)
    expect(month.avgEaten).toBe(1800)
    expect(month.balance).toBe(-200)
    expect(periodData('month', [meal(addDays(TODAY, -1), 200)], TODAY, burnOn).empty).toBe(true)
  })

  it('is empty without logged days', () => {
    const month = periodData('month', [meal(TODAY, 500)], TODAY, burnOn)
    expect(month.empty).toBe(true)
    expect(month.avgBurn).toBe(2000)
  })
})

describe('weekSummary', () => {
  it('averages only complete finished days', () => {
    // 2026-10-17 is a Saturday; the week starts on Monday the 12th.
    const meals = [meal('2026-10-12', 1900), meal('2026-10-13', 300, 'Snack'), meal(TODAY, 2500)]
    const week = weekSummary(meals, TODAY, burnOn)
    expect(week.loggedDays).toBe(1)
    expect(week.avgEaten).toBe(1900)
  })
})

describe('quickList', () => {
  it('suggests only foods from the diary itself', () => {
    expect(quickList([], [])).toEqual([])
    const meals = [meal('2026-10-01', 100, 'Kefir'), meal('2026-10-02', 100, 'Kefir'), meal('2026-10-02', 300, 'Pasta')]
    expect(quickList([], meals).map((e) => e.food.name)).toEqual(['Kefir'])
  })
})

describe('goalIntake', () => {
  const steadyCut = { type: 'cut' as const, pace: 'steady' as const }

  it('never goes below resting burn', () => {
    // Sitting most of the day: maintenance 1.2 × resting 1500 = 1800; −20% would be 1440.
    expect(goalIntake(1800, steadyCut, 1500)).toEqual([1500, 1530])
  })

  it('counts eating at the floor as on target', () => {
    expect(status(1500 - 1800, 1800, steadyCut, 1500).kind).toBe('on')
  })
})

describe('activityFit', () => {
  const RESTING = 1330
  const walk = (date: string, kcal: number) =>
    ({ id: date, date, time: '18:00', input: { kind: 'other', type: 'walk', minutes: 30 }, burn: { kcal } }) as unknown as ActivityEntry
  const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(TODAY, -(i + 1)))

  it('waits for about two weeks of activity', () => {
    const recent = days(10)
    expect(activityFit(recent.map((d) => meal(d, 1800)), recent.map((d) => walk(d, 230)), TODAY, RESTING)).toBeNull()
  })

  it('matches the average to the nearest level, counting days without activity as 0', () => {
    const all = days(20)
    const meals = all.map((d) => meal(d, 1800))
    // 230 kcal on every day: Lightly active adds 1330 × 0.175 ≈ 233.
    expect(activityFit(meals, all.map((d) => walk(d, 230)), TODAY, RESTING)?.level).toBe('light')
    // 460 kcal on every other day averages 230 too.
    const fit = activityFit(meals, all.filter((_, i) => i % 2).map((d) => walk(d, 460)), TODAY, RESTING)
    expect(fit?.level).toBe('light')
    expect(fit?.avgKcal).toBe(230)
    expect(activityFit(meals, all.map((d) => walk(d, 700)), TODAY, RESTING)?.level).toBe('active')
  })
})

describe('busyDay', () => {
  const act = (date: string, kcal: number) =>
    ({ id: `${date}-${kcal}`, date, time: '18:00', input: { kind: 'other', type: 'walk', minutes: 30 }, burn: { kcal } }) as unknown as ActivityEntry
  const past = Array.from({ length: 10 }, (_, i) => addDays(TODAY, -(i + 1)))
  const meals = past.map((d) => meal(d, 1800))

  it('needs clearly more activity than usual', () => {
    const usual = past.map((d) => act(d, 250))
    expect(busyDay(meals, [...usual, act(TODAY, 300)], TODAY)).toBe(false)
    expect(busyDay(meals, [...usual, act(TODAY, 400)], TODAY)).toBe(true)
  })

  it('ignores small amounts, even with no history', () => {
    expect(busyDay([], [act(TODAY, 200)], TODAY)).toBe(false)
    expect(busyDay([], [act(TODAY, 350)], TODAY)).toBe(true)
  })
})

describe('swapIdea', () => {
  const dense = (date: string, name = 'Chips', kcal = 300, portion = '55 g', slot: Meal['slot'] = 'snack'): Meal => ({
    ...meal(date, kcal, name),
    id: `${date}-${name}-${kcal}`,
    portion,
    slot,
  })
  const d = (n: number) => addDays(TODAY, -n)

  it('reads weights from portions', () => {
    expect(portionGrams('120 g')).toBe(120)
    expect(portionGrams('330 ml')).toBe(330)
    expect(portionGrams('1 bowl')).toBeNull()
  })

  it('picks a dense food logged often, with half the portion over a week and a month', () => {
    const idea = swapIdea([dense(d(1)), dense(d(3)), dense(d(6)), dense(d(9)), dense(d(12))], TODAY)!
    expect(idea.name).toBe('Chips')
    expect(idea.count).toBe(5)
    expect(idea.avgKcal).toBe(300)
    expect(idea.weekly).toBe(380) // 5 × 300 / 2 over two weeks = 375 a week
    expect(idea.monthly).toBe(1600)
    expect(idea.snack).toBe(true)
  })

  it('leaves out light, small, rare, weightless and older foods', () => {
    const light = [1, 2, 3].map((n) => dense(d(n), 'Rice', 260, '200 g'))
    const small = [1, 2, 3].map((n) => dense(d(n), 'Olive oil', 90, '10 g'))
    const rare = [1, 2].map((n) => dense(d(n)))
    const noWeight = [1, 2, 3].map((n) => dense(d(n), 'Cookies', 300, '1 pack'))
    const old = [15, 16, 17].map((n) => dense(d(n), 'Nuts'))
    expect(swapIdea([...light, ...small, ...rare, ...noWeight, ...old], TODAY)).toBeNull()
  })
})
