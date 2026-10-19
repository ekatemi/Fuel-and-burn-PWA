import { describe, expect, it } from 'vitest'
import { shareText } from './shareCard'
import type { Meal, MealSlot } from '../types'

const meal = (slot: MealSlot, time: string, name: string, portion: string, kcal: number): Meal => ({
  id: name,
  date: '2026-10-17',
  time,
  slot,
  name,
  portion,
  kcal,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
})

describe('shareText', () => {
  const meals = [
    meal('lunch', '14:05', 'Помидор', '1 шт.', 30),
    meal('lunch', '14:00', 'Домашние пельмени', '6 шт.', 245),
    meal('lunch', '14:00', 'Соевый соус', '1 tbsp', 8),
    meal('breakfast', '08:30', 'Steak', '150 g', 300),
    meal('snack', '11:00', 'Boiled egg', '1', 75),
  ]

  it('groups by meal, snacks last, with the biggest item’s emoji on each heading', () => {
    expect(shareText(meals, true)).toBe(
      [
        '🥩 Breakfast',
        '',
        '• 🥩 Steak, 150 g — ≈255–345 kcal',
        '',
        '🥟 Lunch',
        '',
        '• 🥟 Домашние пельмени, 6 шт. — ≈210–280 kcal',
        '• 🥢 Соевый соус, 1 tbsp — ≈5–10 kcal',
        '• 🍅 Помидор, 1 шт. — ≈25–35 kcal',
        '',
        '🍳 Snacks',
        '',
        '• 🍳 Boiled egg, 1 — ≈65–85 kcal',
      ].join('\n'),
    )
  })

  it('leaves calories out unless asked', () => {
    expect(shareText(meals, false)).toContain('• 🥟 Домашние пельмени, 6 шт.\n')
  })
})
