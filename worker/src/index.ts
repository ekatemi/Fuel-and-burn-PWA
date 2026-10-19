// AI proxy for Fuel & Burn.
// /parse-food: the app posts the words it couldn't recognise, or a photo of a meal (with an optional note);
// OpenAI turns them into foods with an English search term and a weight. Photos are not stored. Calories are not asked for: the app looks each food up in its
// own database (CIQUAL), so numbers stay consistent.
// A photo of a nutrition label comes back as the label's values per 100 g instead.
// /product: a barcode, looked up in Open Food Facts (from here, so the person's IP address isn't sent there).
// /transcribe: a short voice note (any language) to text.
// Nothing is stored except a daily request count per hashed IP address.

export interface Env {
  OPENAI_API_KEY: string
  ALLOWED_ORIGINS: string
  MODEL: string
  TRANSCRIBE_MODEL: string
  DAILY_LIMIT: string
  BURST: { limit: (options: { key: string }) => Promise<{ success: boolean }> }
  USAGE: KVNamespace
}

export interface ParsedFood {
  /** The words of the input this item came from, unchanged. */
  raw: string
  /** The dish this item is part of, as the person called it; the diary logs the dish, not its parts. */
  dish: string
  /** Short English name, for display. */
  name: string
  /** Plain English words to search the food database for. */
  query: string
  /** One generic word, for when query finds nothing. */
  fallback: string
  /** The model's rough kcal per 100 g, only to reject a wrong database match. */
  kcal_per_100g: number
  /** Total grams (ml for drinks): given in the text or estimated. */
  grams: number
  /** Pieces or portions, when the text says how many. */
  count: number | null
}

/** What a nutrition label says, per 100 g (or 100 ml for drinks). */
export interface Label {
  /** The product name as printed, or a short description. */
  name: string
  unit: 'g' | 'ml'
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** Not every label gives fiber. */
  fiber: number | null
  /** One serving as printed on the label, in g or ml, if it gives one. */
  serving: number | null
}

const MAX_TEXT = 500
/** A photo resized on the phone to ~768 px is ~100 KB; this leaves room. */
const MAX_IMAGE_CHARS = 1_500_000
const IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
/** About a minute of speech; a food note is a few seconds. */
const MAX_AUDIO_BYTES = 2_000_000
/** File extensions OpenAI recognises, by the recorder's media type. */
const AUDIO_TYPES: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }
const DAY_SECONDS = 24 * 60 * 60

