// Turns typed text ("2 eggs and toast, 200 g chicken") into food items from the catalog.
// A keyword parser standing in for real food recognition: it only knows the catalog's foods.
import { FOODS } from '../data/foods'
import type { CatalogFood, DraftItem, PortionSize } from '../types'

const LETTER = '\\p{L}'
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Words that split a list into items, when they stand between spaces. */
const SPLIT = /\s*(?:[,;+\n])\s*|\s+(?:and|with|y|con|&)\s+/u
/** Stand-in for spaces inside a keyword that itself contains a split word ("coffee with milk").
 *  A word joiner: invisible and not whitespace, so SPLIT leaves it alone. */
const JOIN = '\u2060'

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
}
const HALF = ['half', 'media', 'medio']
const SMALL = ['small', 'little', 'mini', 'pequeño', 'pequeña']
const LARGE = ['large', 'big', 'huge', 'double', 'grande']
/** Units for an amount, as a factor to grams (or ml). */
const UNITS: Record<string, number> = {
  g: 1, gr: 1, gram: 1, grams: 1, gramme: 1, grammes: 1, gramos: 1, kg: 1000,
  ml: 1, cl: 10, l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000, litro: 1000, litros: 1000,
}
/** Units written as words, which also work without a number ("half a litre"). */
const UNIT_WORDS: Record<string, number> = { kilo: 1000, kg: 1000, liter: 1000, litre: 1000, litro: 1000, gram: 1, gramme: 1, gramo: 1 }
/** A bare number this big is an amount in grams or ml, not a count ("250 chicken"). */
const AMOUNT_THRESHOLD = 20

const AMOUNT = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|')})(?![${LETTER}])`,
  'u',
)
const FRACTION = /(\d+)\s*\/\s*(\d+)/
const NUMBER = /\d+(?:[.,]\d+)?/

const toNumber = (s: string) => parseFloat(s.replace(',', '.'))

/** Whole-word search, allowing a plural ending ("eggs", "tomatoes", "cervezas"). */
function findWord(text: string, word: string): { start: number; end: number } | null {
  const re = new RegExp(`(^|[^${LETTER}])(${escape(word)}(?:e?s)?)(?=[^${LETTER}]|$)`, 'u')
  const m = re.exec(text)
  if (!m) return null
  const start = m.index + m[1].length
  return { start, end: start + m[2].length }
}
const hasAnyWord = (text: string, words: string[]) => words.some((w) => findWord(text, w))

interface Quantity {
  count: number
  /** Set when the text gives a weight or volume. */
  amount: number | null
}

function readQuantity(part: string): Quantity {
  let text = part
  let amount: number | null = null
  const a = AMOUNT.exec(text)
  if (a) {
    amount = toNumber(a[1]) * UNITS[a[2]]
    text = text.replace(a[0], ' ')
  }

  let count = 1
  const fraction = FRACTION.exec(text)
  const number = NUMBER.exec(text)
  const word = text.split(/[^\p{L}]+/u).find((w) => w in WORD_NUMBERS)
  if (fraction && Number(fraction[2]) > 0) count = Number(fraction[1]) / Number(fraction[2])
  else if (text.includes('½')) count = 0.5
  else if (number) count = toNumber(number[0])
  else if (word) count = WORD_NUMBERS[word]
  if (hasAnyWord(text, HALF)) count *= 0.5

  // "half a litre of milk", "a kilo of rice": a unit word without a number.
  const unitWord = amount == null ? Object.keys(UNIT_WORDS).find((w) => findWord(text, w)) : undefined
  if (unitWord) {
    amount = count * UNIT_WORDS[unitWord]
    count = 1
  }

  // "250 chicken": a number this big is a weight, not a number of portions.
  if (amount == null && count >= AMOUNT_THRESHOLD) {
    amount = count
    count = 1
  }
  return { count, amount }
}

function itemFor(food: CatalogFood, { count, amount }: Quantity, size: PortionSize): DraftItem {
  if (amount != null) {
    return { food, qty: amount / food.grams, size: 'M', amount: { value: amount, unit: food.unit }, portionGrams: food.grams }
  }
  return { food, qty: count, size }
}

const FILLER = ['of', 'the', 'some', 'x', 'de', 'del', 'la', 'el', 'los', 'las', 'portion', 'portions', 'serving', 'piece', 'pieces']

/** What to look up in the food database for text the catalog didn't know. */
function searchText(part: string): string {
  let text = part.replace(AMOUNT, ' ').replace(FRACTION, ' ').replace(/\d+(?:[.,]\d+)?/g, ' ').replace('½', ' ')
  for (const w of [...Object.keys(WORD_NUMBERS), ...Object.keys(UNIT_WORDS), ...HALF, ...SMALL, ...LARGE, ...FILLER]) {
    let hit
    while ((hit = findWord(text, w))) text = text.slice(0, hit.start) + ' ' + text.slice(hit.end)
  }
  return text.replace(/\s+/g, ' ').trim()
}

export function parseFoodText(text: string): DraftItem[] {
  // A comma between digits is a decimal point ("1,5 bananas"), not a list separator.
  let normalized = text.toLowerCase().replace(/(\d),(\d)/g, '$1.$2')
  // Keep keywords like "coffee with milk" whole before splitting on "with".
  for (const food of FOODS) {
    for (const keyword of food.keywords) {
      if (!/\s(?:and|with|y|con|&)\s/.test(keyword)) continue
      const hit = findWord(normalized, keyword)
      if (hit) normalized = normalized.slice(0, hit.start) + keyword.replaceAll(' ', JOIN) + normalized.slice(hit.end)
    }
  }

  const parts = normalized
    .split(SPLIT)
    .map((p) => p.replaceAll(JOIN, ' ').trim())
    .filter(Boolean)

  const out: DraftItem[] = []
  for (const part of parts) {
    const quantity = readQuantity(part)
    const size: PortionSize = hasAnyWord(part, SMALL) ? 'S' : hasAnyWord(part, LARGE) ? 'L' : 'M'

    // Each catalog food at most once per part; a matched name is blanked out so that
    // "protein shake" isn't also found again as "shake".
    let rest = part
    let found = false
    for (const food of FOODS) {
      const hit = food.keywords.map((k) => findWord(rest, k)).find(Boolean)
      if (!hit) continue
      found = true
      out.push(itemFor(food, quantity, size))
      rest = rest.slice(0, hit.start) + ' '.repeat(hit.end - hit.start) + rest.slice(hit.end)
    }
    if (!found) out.push({ unknown: true, raw: part, query: searchText(part), amount: quantity.amount ?? undefined })
  }
  return out
}
