// Food recognition by AI, through our proxy (worker/), for text the on-device parser didn't know.
// The proxy returns foods with an English search term and grams; calories come from CIQUAL here.
// A nutrition label photo comes back as the label's own values, and a barcode as Open Food Facts' values.
// This is the one file that knows about the provider.
import type { DraftItem, KnownItem, Product } from '../types'
import { dbItem, headWords, nameOf, stem, words, type DbFood, type FoodDb } from './foodDb'

/** The proxy's address. Without it the app works as before, without AI. */
const AI_URL: string | undefined = import.meta.env.VITE_AI_URL

interface ParsedFood {
  raw: string
  dish: string
  name: string
  query: string
  fallback: string
  kcal_per_100g: number
  grams: number
  count: number | null
}

export const aiAvailable = () => Boolean(AI_URL) && navigator.onLine

export class AiError extends Error {
  constructor(readonly reason: 'rate_limited' | 'unavailable') {
    super(reason)
  }
}

/** Turns a voice note into text, in whatever language it was spoken. */
export async function transcribeSpeech(audio: Blob): Promise<string> {
  let response: Response
  try {
    // The proxy's other address, next to /parse-food.
    response = await fetch(new URL('transcribe', AI_URL), {
      method: 'POST',
      // "audio/webm;codecs=opus" → "audio/webm": the proxy goes by the container.
      headers: { 'Content-Type': audio.type.split(';')[0] },
      body: audio,
    })
  } catch {
    throw new AiError('unavailable')
  }
  if (response.status === 429) throw new AiError('rate_limited')
  if (!response.ok) throw new AiError('unavailable')
  return ((await response.json()) as { text: string }).text
}

/** Posts to one of the proxy's addresses (next to /parse-food). */
async function post<T>(route: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(new URL(route, AI_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiError('unavailable')
  }
  if (response.status === 429) throw new AiError('rate_limited')
  if (!response.ok) throw new AiError('unavailable')
  return (await response.json()) as T
}

/** Sends only the food text or photo: nothing about the person. */
const requestFoods = (text: string, image?: string) =>
  post<{ items: ParsedFood[]; label: Product | null }>('parse-food', { text, image })

/** A packaged food by its barcode, from Open Food Facts through the proxy; null if it isn't there. */
export async function lookupBarcode(code: string): Promise<Product | null> {
  return (await post<{ product: Product | null }>('product', { code })).product
}

/** A product to log: its label values per 100 g, a serving (or 100 g) to start with, the amount editable. */
export function productItem(product: Product, amount = product.serving ?? 100): KnownItem {
  const per100 = (n: number | null) => Math.round((n ?? 0) * 10) / 10
  return {
    food: {
      name: product.name,
      portion: `100 ${product.unit}`,
      kcal: Math.round(product.kcal),
      protein: per100(product.protein),
      carbs: per100(product.carbs),
      fat: per100(product.fat),
      fiber: per100(product.fiber),
    },
    qty: amount / 100,
    size: 'M',
    amount: { value: amount, unit: product.unit },
    portionGrams: 100,
  }
}

/** Reads a nutrition label photo; null if the photo isn't one. */
export async function readLabel(image: string): Promise<Product | null> {
  return (await requestFoods('', image)).label
}

const COOKED = ['cooked', 'boiled', 'fried', 'baked', 'roasted', 'grilled', 'steamed']

/** Raw and cooked differ a lot per 100 g (rice: 352 vs 145 kcal), so a match in the other state is not used. */
function sameState(query: string, food: DbFood): boolean {
  const q = words(query)
  const name = words(nameOf(food))
  const cooked = q.some((w) => COOKED.includes(w))
  return !(cooked && name.includes('raw')) && !(q.includes('raw') && name.some((w) => COOKED.includes(w)))
}

/** How far the database's kcal may be from the model's estimate before the match counts as wrong. */
const KCAL_RATIO = 1.4
const CANDIDATES = 5

/** Instant coffee powder (416 kcal) is not coffee with milk (about 30): the estimate rules it out. */
function plausible(food: ParsedFood, match: DbFood): boolean {
  if (!(food.kcal_per_100g > 0)) return true
  // Below ~20 kcal (water, black coffee, greens) ratios mean little.
  const a = Math.max(match.kcal, 20)
  const b = Math.max(food.kcal_per_100g, 20)
  return Math.max(a, b) / Math.min(a, b) <= KCAL_RATIO
}

/** The query with one word left out at a time, keeping the main food: "sun dried tomato" → "dried tomato". */
function shorterQueries(food: ParsedFood): string[] {
  const q = words(food.query)
  if (q.length < 2) return []
  const main = food.fallback.toLowerCase()
  return q.filter((w) => w !== main).map((left) => q.filter((w) => w !== left).join(' '))
}

/** The query names the food itself, not just part of it: "egg cooked" names "Egg, raw" but not "Egg roll or Nem",
 *  and "toast bread" names "Toasted bread". */
function namesFood(query: string, match: DbFood): boolean {
  const q = words(query).map(stem)
  return headWords(nameOf(match)).every((w) => q.some((x) => w.startsWith(x)))
}

/** The best database match for the query, else for a shorter query or its main word, that fits the food.
 *  A match the query names outright comes before one that only contains its words. */
function bestMatch(db: FoodDb, food: ParsedFood): DbFood | undefined {
  const fallback = words(food.query).includes(food.fallback.toLowerCase()) ? [food.fallback] : []
  const fits = [food.query, ...shorterQueries(food), ...fallback]
    .flatMap((query) => db.search(query, CANDIDATES))
    .filter((match) => sameState(food.query, match) && plausible(food, match))
  return fits.find((match) => namesFood(food.query, match)) ?? fits[0]
}

/** The dish as a diary entry: "a coffee with milk" → "Coffee with milk". */
export function dishName(dish: string): string | undefined {
  const name = dish.trim().replace(/^(?:a|an|the|un|una|unos|unas)\s+/i, '')
  return name ? name[0].toLocaleUpperCase() + name.slice(1) : undefined
}

/** Turns the text, or a photo with an optional note, into items: the best database match with the AI's amount,
 *  else a choice for the user. A label photo gives its product instead, as one item. */
export async function recognizeFood(
  text: string,
  db: FoodDb,
  image?: string,
): Promise<{ items: DraftItem[]; product: Product | null }> {
  const { items: foods, label } = await requestFoods(text, image)
  if (label) return { items: [productItem(label)], product: label }
  const items = foods.map((food): DraftItem => {
    const grams = food.grams > 0 ? Math.round(food.grams) : undefined
    const match = bestMatch(db, food)
    const dish = dishName(food.dish)
    return match
      ? { ...dbItem(match, grams), dish }
      : { unknown: true, raw: food.name, query: food.fallback || food.query, amount: grams, dish }
  })
  return { items, product: null }
}
