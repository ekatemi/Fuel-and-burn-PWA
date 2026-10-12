import { beforeAll, describe, expect, it, vi } from 'vitest'
import { loadFoodDb, type FoodDb } from './foodDb'
import { isKnown } from './model'
import type { DraftItem, KnownItem } from '../types'

let db: FoodDb
let recognizeFood: (text: string, db: FoodDb) => Promise<DraftItem[]>

/** The proxy's answer, without calling it. */
function answer(items: object[]) {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ items })))
}
const food = (query: string, fallback: string, kcal_per_100g: number, grams = 100) => ({ raw: query, name: query, query, fallback, kcal_per_100g, grams, count: null })
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

  it('prefers the plain food to filled products', async () => {
    answer([food('dried pasta cooked', 'pasta', 140)])
    expect(names(await recognizeFood('макароны', db))[0]).toMatch(/^Dried pasta, cooked/)
  })
})
