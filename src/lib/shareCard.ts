// Draws a day's food as an image to share (WhatsApp and the like). Always light colours,
// since the picture is seen outside the app.
import { fmt, MACROS, macroSum } from './model'
import type { Meal, Targets } from '../types'

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

const EMOJI: [string, string][] = [
  ['avocado', '🥑'], ['salad', '🥗'], ['shake', '🥤'], ['banana', '🍌'], ['coffee', '☕'], ['latte', '☕'],
  ['yogurt', '🥣'], ['croissant', '🥐'], ['oat', '🥣'], ['porridge', '🥣'], ['apple', '🍎'], ['egg', '🍳'],
  ['toast', '🍞'], ['chicken', '🍗'], ['rice', '🍚'], ['pasta', '🍝'], ['salmon', '🐟'], ['sandwich', '🥪'],
  ['bravas', '🥔'], ['fries', '🍟'], ['chips', '🥔'], ['beer', '🍺'], ['wine', '🍷'], ['pizza', '🍕'],
  ['tortilla', '🥘'], ['jam', '🥓'], ['almond', '🥜'], ['nut', '🥜'], ['chocolate', '🍫'], ['soup', '🍲'],
  ['steak', '🥩'], ['tuna', '🐟'], ['cottage', '🥛'],
]
const emojiFor = (name: string) => EMOJI.find(([k]) => name.toLowerCase().includes(k))?.[1] ?? '🍽️'

const C = {
  bg: '#EEF1F5', card: '#FFFFFF', ink: '#14161A', muted: '#555B66', burn: '#2A47C9',
  track: '#E1E5EA', green: '#0E8A74', tip: '#E7F0EC', tipInk: '#16372B',
}
const DISPLAY = "'Unbounded Variable', sans-serif"
const BODY = "'Onest Variable', sans-serif"
const W = 1080
const PAD = 64
const MAX_TILES = 6
const TILE_H = 180
const TILE_GAP = 22

function roundRect(x: CanvasRenderingContext2D, left: number, top: number, w: number, h: number, r: number) {
  x.beginPath()
  x.roundRect(left, top, w, h, r)
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
  const sorted = [...meals].sort((a, b) => a.time.localeCompare(b.time))
  const shown = sorted.slice(0, MAX_TILES)
  const rows = Math.ceil(shown.length / 2)
  const more = sorted.length > MAX_TILES
  const tilesEnd = 290 + rows * (TILE_H + TILE_GAP) + (more ? 60 : 40)
  const height = Math.max(1350, tilesEnd + 40 + 4 * 92 + 20 + (input.weekStatus ? 64 : 0) + (note ? 110 : 0) + 110)

  const canvas = document.createElement('canvas')
  canvas.width = W
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

  // Food tiles, two per row
  const tileW = (W - 2 * PAD - 24) / 2
  shown.forEach((meal, i) => {
    const left = PAD + (i % 2) * (tileW + 24)
    const top = 290 + Math.floor(i / 2) * (TILE_H + TILE_GAP)
    x.fillStyle = C.card
    roundRect(x, left, top, tileW, TILE_H, 32)
    x.fill()
    x.font = '88px sans-serif'
    x.fillText(emojiFor(meal.name), left + 28, top + 118)
    x.fillStyle = C.ink
    x.font = `600 32px ${BODY}`
    const textLeft = left + 150
    const maxW = tileW - 170
    let line1 = ''
    let line2 = ''
    for (const word of meal.name.split(' ')) {
      if (!line2 && x.measureText((line1 + ' ' + word).trim()).width <= maxW) line1 = (line1 + ' ' + word).trim()
      else line2 = (line2 + ' ' + word).trim()
    }
    x.fillText(line1, textLeft, top + (line2 ? 66 : 84))
    if (line2) x.fillText(fit(x, line2, maxW), textLeft, top + 106)
    x.fillStyle = C.muted
    x.font = `400 26px ${BODY}`
    x.fillText(meal.time + (kcal ? ` · ${fmt(meal.kcal)} kcal` : ''), textLeft, top + (line2 ? 148 : 128))
  })
  if (more) {
    x.fillStyle = C.muted
    x.font = `500 28px ${BODY}`
    x.fillText(`+${sorted.length - MAX_TILES} more`, PAD, 290 + rows * (TILE_H + TILE_GAP) + 10)
  }

  // Macros
  let y = tilesEnd + 40
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
