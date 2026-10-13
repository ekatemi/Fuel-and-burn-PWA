import { useEffect, useRef, useState } from 'react'
import { CameraIcon, CloseIcon, MicIcon, StopIcon } from '../components/Icons'
import { QuickChips } from '../components/QuickChips'
import { Sheet } from '../components/Sheet'
import { AiError, aiAvailable, recognizeFood, transcribeSpeech } from '../lib/aiFood'
import { dbItem, loadFoodDb, nameOf, type DbFood, type FoodDb } from '../lib/foodDb'
import { combineDish, fmt, fmtQty, groupItems, isKnown, itemsToLog, kcalOf, MEAL_SLOTS, unmatchedDishes, nowTime, SIZE_NAMES, slotForTime, SLOT_NAMES, SUSPICIOUS_KCAL } from '../lib/model'
import { parseFoodText } from '../lib/parseFood'
import { shrinkPhoto } from '../lib/photo'
import { canRecord, startRecording, type Recording } from '../lib/recorder'
import { useApp } from '../state/AppContext'
import type { DraftItem, KnownItem, MealSlot, PortionSize } from '../types'

const SIZES: PortionSize[] = ['S', 'M', 'L']
const MIN_SEARCH = 2
const SEARCH_RESULTS = 8
const SUGGESTIONS = 3
/** A voice note stops by itself after this long. */
const MAX_VOICE_SECONDS = 30

/** Same item with a new weight or volume. */
function withAmount(item: KnownItem, value: number): KnownItem {
  if (!item.amount) return item
  return { ...item, amount: { ...item.amount, value }, qty: value / (item.portionGrams ?? 100) }
}

function DbResult({ food, numbers, onPick }: { food: DbFood; numbers: boolean; onPick: () => void }) {
  return (
    <button type="button" className="item pick" onClick={onPick}>
      <span className="main">
        <span className="nm">{nameOf(food)}</span>
        <span className="pt">
          {food.group}
          {numbers && ` · ${food.kcal} kcal per 100 g`}
        </span>
      </span>
    </button>
  )
}

