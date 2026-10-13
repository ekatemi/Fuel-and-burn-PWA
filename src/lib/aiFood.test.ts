import { beforeAll, describe, expect, it, vi } from 'vitest'
import { dishName } from './aiFood'
import { loadFoodDb, type FoodDb } from './foodDb'
import { isKnown, itemsToLog, kcalOf } from './model'
import type { DraftItem, KnownItem } from '../types'

let db: FoodDb
let recognizeFood: (text: string, db: FoodDb) => Promise<DraftItem[]>

/** The proxy's answer, without calling it. */
function answer(items: object[]) {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ items })))
}
const food = (query: string, fallback: string, kcal_per_100g: number, grams = 100, dish = '') => ({ raw: query, dish, name: query, query, fallback, kcal_per_100g, grams, count: null })
const names = (items: DraftItem[]) => items.map((i) => (isKnown(i) ? i.food.name : '?'))

beforeAll(async () => {
  vi.stubEnv('VITE_AI_URL', 'https://proxy.test/parse-food')
  recognizeFood = (await import('./aiFood')).recognizeFood
  db = await loadFoodDb()
})

describe('recognizeFood', () => {
  it('uses the database match with the amount from the AI', async () => {
    answer([food('rice cooked', 'rice', 130, 200)])
    const [item] = (await recognizeFood('рис', db)) as KnownItem[]
    expect(item.food.name).toBe('Rice, cooked, unsalted')
    expect(item.amount?.value).toBe(200)
  })

  it('skips matches far from the estimated kcal', async () => {
    answer([food('coffee milk', 'coffee', 30)])
    expect(names(await recognizeFood('café con leche', db))[0]).toMatch(/ready-to-drink/)
  })

  it('never uses a raw food for a cooked one', async () => {
    answer([food('buckwheat cooked', 'buckwheat', 110)])
    expect(names(await recognizeFood('гречка', db))).toEqual(['?'])
  })

  it('ignores a fallback that is not part of the query', async () => {
    answer([food('espresso cup', 'beer', 5)])
    expect(names(await recognizeFood('espresso', db)).join()).not.toMatch(/beer/i)
  })

  it('drops a word the database lacks', async () => {
    answer([food('sun-dried tomatoes', 'tomatoes', 250, 20)])
    expect(names(await recognizeFood('вялеными томатами', db))).toEqual(['Tomato, dried'])
  })

  it('prefers the plain food to filled products', async () => {
    answer([food('dried pasta cooked', 'pasta', 140)])
    expect(names(await recognizeFood('макароны', db))[0]).toMatch(/^Dried pasta, cooked/)
  })

  it('logs a dish as one entry under its own name', async () => {
    const dish = 'Сэндвич с тунцом и салатом'
    answer([
      food('baguette bread', 'baguette', 270, 90, dish),
      food('tuna canned', 'tuna', 120, 60, dish),
      food('lettuce raw', 'lettuce', 15, 20, dish),
      food('apple raw', 'apple', 52, 150, 'Яблоко'),
    ])
    const items = await recognizeFood('сэндвич с тунцом и салатом, яблоко', db)
    const logged = itemsToLog(items)
    expect(logged.map((i) => i.food.name)).toEqual([dish, 'Яблоко'])
    expect(logged[0].food.portion).toBe('170 g')
    const parts = items.slice(0, 3) as KnownItem[]
    const sum = parts.reduce((a, p) => a + p.food.kcal * p.qty, 0)
    expect(kcalOf(logged[0])).toBe(Math.round(sum / 5) * 5)
  })

  it('tidies dish names', () => {
    expect(dishName('a coffee with milk')).toBe('Coffee with milk')
    expect(dishName('гречка с курицей')).toBe('Гречка с курицей')
    expect(dishName('  ')).toBeUndefined()
  })

  it('prefers the food the query names over one that only shares its words', async () => {
    answer([food('egg cooked', 'egg', 155, 110)])
    expect(names(await recognizeFood('2 яйца', db))[0]).toMatch(/^Egg, /)
  })
})
