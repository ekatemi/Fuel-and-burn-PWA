import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { expectedVsActual, learnMaintenance, weekObservations } from './tdee'
import { weighInList } from './weight'
import type { Meal } from '../types'

const TODAY = '2026-10-16'
const FORMULA = 2000

const meal = (date: string, kcal: number): Meal => ({
  id: date,
  date,
  time: '12:00',
  slot: 'lunch',
  name: 'Food',
  portion: '1',
  kcal,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
})

/** `days` days up to yesterday, eating `kcal(i)` and weighing `kg(i)` (i = 0 is the oldest day). */
function history(days: number, kcal: (i: number) => number, kg: (i: number) => number) {
  const meals: Meal[] = []
  const weighIns: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const date = addDays(TODAY, i - days)
    meals.push(meal(date, kcal(i)))
    weighIns[date] = kg(i)
  }
  return { meals, weighIns: weighInList(weighIns) }
}

describe('learnMaintenance', () => {
  it('uses the formula alone without data', () => {
    const est = learnMaintenance([], [], TODAY, FORMULA)
    expect(est).toMatchObject({ kcal: FORMULA, alpha: 0, goodWeeks: 0, confidence: 'low', low: 1800, high: 2200 })
  })

  it('moves towards the observed burn as weeks of data build up', () => {
    // Eating 2200 and holding weight: observed burn 2200.
    const two = history(21, () => 2200, () => 70)
    const five = history(40, () => 2200, () => 70)
    const a = learnMaintenance(two.meals, two.weighIns, TODAY, FORMULA)
    const b = learnMaintenance(five.meals, five.weighIns, TODAY, FORMULA)
    expect(a.goodWeeks).toBe(2)
    expect(a.kcal).toBe(2080)
    expect(b.goodWeeks).toBe(4)
    expect(b.kcal).toBe(2160)
    expect(b.high - b.low).toBeLessThan(a.high - a.low)
    expect(b.confidence).toBe('high')
  })

  it('adds the energy released by weight loss to intake', () => {
    // 1800 a day while the trend falls 0.5 kg a week: 1800 + 0.5 × 7700 / 7 = 2350.
    const { meals, weighIns } = history(40, () => 1800, (i) => 80 - (0.5 * i) / 7)
    const weeks = weekObservations(meals, weighIns, TODAY, FORMULA)
    expect(weeks).toHaveLength(4)
    for (const w of weeks) expect(w.observed).toBeCloseTo(2350, 0)
  })

  it('leaves out one strange week', () => {
    // A holiday week, two weeks ago: eating 3200 while weight holds (water, salt).
    const { meals, weighIns } = history(
      40,
      (i) => (i >= 26 && i < 33 ? 3200 : 2100),
      () => 70,
    )
    const est = learnMaintenance(meals, weighIns, TODAY, FORMULA)
    expect(est.unusualWeeks).toBe(1)
    expect(est.goodWeeks).toBe(3)
    expect(est.kcal).toBe(2060)
  })

  it('skips days that look incomplete, so forgotten meals do not lower maintenance', () => {
    const { meals, weighIns } = history(40, (i) => (i % 2 ? 2100 : 400), () => 70)
    const weeks = weekObservations(meals, weighIns, TODAY, FORMULA)
    for (const w of weeks) expect(w.intake).toBe(2100)
  })

  it('needs food on at least four days of a week', () => {
    const { meals, weighIns } = history(40, (i) => (i % 3 ? 0 : 2100), () => 70)
    expect(learnMaintenance(meals, weighIns, TODAY, FORMULA).goodWeeks).toBe(0)
  })
})

describe('expectedVsActual', () => {
  const burn = () => 2000

  it('waits for a week with enough data', () => {
    expect(expectedVsActual([], [], TODAY, FORMULA, burn)).toBeNull()
  })

  it('agrees when weight moves as the diary predicts', () => {
    // 500 kcal a day under a 2000 burn: 3500 a week, about 0.45 kg.
    const { meals, weighIns } = history(40, () => 1500, (i) => 80 - (3500 / 7700) * (i / 7))
    const result = expectedVsActual(meals, weighIns, TODAY, FORMULA, burn)!
    expect(result.weeks).toBe(4)
    expect(result.expected).toBeCloseTo(-1.82, 1)
    expect(result.actual).toBeCloseTo(-1.82, 1)
    expect(result.verdict).toBe('as-expected')
  })

  it('says so when weight comes out higher or lower', () => {
    const flat = history(40, () => 1500, () => 80)
    expect(expectedVsActual(flat.meals, flat.weighIns, TODAY, FORMULA, burn)!.verdict).toBe('higher')
    const falling = history(40, () => 2000, (i) => 80 - 0.5 * (i / 7))
    expect(expectedVsActual(falling.meals, falling.weighIns, TODAY, FORMULA, burn)!.verdict).toBe('lower')
  })
})
