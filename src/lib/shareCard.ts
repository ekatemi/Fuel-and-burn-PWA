// Draws a day's food as an image to share (WhatsApp and the like). Always light colours,
// since the picture is seen outside the app.
import { fmt, GROUP_NAMES, MACROS, macroSum, mealGroups } from './model'
import type { Meal, MealSlot, Targets } from '../types'

export interface ShareCardInput {
  meals: Meal[]
  targets: Targets
  /** Numbers on in the app; with calm view the card uses words instead. */
  numbers: boolean
  showKcal: boolean
  note: string
  /** e.g. "Tuesday, October 6" */
  dateLabel: string
  isToday: boolean
  /** e.g. "On target"; omitted when the week has no finished days. */
  weekStatus: string | null
  weekOnTarget: boolean
}

// Word stems in English, Spanish and Russian (dishes keep the person's own words); the first match wins,
// so dishes come before their ingredients.
const EMOJI: [string, string][] = [
  ['dumpling', '🥟'], ['пельмен', '🥟'], ['вареник', '🥟'], ['хинкал', '🥟'], ['gyoza', '🥟'],
  ['sandwich', '🥪'], ['бутерброд', '🥪'], ['сэндвич', '🥪'], ['bocadillo', '🥪'], ['burger', '🍔'], ['бургер', '🍔'],
  ['pizza', '🍕'], ['пицц', '🍕'], ['sushi', '🍣'], ['суши', '🍣'], ['ролл', '🍣'], ['soup', '🍲'], ['суп', '🍲'],
  ['борщ', '🍲'], ['sopa', '🍲'], ['salad', '🥗'], ['салат', '🥗'], ['ensalada', '🥗'], ['paella', '🥘'],
  ['tortilla', '🥘'], ['омлет', '🍳'], ['omelet', '🍳'], ['pasta', '🍝'], ['паст', '🍝'], ['spaghetti', '🍝'],
  ['макарон', '🍝'], ['noodle', '🍜'], ['лапш', '🍜'], ['porridge', '🥣'], ['каш', '🥣'], ['oat', '🥣'],
  ['овсян', '🥣'], ['granola', '🥣'], ['yogurt', '🥣'], ['йогурт', '🥣'], ['yogur', '🥣'], ['кефир', '🥛'],
  ['cottage', '🥛'], ['творог', '🥛'], ['milk', '🥛'], ['молок', '🥛'], ['leche', '🥛'], ['shake', '🥤'],
  ['коктейл', '🥤'], ['coffee', '☕'], ['latte', '☕'], ['кофе', '☕'], ['café', '☕'], ['tea', '🍵'], ['чай', '🍵'],
  ['beer', '🍺'], ['пиво', '🍺'], ['cerveza', '🍺'], ['wine', '🍷'], ['вино', '🍷'], ['vino', '🍷'],
  ['croissant', '🥐'], ['круассан', '🥐'], ['pancake', '🥞'], ['блин', '🥞'], ['сырник', '🥞'], ['toast', '🍞'],
  ['bread', '🍞'], ['хлеб', '🍞'], ['pan ', '🍞'], ['cheese', '🧀'], ['сыр', '🧀'], ['queso', '🧀'],
  ['egg', '🍳'], ['яйц', '🍳'], ['яичн', '🍳'], ['huevo', '🍳'], ['chicken', '🍗'], ['куриц', '🍗'],
  ['курин', '🍗'], ['pollo', '🍗'], ['ham', '🍖'], ['ветчин', '🍖'], ['jamón', '🍖'], ['jamon', '🍖'],
  ['bacon', '🥓'], ['бекон', '🥓'], ['sausage', '🌭'], ['колбас', '🌭'], ['сосиск', '🌭'], ['steak', '🥩'],
  ['beef', '🥩'], ['говяд', '🥩'], ['мяс', '🥩'], ['pork', '🥩'], ['свинин', '🥩'], ['salmon', '🐟'],
  ['лосос', '🐟'], ['tuna', '🐟'], ['тунец', '🐟'], ['тунц', '🐟'], ['atún', '🐟'], ['fish', '🐟'], ['рыб', '🐟'],
  ['shrimp', '🦐'], ['prawn', '🦐'], ['кревет', '🦐'], ['rice', '🍚'], ['рис', '🍚'], ['arroz', '🍚'],
  ['гречк', '🍚'], ['bravas', '🥔'], ['fries', '🍟'], ['potato', '🥔'], ['картоф', '🥔'], ['картош', '🥔'],
  ['patata', '🥔'], ['chips', '🥔'], ['tomato', '🍅'], ['помидор', '🍅'], ['томат', '🍅'], ['tomate', '🍅'],
  ['cucumber', '🥒'], ['огур', '🥒'], ['spinach', '🥬'], ['шпинат', '🥬'], ['espinaca', '🥬'], ['lettuce', '🥬'],
  ['салатн', '🥬'], ['капуст', '🥬'], ['broccoli', '🥦'], ['брокколи', '🥦'], ['carrot', '🥕'], ['морков', '🥕'],
  ['pepper', '🫑'], ['перец', '🫑'], ['avocado', '🥑'], ['авокадо', '🥑'], ['aguacate', '🥑'], ['mushroom', '🍄'],
  ['гриб', '🍄'], ['banana', '🍌'], ['банан', '🍌'], ['plátano', '🍌'], ['apple', '🍎'], ['яблок', '🍎'],
  ['manzana', '🍎'], ['orange', '🍊'], ['апельсин', '🍊'], ['мандарин', '🍊'], ['berr', '🫐'], ['ягод', '🫐'],
  ['черник', '🫐'], ['клубник', '🍓'], ['strawberr', '🍓'], ['grape', '🍇'], ['виноград', '🍇'], ['pear', '🍐'],
  ['груш', '🍐'], ['peach', '🍑'], ['персик', '🍑'], ['almond', '🥜'], ['миндал', '🥜'], ['nut', '🥜'],
  ['орех', '🥜'], ['chocolate', '🍫'], ['шоколад', '🍫'], ['cookie', '🍪'], ['печень', '🍪'], ['cake', '🍰'],
  ['торт', '🍰'], ['пирог', '🥧'], ['ice cream', '🍨'], ['морожен', '🍨'], ['honey', '🍯'], ['мёд', '🍯'],
  ['мед', '🍯'], ['soy sauce', '🥢'], ['соев', '🥢'], ['sauce', '🥫'], ['соус', '🥫'], ['oil', '🫒'],
  ['масло', '🧈'], ['butter', '🧈'], ['olive', '🫒'], ['олив', '🫒'], ['hummus', '🧆'], ['хумус', '🧆'],
  ['bean', '🫘'], ['фасол', '🫘'], ['lentil', '🫘'], ['чечевиц', '🫘'], ['tofu', '🫘'], ['тофу', '🫘'],
  ['water', '💧'], ['вода', '💧'], ['juice', '🧃'], ['сок', '🧃'], ['zumo', '🧃'],
]
const SLOT_EMOJI: Record<MealSlot, string> = { breakfast: '🍳', lunch: '🍲', dinner: '🍽️', snack: '🍎' }
/** Matches from the start of a word, so "tea" doesn't find "steak" nor "oil" "boiled". */
function emojiFor(name: string) {
  const words = ' ' + name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' '
  return EMOJI.find(([k]) => words.includes(' ' + k))?.[1] ?? '🍽️'
}

