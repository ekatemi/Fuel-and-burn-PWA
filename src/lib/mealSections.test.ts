import { describe, expect, it } from 'vitest'
import { mealSections } from './model'
import type { Meal, MealSlot } from '../types'

const meal = (time: string, slot: MealSlot): Meal => ({
  id: time + slot, date: '2026-10-12', time, slot, name: slot, portion: '', kcal: 100, protein: 0, carbs: 0, fat: 0, fiber: 0,
})
const order = (meals: Meal[]) => mealSections(meals).map((s) => `${s.slot}:${s.meals.map((m) => m.time).join(',')}`)

describe('mealSections', () => {
  it('shows the main meals and a place for a snack on an empty day', () => {
    expect(order([])).toEqual(['breakfast:', 'lunch:', 'dinner:', 'snack:'])
  })

  it('puts each snack after the meal before it', () => {
    const day = [meal('08:00', 'breakfast'), meal('11:00', 'snack'), meal('14:00', 'lunch'), meal('17:30', 'snack'), meal('20:00', 'dinner'), meal('22:30', 'snack')]
    expect(order(day)).toEqual(['breakfast:08:00', 'snack:11:00', 'lunch:14:00', 'snack:17:30', 'dinner:20:00', 'snack:22:30'])
  })

  it('keeps snacks together between the same two meals, earliest first', () => {
    const day = [meal('16:00', 'snack'), meal('13:00', 'lunch'), meal('17:00', 'snack')]
    expect(order(day)).toEqual(['breakfast:', 'lunch:13:00', 'snack:16:00,17:00', 'dinner:'])
  })

  it('puts a snack before breakfast first', () => {
    expect(order([meal('06:30', 'snack'), meal('08:00', 'breakfast')])[0]).toBe('snack:06:30')
  })
})
