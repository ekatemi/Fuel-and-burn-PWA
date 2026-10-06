import { beforeAll, describe, expect, it } from 'vitest'
import { dbItem, loadFoodDb, nameOf, stem, type FoodDb } from './foodDb'
import { kcalOf, toMeal } from './model'
import { parseFoodText } from './parseFood'

let db: FoodDb
beforeAll(async () => {
  db = await loadFoodDb()
})

const top = (query: string, n = 3) => db.search(query, n).map((f) => nameOf(f))

describe('stem', () => {
  it('makes plurals singular', () => {
    expect(['eggs', 'tomatoes', 'cherries', 'peaches', 'glass', 'rice'].map(stem)).toEqual(['egg', 'tomato', 'cherry', 'peach', 'glass', 'rice'])
  })
})

describe('search', () => {
  it('finds the plain food before products made from it', () => {
    expect(top('chicken')[0]).toMatch(/^Chicken, .*meat/)
    expect(top('apple')[0]).toBe('Apple, pulp, raw')
    expect(top('salmon').some((n) => /\boil\b/i.test(n))).toBe(false)
    expect(top('avocado')[0]).toBe('Avocado, pulp, raw')
  })

  it('still finds a product when the query names it', () => {
    expect(top('olive oil')[0]).toBe('Olive oil, extra virgin')
    expect(top('apple juice')[0]).toMatch(/^Apple juice/)
  })

  it('matches every word, in any order, plurals and accents included', () => {
    expect(top('breast chicken').every((n) => /chicken/i.test(n) && /breast/i.test(n))).toBe(true)
    expect(top('boiled eggs')[0]).toBe('Egg, hard-boiled')
    expect(top('paella')[0]).toBe('Paëlla')
    expect(top('gazpacho')[0]).toMatch(/gazpacho/i)
  })

  it('finds words as they are being typed', () => {
    expect(top('broc')[0]).toMatch(/^Broccoli/)
  })

  it('returns nothing for nothing', () => {
    expect(db.search('')).toEqual([])
    expect(db.search('zzzz')).toEqual([])
  })
})

describe('logging a database food', () => {
  it('scales the per-100 g values to the amount', () => {
    const apple = db.search('apple', 1)[0]
    const item = dbItem(apple, 150)
    expect(kcalOf(item)).toBe(Math.round((apple.kcal * 1.5) / 5) * 5)
    const meal = toMeal(item, 'id', '2026-10-06', '12:00')
    expect(meal.portion).toBe('150 g')
    expect(meal.name).toBe('Apple, pulp, raw')
  })

  it('defaults to 100 g', () => {
    expect(dbItem(db.search('apple', 1)[0]).amount).toEqual({ value: 100, unit: 'g' })
  })

  it('gets a search query and amount from text the quick list did not know', () => {
    const [item] = parseFoodText('250 g gazpacho')
    expect(item).toMatchObject({ unknown: true, query: 'gazpacho', amount: 250 })
    const [item2] = parseFoodText('a large bowl of lentils')
    expect(item2).toMatchObject({ unknown: true, query: 'bowl lentils' })
  })
})