/** A meal's heading gets the emoji of its biggest item, like a chat message would. */
function groupEmoji(slot: MealSlot, meals: Meal[]) {
  const biggest = meals.reduce((a, b) => (b.kcal > a.kcal ? b : a))
  const emoji = emojiFor(biggest.name)
  return emoji === '🍽️' ? SLOT_EMOJI[slot] : emoji
}

const r5 = (n: number) => Math.round(n / 5) * 5
/** Calories as a rough range (±15%), since a logged portion is never exact. */
function kcalRange(kcal: number) {
  const lo = Math.max(0, r5(kcal * 0.85))
  const hi = Math.max(5, r5(kcal * 1.15))
  return lo === hi || lo === 0 ? `≈${fmt(hi)} kcal` : `≈${fmt(lo)}–${fmt(hi)} kcal`
}

const itemText = (m: Meal, kcal: boolean) =>
  `${emojiFor(m.name)} ${m.name}${m.portion ? `, ${m.portion}` : ''}${kcal ? ` — ${kcalRange(m.kcal)}` : ''}`

/** The day as plain text, grouped by meal: what is sent when an image can't be shared. */
export function shareText(meals: Meal[], kcal: boolean) {
  return mealGroups(meals)
    .map((g) => `${groupEmoji(g.slot, g.meals)} ${GROUP_NAMES[g.slot]}\n\n${g.meals.map((m) => '• ' + itemText(m, kcal)).join('\n')}`)
    .join('\n\n')
}

