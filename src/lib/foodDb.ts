// The food composition database (ANSES-CIQUAL), searched on the device.
// It loads on first use, as its own file, so the app itself starts just as fast.
import type { Food, KnownItem } from '../types'

/** Languages food names can be stored in. The data has English now; Spanish and Russian can be added. */
export type Lang = 'en' | 'es' | 'ru'
export const FOOD_LANG: Lang = 'en'

export interface DbFood {
  id: string
  names: Partial<Record<Lang, string>>
  /** e.g. "fruits", "cooked meat" */
  group: string
  /** Per 100 g. */
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface FoodDb {
  source: string
  search: (query: string, limit?: number, lang?: Lang) => DbFood[]
}

type Row = [number, Partial<Record<Lang, string>>, string, number, number | null, number | null, number | null, number | null]
interface RawDb {
  source: string
  groups: Record<string, string>
  foods: Row[]
}

export const nameOf = (food: DbFood, lang: Lang = FOOD_LANG) => food.names[lang] ?? food.names.en ?? ''

// ---- Matching ----------------------------------------------------------------

/** Lowercase, without accents, split into words. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/** A rough singular, so "eggs" finds "egg" and "tomatoes" finds "tomato". */
export function stem(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('oes') || /(?:ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

// Words that make an entry less likely to be what someone means by a plain name.
const SPECIFIC = new Set(['prepacked', 'organic', 'label', 'rouge', 'var', 'canned', 'frozen', 'powder', 'dried', 'dehydrated', 'enriched', 'reduced', 'diet', 'light'])
// Products made from a food: "chicken" means the meat, not "Chicken fat", unless the query says so.
const DERIVED = new Set(['fat', 'oil', 'nectar', 'juice', 'flour', 'starch', 'bran', 'sauce', 'cake', 'compote', 'turnover', 'tart', 'pie', 'syrup', 'jam', 'chip', 'crisp', 'spread', 'soup', 'biscuit', 'drink', 'flavoured', 'flavored'])
// Plain forms of a food, a small nudge up.
const PLAIN = new Set(['raw', 'cooked', 'pulp', 'meat', 'whole', 'average', 'boiled', 'fresh', 'plain'])

interface Indexed {
  food: DbFood
  words: string[]
  specific: number
}

function score(entry: Indexed, query: string[]): number | null {
  let total = 0
  for (const [qi, q] of query.entries()) {
    const at = entry.words.findIndex((w) => w.startsWith(q))
    if (at === -1) return null
    total += entry.words[at] === q ? 3 : 2
    // "chicken" should find "Chicken, breast, …" before "Salad with chicken".
    if (qi === 0 && at === 0) total += 4
  }
  const derived = entry.words.filter((w) => DERIVED.has(w) && !query.includes(w)).length
  const plain = Math.min(2, entry.words.filter((w) => PLAIN.has(w)).length)
  return total - 0.15 * entry.words.length - entry.specific - 3 * derived + plain
}

function build(raw: RawDb): FoodDb {
  const foods: DbFood[] = raw.foods.map(([code, names, group, kcal, protein, carbs, fat, fiber]) => ({
    id: `ciqual:${code}`,
    names,
    group: raw.groups[group] ?? '',
    kcal,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
    fiber: fiber ?? 0,
  }))
  const index = new Map<Lang, Indexed[]>()
  const indexFor = (lang: Lang) => {
    let list = index.get(lang)
    if (!list) {
      list = foods.map((food) => {
        const w = words(nameOf(food, lang)).map(stem)
        return { food, words: w, specific: w.filter((x) => SPECIFIC.has(x)).length }
      })
      index.set(lang, list)
    }
    return list
  }

  return {
    source: raw.source,
    search(query, limit = 8, lang = FOOD_LANG) {
      const q = words(query).map(stem)
      if (!q.length) return []
      return indexFor(lang)
        .map((entry) => ({ entry, s: score(entry, q) }))
        .filter((r): r is { entry: Indexed; s: number } => r.s != null)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((r) => r.entry.food)
    },
  }
}

let loading: Promise<FoodDb> | null = null

export function loadFoodDb(): Promise<FoodDb> {
  loading ??= import('../data/ciqual.json').then((m) => build(m.default as unknown as RawDb))
  return loading
}

// ---- Turning a database food into something to log ----------------------------

export const DB_PORTION_GRAMS = 100

export function dbItem(food: DbFood, grams = DB_PORTION_GRAMS): KnownItem {
  const asFood: Food = {
    name: nameOf(food),
    portion: '100 g',
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
  }
  return { food: asFood, qty: grams / DB_PORTION_GRAMS, size: 'M', amount: { value: grams, unit: 'g' }, portionGrams: DB_PORTION_GRAMS }
}