export function AddFoodSheet() {
  const { state, update, today, diaryDate, addMeals, removeMeals, closeSheet, showToast, addSlot } = useApp()
  // Opened from the diary, food goes to the day being viewed; anywhere else, to today.
  const date = state.view === 'fuel' ? diaryDate : today
  const [slot, setSlot] = useState<MealSlot>(() => addSlot ?? slotForTime(nowTime()))
  const [text, setText] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [tried, setTried] = useState(false)
  const [search, setSearch] = useState('')
  const [db, setDb] = useState<FoodDb | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [voice, setVoice] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [seconds, setSeconds] = useState(0)
  const recording = useRef<Recording | null>(null)
  /** The meal photo, made small, as a data URL. It is sent for recognition and not kept. */
  const [photo, setPhoto] = useState<string | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  // Closing the sheet mid-recording turns the microphone off.
  useEffect(() => () => recording.current?.cancel(), [])

  useEffect(() => {
    if (voice !== 'recording') return
    const timer = window.setInterval(() => setSeconds((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [voice])

  useEffect(() => {
    let cancelled = false
    loadFoodDb().then((loaded) => !cancelled && setDb(loaded))
    return () => {
      cancelled = true
    }
  }, [])

  // What will be logged: each dish as one entry.
  const known = itemsToLog(items)
  const unmatched = unmatchedDishes(items)
  const total = known.reduce((a, item) => a + kcalOf(item), 0)
  const removeItem = (index: number) => setItems((list) => list.filter((_, i) => i !== index))
  const replaceItem = (index: number, next: DraftItem) => setItems((list) => list.map((it, i) => (i === index ? next : it)))
  const results = db && search.trim().length >= MIN_SEARCH ? db.search(search, SEARCH_RESULTS) : []

  const aiFailed = (e: unknown) =>
    e instanceof AiError && e.reason === 'rate_limited'
      ? 'Smart recognition is resting for today.'
      : 'Couldn’t reach smart recognition.'

  /** AI reads the whole text, so a dish stays one dish; with a photo, the text is a note about it.
   *  Without AI, or when it can't be reached, the on-device parser reads the text. */
  const recognize = async (input = text, image = photo) => {
    setTried(true)
    setAiNote('')
    if (!aiAvailable()) {
      setItems(parseFoodText(input))
      return
    }
    setRecognizing(true)
    try {
      const recognized = await recognizeFood(input.trim(), db ?? (await loadFoodDb()), image ?? undefined)
      setItems(recognized)
      if (!recognized.length) {
        setAiNote(image ? 'Couldn’t see food in this photo. Add a note about it, or type what you ate.' : '')
      }
    } catch (e) {
      if (image) {
        setAiNote(aiFailed(e) + ' You can type instead.')
      } else {
        setItems(parseFoodText(input))
        setAiNote(aiFailed(e) + ' Pick matches below.')
      }
    } finally {
      setRecognizing(false)
    }
  }

  const stopVoice = async () => {
    const current = recording.current
    if (!current) return
    recording.current = null
    setVoice('transcribing')
    try {
      const spoken = await transcribeSpeech(await current.stop())
      if (!spoken) {
        setAiNote('Didn’t catch that. Try again a little closer to the phone.')
        return
      }
      // Speaking adds to what is already typed, then recognizes it all.
      const next = text.trim() ? `${text.trim()}, ${spoken}` : spoken
      setText(next)
      await recognize(next)
    } catch (e) {
      setAiNote(aiFailed(e) + ' You can type instead.')
    } finally {
      setVoice('idle')
    }
  }

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    let image: string
    try {
      image = await shrinkPhoto(file)
    } catch {
      setAiNote('Couldn’t open this photo. Try another one.')
      return
    }
    setPhoto(image)
    await recognize(text, image)
  }

  const startVoice = async () => {
    setAiNote('')
    try {
      recording.current = await startRecording()
      setSeconds(0)
      setVoice('recording')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setAiNote(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'The microphone is off for this app. Allow it in your browser’s site settings, or type instead.'
          : name === 'NotFoundError'
            ? 'No microphone found. You can type instead.'
            : `Couldn’t start the microphone${name ? ` (${name})` : ''}. You can type instead.`,
      )
    }
  }

  // The time limit stops a forgotten recording.
  useEffect(() => {
    if (voice === 'recording' && seconds >= MAX_VOICE_SECONDS) stopVoice()
  })

  /** One item: a known food with its amount or size, or an unknown one with matches to pick.
   *  `part` when it is an ingredient inside a dish. */
  const itemBody = (item: DraftItem, i: number, part = false) => {
    if (isKnown(item)) {
      return (
        <>
          <div className="row center">
            <div className="col" style={{ gap: 2, minWidth: 0 }}>
              <span style={part ? { fontSize: 14 } : { fontSize: 15, fontWeight: 600 }}>
                {item.qty !== 1 && !item.amount && fmtQty(item.qty) + ' × '}
                {item.food.name}
              </span>
              {!item.amount && (
                <span className="muted" style={{ fontSize: 12 }}>
                  {item.food.portion}
                </span>
              )}
            </div>
            <div className="row center" style={{ gap: 4 }}>
              {state.numbers && !part && (
                <span className="num" style={{ fontSize: 15 }}>
                  {fmt(kcalOf(item))}
                </span>
              )}
              <button className="icon-btn" aria-label={`Remove ${item.food.name}`} onClick={() => removeItem(i)}>
                <CloseIcon />
              </button>
            </div>
          </div>
          {item.amount ? (
            <label className="amount">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                aria-label={`Amount of ${item.food.name}`}
                value={Math.round(item.amount.value) || ''}
                onChange={(e) => replaceItem(i, withAmount(item, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
              <span>{item.amount.unit}</span>
            </label>
          ) : (
            <div className="sizes" role="group" aria-label="Portion size">
              {SIZES.map((size) => (
                <button key={size} aria-pressed={item.size === size} onClick={() => replaceItem(i, { ...item, size })}>
                  {SIZE_NAMES[size]}
                </button>
              ))}
            </div>
          )}
          {kcalOf(item) > SUSPICIOUS_KCAL && (
            <span className="error" style={{ fontSize: 13 }}>
              That’s a lot for one item. Check the amount.
            </span>
          )}
        </>
      )
    }
    const matches = db && item.query ? db.search(item.query, SUGGESTIONS) : []
    return (
      <>
        <div className="row center">
          <span style={{ fontSize: 14 }}>{part ? `“${item.raw}”` : `Not in the quick list: “${item.raw}”`}</span>
          <button className="icon-btn" aria-label={`Remove ${item.raw}`} onClick={() => removeItem(i)}>
            <CloseIcon />
          </button>
        </div>
        {!db ? (
          <span className="muted" style={{ fontSize: 12 }}>
            Looking it up…
          </span>
        ) : !matches.length ? (
          <span className="muted" style={{ fontSize: 12 }}>
            Not found. Try other words in the search below.
          </span>
        ) : (
          <>
            <span className="muted" style={{ fontSize: 12 }}>
              Pick a match{item.amount ? '' : ', then set the amount'}:
            </span>
            <div className="list inset-list">
              {matches.map((food) => (
                <DbResult
                  key={food.id}
                  food={food}
                  numbers={state.numbers}
                  onPick={() => replaceItem(i, { ...dbItem(food, item.amount), dish: item.dish })}
                />
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const commit = () => {
    if (!known.length || unmatched.length) return
    const ids = addMeals(known, date, slot)
    closeSheet()
    if (state.view !== 'fuel') update((s) => ({ ...s, view: 'today' }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const where = `Added to ${SLOT_NAMES[slot].toLowerCase()}: `
    showToast(where + (known.length === 1 ? known[0].food.name : `${known.length} items`), () => removeMeals(ids))
  }

  return (
    <Sheet title="Add food">
      <label htmlFor="desc" className="h">
        Describe what you ate
      </label>
      <textarea
        id="desc"
        autoFocus
        placeholder="e.g. 2 eggs and toast, 150 g salmon. Any language."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {photo && (
        <div className="photo-note">
          <img src={photo} alt="Your meal" />
          <span className="muted">The text above is sent as a note about the photo.</span>
          <button className="icon-btn" aria-label="Remove photo" disabled={recognizing} onClick={() => setPhoto(null)}>
            <CloseIcon />
          </button>
        </div>
      )}
      {aiAvailable() && (
        <div className="row center" style={{ gap: 8 }}>
          {canRecord() && (
            <button
              className={'bigbtn secondary voice' + (voice === 'recording' ? ' on' : '')}
              style={{ flex: 1 }}
              disabled={voice === 'transcribing' || recognizing}
              aria-label={voice === 'recording' ? 'Stop and use what I said' : 'Speak what you ate'}
              onClick={voice === 'recording' ? stopVoice : startVoice}
            >
              {voice === 'recording' ? <StopIcon /> : <MicIcon />}
              {voice === 'recording' ? `Stop 0:${String(seconds).padStart(2, '0')}` : voice === 'transcribing' ? 'Listening…' : 'Speak'}
            </button>
          )}
          <button
            className="bigbtn secondary voice"
            style={{ flex: 1 }}
            disabled={recognizing || voice !== 'idle'}
            aria-label="Take a photo of your meal"
            onClick={() => cameraInput.current?.click()}
          >
            <CameraIcon />
            Camera
          </button>
        </div>
      )}
      {aiAvailable() && (
        <button className="tbtn gallery" disabled={recognizing || voice !== 'idle'} onClick={() => galleryInput.current?.click()}>
          or pick a photo from your gallery
        </button>
      )}
      {/* capture opens the phone's camera straight away; without it the phone offers the photo library. */}
      {[cameraInput, galleryInput].map((ref, i) => (
        <input
          key={i}
          ref={ref}
          type="file"
          accept="image/*"
          capture={ref === cameraInput ? 'environment' : undefined}
          hidden
          onChange={(e) => {
            pickPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      ))}
      <button
        className="bigbtn secondary"
        disabled={recognizing || voice !== 'idle' || (!text.trim() && !photo)}
        onClick={() => recognize()}
      >
        {recognizing ? 'Recognizing…' : 'Recognize'}
      </button>
      {aiNote && (
        <span className="muted" style={{ fontSize: 13 }}>
          {aiNote}
        </span>
      )}

      {items.length > 0 && (
        <div className="parsed" aria-live="polite">
          {groupItems(items).map(({ dish, indices }) => {
            if (!dish) {
              return (
                <div className="pitem" key={indices[0]}>
                  {itemBody(items[indices[0]], indices[0])}
                </div>
              )
            }
            const parts = indices.map((i) => items[i]).filter(isKnown)
            return (
              <div className="pitem" key={indices[0]}>
                <div className="row center">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{dish}</span>
                  <div className="row center" style={{ gap: 4 }}>
                    {state.numbers && parts.length > 0 && (
                      <span className="num" style={{ fontSize: 15 }}>
                        {fmt(kcalOf(combineDish(dish, parts)))}
                      </span>
                    )}
                    <button
                      className="icon-btn"
                      aria-label={`Remove ${dish}`}
                      onClick={() => setItems((list) => list.filter((_, i) => !indices.includes(i)))}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                {indices.map((i) => (
                  <div className="part" key={i}>
                    {itemBody(items[i], i, true)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {tried && !items.length && !photo && <p>Type something like “half a portion of patatas bravas and 2 beers”.</p>}

      <div className="col" style={{ gap: 8 }}>
        <label htmlFor="food-search" className="h">
          Search all foods
        </label>
        <input
          id="food-search"
          className="search"
          type="search"
          autoComplete="off"
          placeholder="e.g. chicken breast, gazpacho"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.trim().length >= MIN_SEARCH &&
          (results.length ? (
            <div className="list inset-list">
              {results.map((food) => (
                <DbResult
                  key={food.id}
                  food={food}
                  numbers={state.numbers}
                  onPick={() => {
                    setItems((list) => [...list, dbItem(food)])
                    setSearch('')
                    setTried(true)
                  }}
                />
              ))}
            </div>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              {db ? 'Nothing found. Try a simpler word, like “chicken” or “apple”.' : 'Loading foods…'}
            </span>
          ))}
      </div>

      <QuickChips
        onPick={(food) => {
          setItems((list) => [...list, { food, qty: 1, size: 'M' }])
          setTried(true)
        }}
      />

      <span className="h" id="meal-label">
        Meal
      </span>
      <div className="sizes slots" role="group" aria-labelledby="meal-label">
        {MEAL_SLOTS.map((s) => (
          <button key={s} aria-pressed={slot === s} onClick={() => setSlot(s)}>
            {SLOT_NAMES[s]}
          </button>
        ))}
      </div>
      {unmatched.length > 0 && (
        <span className="muted" style={{ fontSize: 13 }}>
          Pick a match for each part of “{unmatched[0]}”, or remove the parts you can’t find.
        </span>
      )}
      <button className="bigbtn primary" disabled={!known.length || unmatched.length > 0} onClick={commit}>
        {known.length && state.numbers
          ? `Add ${fmt(total)} kcal to ${SLOT_NAMES[slot].toLowerCase()}`
          : `Add to ${SLOT_NAMES[slot].toLowerCase()}`}
      </button>
      <p className="muted fine">Food data: ANSES-CIQUAL 2020 food composition table, Licence Ouverte.</p>
    </Sheet>
  )
}