const C = {
  bg: '#EEF1F5', card: '#FFFFFF', ink: '#14161A', muted: '#555B66', burn: '#2A47C9',
  track: '#E1E5EA', green: '#0E8A74', tip: '#E7F0EC', tipInk: '#16372B',
}
const DISPLAY = "'Unbounded Variable', sans-serif"
const BODY = "'Onest Variable', sans-serif"
const W = 1080
const PAD = 64
const LIST_TOP = 290
const CARD_PAD = 44
const HEADING_H = 66
const LINE_H = 46
const ITEM_GAP = 12
const GROUP_GAP = 30
const BULLET_W = 40
const HEADING_FONT = `600 38px ${BODY}`
const ITEM_FONT = `400 32px ${BODY}`

function roundRect(x: CanvasRenderingContext2D, left: number, top: number, w: number, h: number, r: number) {
  x.beginPath()
  x.roundRect(left, top, w, h, r)
}

/** Splits text into lines no wider than `max`, breaking between words (or inside a word too long for a line). */
function wrap(x: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word
    if (x.measureText(next).width <= max) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word
    while (x.measureText(line).width > max && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && x.measureText(line.slice(0, cut)).width > max) cut--
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) lines.push(line)
  return lines
}

function fit(x: CanvasRenderingContext2D, text: string, max: number) {
  if (x.measureText(text).width <= max) return text
  while (text.length > 1 && x.measureText(text + '…').width > max) text = text.slice(0, -1)
  return text + '…'
}

