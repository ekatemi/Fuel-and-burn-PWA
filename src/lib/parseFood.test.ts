import { describe, expect, it } from 'vitest'
import { isKnown, kcalOf, toMeal } from './model'
import { parseFoodText } from './parseFood'
import type { DraftItem, KnownItem } from '../types'

/** Compact view of a parse: "2 × Egg", "Chicken breast 200 g", "? eggplant". */
const summary = (items: DraftItem[]) =>
  items.map((item) => {
    if (!isKnown(item)) return `? ${item.raw}`
    if (item.amount) return `${item.food.name} ${item.amount.value} ${item.amount.unit}`
    return `${item.qty === 1 ? '' : `${item.qty} × `}${item.food.name}${item.size === 'M' ? '' : ` (${item.size})`}`
  })

const parse = (text: string) => summary(parseFoodText(text))
const only = (text: string) => parseFoodText(text)[0] as KnownItem

describe('splitting', () => {
  it('splits on commas, "and", "with" and new lines', () => {
    expect(parse('2 eggs and toast, a latte')).toEqual(['2 × Egg', 'Toast', 'Latte'])
    expect(parse('chicken with rice')).toEqual(['Chicken breast', 'Rice'])
    expect(parse('apple\nbanana')).toEqual(['Apple', 'Banana'])
  })

  it('keeps names that contain "with" in one piece', () => {
    expect(parse('coffee with milk')).toEqual(['Latte'])
    expect(parse('café con leche y tostada')).toEqual(['Latte', '? tostada'])
  })

  it('finds several foods in one part, the specific one first', () => {
    expect(parse('protein shake')).toEqual(['Protein shake'])
    expect(parse('cottage cheese')).toEqual(['Cottage cheese'])
  })
})

describe('quantities', () => {
  it('reads a count before or after the food', () => {
    expect(parse('2 eggs')).toEqual(['2 × Egg'])
    expect(parse('eggs 2')).toEqual(['2 × Egg'])
    expect(parse('eggs x2')).toEqual(['2 × Egg'])
    expect(parse('three bananas')).toEqual(['3 × Banana'])
    expect(parse('dos cervezas')).toEqual(['2 × Beer'])
  })

  it('reads halves and decimals', () => {
    expect(parse('half a pizza')).toEqual(['0.5 × Pizza'])
    expect(parse('1/2 pizza')).toEqual(['0.5 × Pizza'])
    expect(parse('½ avocado')).toEqual(['0.5 × Avocado'])
    expect(parse('1,5 bananas')).toEqual(['1.5 × Banana'])
  })

  it('reads weights and volumes instead of counting them as portions', () => {
    expect(parse('200 g chicken')).toEqual(['Chicken breast 200 g'])
    expect(parse('chicken 200g')).toEqual(['Chicken breast 200 g'])
    expect(parse('0.5 kg rice')).toEqual(['Rice 500 g'])
    expect(parse('330 ml beer')).toEqual(['Beer 330 ml'])
    expect(parse('half a litre of milk')).toEqual(['Milk 500 ml'])
  })

  it('treats a big bare number as grams', () => {
    expect(parse('250 chicken')).toEqual(['Chicken breast 250 g'])
    expect(parse('30 almonds')).toEqual(['Almonds 30 g'])
  })

  it('scales calories and macros by weight', () => {
    const chicken = only('200 g chicken')
    expect(kcalOf(chicken)).toBe(335) // 250 kcal per 150 g
    const meal = toMeal(chicken, 'id', '2026-10-06', '12:00')
    expect(meal.name).toBe('Chicken breast')
    expect(meal.portion).toBe('200 g')
    expect(meal.protein).toBe(61)
  })

  it('no longer turns "200 g" into 200 portions', () => {
    expect(kcalOf(only('200 g chicken'))).toBeLessThan(1000)
  })
})

describe('portion size', () => {
  it('reads size words, including Spanish', () => {
    expect(parse('large latte')).toEqual(['Latte (L)'])
    expect(parse('small salad')).toEqual(['Mixed salad (S)'])
    expect(parse('tortilla pequeña')).toEqual(['Tortilla española (S)'])
  })
})

describe('whole words only', () => {
  it('does not find foods inside other words', () => {
    expect(parse('eggplant')).toEqual(['? eggplant'])
    expect(parse('pineapple')).toEqual(['? pineapple'])
    expect(parse('hamburger')).toEqual(['? hamburger'])
    expect(parse('tomatoes')).toEqual(['? tomatoes'])
  })

  it('still finds plurals', () => {
    expect(parse('apples')).toEqual(['Apple'])
    expect(parse('2 cervezas')).toEqual(['2 × Beer'])
  })
})