const INSTRUCTIONS = `You turn a description of what someone ate into a list of foods, to be looked up in the
ANSES-CIQUAL food composition table (English names). The text may be in English, Spanish or Russian, or a mix.

Splitting:
- Each food or drink is its own item: "chicken and rice" is two items.
- Several pieces of one food are one item with the grams for all of them: "2 eggs" is one item, count 2.
- A sandwich, burger, wrap or toast always has its bread as an item, besides the filling.
- Anything added that has calories is its own item with its own grams: butter, oil, sauce, mayonnaise, sour cream, sugar, honey, dressing. "Toast with butter" is toast plus butter.
- Keep a dish whole if a French generic food table likely has it (pizza, lasagne, quiche, paella, omelette, hamburger),
  unless the person says what it is made of: then list those ingredients instead.
- Parts of a food are their own items, never the whole food: egg yolks and egg whites ("omelette of 2 yolks and
  3 whites" is egg yolk, 2 yolks about 35 g, and egg white, 3 whites about 100 g, never whole eggs), skinless chicken,
  skimmed milk.
  Split a regional dish it likely lacks into its main ingredients (borscht: beetroot, cabbage, potato, beef, sour cream; patatas bravas: fried potato, tomato sauce).

For each item return:
- raw: the words of the input for this item, unchanged (repeat them for each ingredient of a split dish).
- dish: the whole dish this item belongs to, copied from the person's words: everything they wrote about that dish,
  in their language (never translated), without numbers or amounts, starting with a capital.
  Everything joined to a food by "with", "с", "con", "из" or "on" is part of that dish, including a list after it.
  Every ingredient of one dish has exactly the same dish, and they come one after another.
  Foods listed separately with "and", "и", "y" or commas are separate dishes, unless they follow a "with".
  Examples: "сэндвич с тунцом и салатом" → all items "Сэндвич с тунцом и салатом";
  "porridge with banana and honey, 2 cups of tea" → "Porridge with banana and honey", then "Cups of tea";
  "2 яйца и тост с маслом" → "Яйца", then "Тост с маслом" for both toast and butter.
  For a photo, name each dish in the note's language, else in English.
- name: a short English name, e.g. "Fried eggs".
- query: 1 to 3 English words as CIQUAL names it, main food first, then form or state.
  Always say "cooked" or "raw" for foods that change weight in cooking (rice, pasta, meat, fish, legumes, potatoes).
  Examples: "rice cooked", "dried pasta cooked", "chicken breast cooked", "egg fried", "egg yolk cooked", "egg white cooked", "potato fried", "toasted bread", "rye bread", "beer regular", "coffee milk", "potato crisps", "tomato dried" (sun-dried tomatoes), "oat flakes cooked" (porridge, oatmeal), "cream" (also for sour cream, smetana, crème fraîche).
- fallback: one word of your query, its main food, used if the whole query finds nothing ("chicken" for "chicken breast cooked").
- kcal_per_100g: your rough estimate of kcal per 100 g of this food as eaten (cooked rice about 130, coffee with milk about 30).
- grams: the total amount in grams (ml for drinks). Use the amount in the text; otherwise estimate a typical portion, times the count.
- count: the number of pieces or portions if the text gives one, else null.

Photos:
- List each food and drink you can see, split the same way, with grams estimated from the plate, cutlery and hands.
- Count what was served, or what is left on the plate if the note says so. Include visible oil, sauce and dressing.
- Any text that comes with the photo is a note from the person and wins over what you see: what the dish is, hidden
  ingredients, how much they ate ("half"). For a photo, raw is a short description of the food in the note's language, else English.
Nutrition labels:
- If the photo shows a nutrition facts table (from a package), fill label and return an empty items list.
- Copy the values per 100 g (or per 100 ml for drinks): kcal, protein, fat, carbohydrates (total, not "of which sugars"), fiber.
  If the label gives kJ only, divide by 4.184. If it gives values per serving only, convert them to 100 g using the serving size.
- fiber: null if the label doesn't list it. serving: the serving or portion size in g or ml if printed, else null.
- name: the product name if you can read it on the package, in its language; else a short description like "Yogurt".
- Use a comma or point as printed; return plain numbers. For any photo without a nutrition table, label is null.
If the text or photo is not about food, return an empty list and a null label.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'label'],
  properties: {
    label: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'unit', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'serving'],
          properties: {
            name: { type: 'string' },
            unit: { type: 'string', enum: ['g', 'ml'] },
            kcal: { type: 'number' },
            protein: { type: 'number' },
            fat: { type: 'number' },
            carbs: { type: 'number' },
            fiber: { type: ['number', 'null'] },
            serving: { type: ['number', 'null'] },
          },
        },
      ],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['raw', 'dish', 'name', 'query', 'fallback', 'kcal_per_100g', 'grams', 'count'],
        properties: {
          raw: { type: 'string' },
          dish: { type: 'string' },
          name: { type: 'string' },
          query: { type: 'string' },
          fallback: { type: 'string' },
          kcal_per_100g: { type: 'number' },
          grams: { type: 'number' },
          count: { type: ['number', 'null'] },
        },
      },
    },
  },
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  })
}

function cors(origin: string | null): Record<string, string> {
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** The IP address, hashed, so the usage counters hold no personal data. */
async function clientKey(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fuel-ai:' + ip))
  return [...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Counts the request against today's limit; false once the limit is reached. */
async function withinDailyLimit(env: Env, key: string): Promise<boolean> {
  const counter = `${new Date().toISOString().slice(0, 10)}:${key}`
  const used = Number(await env.USAGE.get(counter)) || 0
  if (used >= Number(env.DAILY_LIMIT)) return false
  await env.USAGE.put(counter, String(used + 1), { expirationTtl: 2 * DAY_SECONDS })
  return true
}

interface FoodInput {
  text: string
  /** A JPEG, PNG or WebP data URL. */
  image: string | null
}

async function parseFood(env: Env, { text, image }: FoodInput): Promise<{ items: ParsedFood[]; label: Label | null }> {
  const input = image
    ? [
        {
          role: 'user',
          content: [
            ...(text ? [{ type: 'input_text', text }] : []),
            { type: 'input_image', image_url: image, detail: 'auto' },
          ],
        },
      ]
    : text
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.MODEL,
      instructions: INSTRUCTIONS,
      input,
      reasoning: { effort: 'none' },
      text: { format: { type: 'json_schema', name: 'foods', strict: true, schema: SCHEMA } },
      store: false,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`)
  const data = (await response.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] }
  const message = data.output?.find((o) => o.type === 'message')
  const out = message?.content?.find((c) => c.type === 'output_text')?.text
  if (!out) throw new Error('OpenAI returned no text')
  return JSON.parse(out) as { items: ParsedFood[]; label: Label | null }
}

/** EAN-8, UPC-A, EAN-13 and GTIN-14. */
const BARCODE = /^\d{8,14}$/
const OFF_FIELDS = 'product_name,brands,nutriments,serving_quantity,product_quantity_unit'