export async function drawShareCard(input: ShareCardInput): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`600 64px ${DISPLAY}`), document.fonts.load(`600 34px ${BODY}`), document.fonts.load(`400 34px ${BODY}`)])
  } catch {
    // Falls back to the system font.
  }
  const { meals, targets, numbers, note } = input
  const kcal = numbers && input.showKcal

  // Lay out the food first, so the picture is as tall as the whole list needs.
  const canvas = document.createElement('canvas')
  canvas.width = W
  const measure = canvas.getContext('2d')!
  measure.font = ITEM_FONT
  const textW = W - 2 * PAD - 2 * CARD_PAD - BULLET_W
  const groups = mealGroups(meals).map((g) => ({
    heading: `${groupEmoji(g.slot, g.meals)} ${GROUP_NAMES[g.slot]}`,
    items: g.meals.map((m) => wrap(measure, itemText(m, kcal), textW)),
  }))
  const groupH = (g: (typeof groups)[number]) =>
    HEADING_H + g.items.reduce((a, lines) => a + lines.length * LINE_H + ITEM_GAP, 0) - ITEM_GAP
  const cardH = 2 * CARD_PAD + groups.reduce((a, g) => a + groupH(g), 0) + (groups.length - 1) * GROUP_GAP
  const listEnd = LIST_TOP + cardH + 40
  const height = Math.max(1350, listEnd + 40 + 4 * 92 + 20 + (input.weekStatus ? 64 : 0) + (note ? 110 : 0) + 110)

  canvas.height = height
  const x = canvas.getContext('2d')!
  x.fillStyle = C.bg
  x.fillRect(0, 0, W, height)

  // Header
  x.textBaseline = 'alphabetic'
  x.fillStyle = C.burn
  x.font = `700 30px ${BODY}`
  x.fillText('FUEL & BURN', PAD, 96)
  x.fillStyle = C.muted
  x.font = `500 30px ${BODY}`
  x.textAlign = 'right'
  x.fillText(input.dateLabel, W - PAD, 96)
  x.textAlign = 'left'
  x.fillStyle = C.ink
  x.font = `600 64px ${DISPLAY}`
  x.fillText(input.isToday ? 'My food today' : 'My food', PAD, 196)
  x.fillStyle = C.muted
  x.font = `400 34px ${BODY}`
  const total = meals.reduce((a, m) => a + m.kcal, 0)
  x.fillText(`${meals.length} ${meals.length === 1 ? 'item' : 'items'}` + (kcal ? ` · ${fmt(total)} kcal` : ''), PAD, 250)

  // Food by meal, every item
  x.fillStyle = C.card
  roundRect(x, PAD, LIST_TOP, W - 2 * PAD, cardH, 32)
  x.fill()
  let top = LIST_TOP + CARD_PAD
  const left = PAD + CARD_PAD
  for (const g of groups) {
    x.fillStyle = C.ink
    x.font = HEADING_FONT
    x.fillText(g.heading, left, top + 40)
    top += HEADING_H
    x.font = ITEM_FONT
    for (const lines of g.items) {
      x.fillStyle = C.muted
      x.fillText('•', left + 6, top + 34)
      x.fillStyle = C.ink
      lines.forEach((line, i) => x.fillText(line, left + BULLET_W, top + 34 + i * LINE_H))
      top += lines.length * LINE_H + ITEM_GAP
    }
    top += GROUP_GAP - ITEM_GAP
  }

  // Macros
  let y = listEnd + 40
  MACROS.forEach(({ key, icon, label }, i) => {
    const value = Math.round(macroSum(meals, key))
    const target = targets[key]
    const done = value >= target
    const top = y + i * 92
    x.fillStyle = C.ink
    x.font = `600 32px ${BODY}`
    x.fillText(`${icon} ${label}`, PAD, top)
    x.textAlign = 'right'
    x.fillStyle = done ? C.green : C.muted
    x.font = `600 30px ${BODY}`
    const status = numbers
      ? value > target
        ? `✓ ${target} g +${value - target} extra`
        : value === target
          ? `✓ ${value} g`
          : `${value} / ${target} g`
      : done
        ? '✓ target reached'
        : 'on the way'
    x.fillText(status, W - PAD, top)
    x.textAlign = 'left'
    x.fillStyle = C.track
    roundRect(x, PAD, top + 20, W - 2 * PAD, 22, 11)
    x.fill()
    x.fillStyle = done ? C.green : C.ink
    roundRect(x, PAD, top + 20, Math.max(22, (W - 2 * PAD) * Math.min(1, value / Math.max(target, 1))), 22, 11)
    x.fill()
  })
  y += 4 * 92 + 20

  // This week's status
  if (input.weekStatus) {
    const pill = 'This week: ' + input.weekStatus
    x.font = `600 32px ${BODY}`
    x.fillStyle = input.weekOnTarget ? C.tip : C.track
    roundRect(x, PAD, y - 4, x.measureText(pill).width + 56, 64, 32)
    x.fill()
    x.fillStyle = input.weekOnTarget ? C.tipInk : C.ink
    x.fillText(pill, PAD + 28, y + 38)
    y += 64
  }
  if (note) {
    x.fillStyle = C.ink
    x.font = `italic 400 34px ${BODY}`
    x.fillText(fit(x, '“' + note + '”', W - 2 * PAD), PAD, y + 66)
  }
  x.fillStyle = C.muted
  x.font = `400 24px ${BODY}`
  x.textAlign = 'right'
  x.fillText('made with Fuel & Burn', W - PAD, height - 40)
  x.textAlign = 'left'
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'))

/** Opens the share menu with the card; on computers without one, downloads it. Returns what happened. */
export async function shareCard(canvas: HTMLCanvasElement, fallbackText: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const file = new File([await toBlob(canvas)], 'fuel-burn-day.png', { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: 'My food today 🍽️' })
      return 'shared'
    }
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text: fallbackText })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled'
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
