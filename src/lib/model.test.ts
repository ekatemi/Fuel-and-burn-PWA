import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { goalIntake, periodData, quickList, status, weekSummary } from './model'
import type { Meal } from '../types'

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