interface OffProduct {
  product_name?: string
  brands?: string
  serving_quantity?: number | string
  product_quantity_unit?: string
  nutriments?: Record<string, number | string | undefined>
}

/** A product from Open Food Facts as a label, or null if it isn't there or has no calories. */
async function lookupProduct(code: string): Promise<Label | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, {
    headers: { 'User-Agent': 'FuelAndBurn/1.0 (info@mikhaylova.dev)' },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Open Food Facts ${response.status}`)
  const data = (await response.json()) as { status?: number; product?: OffProduct }
  const p = data.product
  if (data.status !== 1 || !p?.nutriments) return null
  const n = (key: string) => {
    const value = Number(p.nutriments![`${key}_100g`])
    return Number.isFinite(value) ? value : null
  }
  const kcal = n('energy-kcal') ?? (n('energy') != null ? n('energy')! / 4.184 : null)
  if (kcal == null) return null
  // "Hacendado Yogur natural", but "Nutella", not "Nutella Nutella".
  const brand = p.brands?.split(',')[0].trim() ?? ''
  const product = p.product_name?.trim() ?? ''
  const name = (product.toLowerCase().includes(brand.toLowerCase()) ? product : `${brand} ${product}`).trim() || 'Packaged food'
  const serving = Number(p.serving_quantity)
  return {
    name,
    unit: p.product_quantity_unit === 'ml' ? 'ml' : 'g',
    kcal,
    protein: n('proteins') ?? 0,
    fat: n('fat') ?? 0,
    carbs: n('carbohydrates') ?? 0,
    fiber: n('fiber'),
    serving: serving > 0 ? serving : null,
  }
}

// No prompt: given a hint like "someone says what they ate", the model invents a meal from silence.
async function transcribe(env: Env, audio: ArrayBuffer, type: string): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([audio], { type }), `speech.${AUDIO_TYPES[type]}`)
  form.append('model', env.TRANSCRIBE_MODEL)
  form.append('response_format', 'json')
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  })
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`)
  return ((await response.json()) as { text: string }).text.trim()
}

/** Each route reads its input and returns null when it is not valid. */
const ROUTES: Record<string, { read: (request: Request) => Promise<unknown>; run: (env: Env, input: never) => Promise<unknown> }> = {
  '/parse-food': {
    async read(request): Promise<FoodInput | null> {
      const body = (await request.json().catch(() => null)) as { text?: unknown; image?: unknown } | null
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      const image = typeof body?.image === 'string' ? body.image : null
      if (text.length > MAX_TEXT) return null
      if (image != null && (image.length > MAX_IMAGE_CHARS || !IMAGE_DATA_URL.test(image))) return null
      return text || image ? { text, image } : null
    },
    run: (env, input: FoodInput) => parseFood(env, input),
  },
  '/product': {
    async read(request) {
      const body = (await request.json().catch(() => null)) as { code?: unknown } | null
      return typeof body?.code === 'string' && BARCODE.test(body.code) ? body.code : null
    },
    run: async (_env, code: string) => ({ product: await lookupProduct(code) }),
  },
  '/transcribe': {
    async read(request) {
      // "audio/webm;codecs=opus" → "audio/webm"
      const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim()
      if (!(type in AUDIO_TYPES)) return null
      const audio = await request.arrayBuffer()
      return audio.byteLength > 0 && audio.byteLength <= MAX_AUDIO_BYTES ? { audio, type } : null
    },
    run: async (env, { audio, type }: { audio: ArrayBuffer; type: string }) => ({ text: await transcribe(env, audio, type) }),
  },
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    // Any local dev server is fine: the limits, not the origin, are what protect the key.
    const local = origin != null && /^http:\/\/localhost:\d+$/.test(origin)
    const allowed = origin && (local || env.ALLOWED_ORIGINS.split(',').includes(origin)) ? origin : null

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors(allowed) })
    if (!allowed) return json({ error: 'forbidden' }, 403, null)
    // Served at workers.dev ("/parse-food") and on the site's own domain ("/fuel/api/parse-food").
    const route = ROUTES['/' + new URL(request.url).pathname.split('/').pop()]
    if (request.method !== 'POST' || !route) return json({ error: 'not_found' }, 404, allowed)

    const input = await route.read(request)
    if (input == null) return json({ error: 'bad_request' }, 400, allowed)

    const key = await clientKey(request)
    if (!(await env.BURST.limit({ key })).success || !(await withinDailyLimit(env, key))) {
      return json({ error: 'rate_limited' }, 429, allowed)
    }

    try {
      return json(await route.run(env, input as never), 200, allowed)
    } catch (e) {
      console.error(e)
      return json({ error: 'upstream' }, 502, allowed)
    }
  },
}
