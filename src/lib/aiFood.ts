// Food recognition by AI, through our proxy (worker/), for text the on-device parser didn't know.
// The proxy returns foods with an English search term and grams; calories come from CIQUAL here.
// This is the one file that knows about the provider.
import type { DraftItem } from '../types'
import { dbItem, nameOf, words, type DbFood, type FoodDb } from './foodDb'

/** The proxy's address. Without it the app works as before, without AI. */
const AI_URL: string | undefined = import.meta.env.VITE_AI_URL

interface ParsedFood {
  raw: string
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

/** Sends only the food text: nothing about the person. */
async function requestFoods(text: string): Promise<ParsedFood[]> {
  let response: Response
  try {
    response = await fetch(AI_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    throw new AiError('unavailable')
  }
  if (response.status === 429) throw new AiError('rate_limited')
  if (!response.ok) throw new AiError('unavailable')
  return ((await response.json()) as { items: ParsedFood[] }).items
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

/** The best database match for the query, else for its main word, that fits the food. */
function bestMatch(db: FoodDb, food: ParsedFood): DbFood | undefined {
  const fallback = words(food.query).includes(food.fallback.toLowerCase()) ? db.search(food.fallback, CANDIDATES) : []
  return db
    .search(food.query, CANDIDATES)
    .concat(fallback)
    .find((match) => sameState(food.query, match) && plausible(food, match))
}

/** Turns the text into items: the best database match with the AI's amount, else a choice for the user. */
export async function recognizeFood(text: string, db: FoodDb): Promise<DraftItem[]> {
  const foods = await requestFoods(text)
  return foods.map((food): DraftItem => {
    const grams = food.grams > 0 ? Math.round(food.grams) : undefined
    const match = bestMatch(db, food)
    return match ? dbItem(match, grams) : { unknown: true, raw: food.name, query: food.fallback || food.query, amount: grams }
  })
}
