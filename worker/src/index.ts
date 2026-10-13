// AI proxy for Fuel & Burn.
// /parse-food: the app posts the words it couldn't recognise, or a photo of a meal (with an optional note);
// OpenAI turns them into foods with an English search term and a weight. Photos are not stored. Calories are not asked for: the app looks each food up in its
// own database (CIQUAL), so numbers stay consistent.
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
- Anything added that has calories is its own item with its own grams: butter, oil, sauce, mayonnaise, sour cream, sugar, honey, dressing. "Toast with butter" is toast plus butter.
- Keep a dish whole if a French generic food table likely has it (pizza, lasagne, quiche, paella, omelette, hamburger).
  Split a regional dish it likely lacks into its main ingredients (borscht: beetroot, cabbage, potato, beef, sour cream; patatas bravas: fried potato, tomato sauce).

For each item return:
- raw: the words of the input for this item, unchanged (repeat them for each ingredient of a split dish).
- name: a short English name, e.g. "Fried eggs".
- query: 1 to 3 English words as CIQUAL names it, main food first, then form or state.
  Always say "cooked" or "raw" for foods that change weight in cooking (rice, pasta, meat, fish, legumes, potatoes).
  Examples: "rice cooked", "dried pasta cooked", "chicken breast cooked", "egg fried", "potato fried", "toasted bread", "rye bread", "beer regular", "coffee milk", "potato crisps", "tomato dried" (sun-dried tomatoes), "cream" (also for sour cream, smetana, crème fraîche).
- fallback: one word of your query, its main food, used if the whole query finds nothing ("chicken" for "chicken breast cooked").
- kcal_per_100g: your rough estimate of kcal per 100 g of this food as eaten (cooked rice about 130, coffee with milk about 30).
- grams: the total amount in grams (ml for drinks). Use the amount in the text; otherwise estimate a typical portion, times the count.
- count: the number of pieces or portions if the text gives one, else null.

Photos:
- List each food and drink you can see, split the same way, with grams estimated from the plate, cutlery and hands.
- Count what was served, or what is left on the plate if the note says so. Include visible oil, sauce and dressing.
- Any text that comes with the photo is a note from the person and wins over what you see: what the dish is, hidden
  ingredients, how much they ate ("half"). For a photo, raw is a short description of the food in the note's language, else English.
If the text or photo is not about food, return an empty list.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['raw', 'name', 'query', 'fallback', 'kcal_per_100g', 'grams', 'count'],
        properties: {
          raw: { type: 'string' },
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

async function parseFood(env: Env, { text, image }: FoodInput): Promise<ParsedFood[]> {
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
  return (JSON.parse(out) as { items: ParsedFood[] }).items
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
    run: async (env, input: FoodInput) => ({ items: await parseFood(env, input) }),
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
    const route = ROUTES[new URL(request.url).pathname]
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
