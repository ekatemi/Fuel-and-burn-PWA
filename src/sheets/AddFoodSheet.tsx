import { useEffect, useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { QuickChips } from '../components/QuickChips'
import { Sheet } from '../components/Sheet'
import { dbItem, loadFoodDb, nameOf, type DbFood, type FoodDb } from '../lib/foodDb'
import { fmt, fmtQty, isKnown, kcalOf, SIZE_NAMES, SUSPICIOUS_KCAL } from '../lib/model'
import { parseFoodText } from '../lib/parseFood'
import { useApp } from '../state/AppContext'
import type { DraftItem, KnownItem, PortionSize } from '../types'

const SIZES: PortionSize[] = ['S', 'M', 'L']
const MIN_SEARCH = 2
const SEARCH_RESULTS = 8
const SUGGESTIONS = 3

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
  const { state, update, today, diaryDate, addMeals, removeMeals, closeSheet, showToast } = useApp()
  // Opened from the diary, food goes to the day being viewed; anywhere else, to today.
  const date = state.view === 'fuel' ? diaryDate : today
  const [text, setText] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [tried, setTried] = useState(false)
  const [search, setSearch] = useState('')
  const [db, setDb] = useState<FoodDb | null>(null)

  useEffect(() => {
    let cancelled = false
    loadFoodDb().then((loaded) => !cancelled && setDb(loaded))
    return () => {
      cancelled = true
    }
  }, [])

  const known = items.filter(isKnown)
  const total = known.reduce((a, item) => a + kcalOf(item), 0)
  const removeItem = (index: number) => setItems((list) => list.filter((_, i) => i !== index))
  const replaceItem = (index: number, next: DraftItem) => setItems((list) => list.map((it, i) => (i === index ? next : it)))
  const results = db && search.trim().length >= MIN_SEARCH ? db.search(search, SEARCH_RESULTS) : []

  const commit = () => {
    if (!known.length) return
    const ids = addMeals(known, date)
    closeSheet()
    if (state.view !== 'fuel') update((s) => ({ ...s, view: 'today' }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showToast(known.length === 1 ? 'Added ' + known[0].food.name : `Added ${known.length} items`, () =>
      removeMeals(ids),
    )
  }

  return (
    <Sheet title="Add food">
      <label htmlFor="desc" className="h">
        Describe what you ate
      </label>
      <textarea
        id="desc"
        autoFocus
        placeholder="e.g. 2 eggs and toast, 150 g salmon"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="bigbtn secondary"
        onClick={() => {
          setItems(parseFoodText(text))
          setTried(true)
        }}
      >
        Recognize
      </button>

      {items.length > 0 && (
        <div className="parsed" aria-live="polite">
          {items.map((item, i) =>
            isKnown(item) ? (
              <div className="pitem" key={i}>
                <div className="row center">
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
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
                    {state.numbers && (
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
              </div>
            ) : (
              <div className="pitem" key={i}>
                <div className="row center">
                  <span style={{ fontSize: 14 }}>Not in the quick list: “{item.raw}”</span>
                  <button className="icon-btn" aria-label="Remove" onClick={() => removeItem(i)}>
                    <CloseIcon />
                  </button>
                </div>
                {(() => {
                  if (!db) return <span className="muted" style={{ fontSize: 12 }}>Looking it up…</span>
                  const matches = item.query ? db.search(item.query, SUGGESTIONS) : []
                  if (!matches.length) {
                    return (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Not found. Try other words in the search below.
                      </span>
                    )
                  }
                  return (
                    <>
                      <span className="muted" style={{ fontSize: 12 }}>
                        Pick a match{item.amount ? '' : ', then set the amount'}:
                      </span>
                      <div className="list inset-list">
                        {matches.map((food) => (
                          <DbResult key={food.id} food={food} numbers={state.numbers} onPick={() => replaceItem(i, dbItem(food, item.amount))} />
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            ),
          )}
        </div>
      )}
      {tried && !items.length && <p>Type something like “half a portion of patatas bravas and 2 beers”.</p>}

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

      <button className="bigbtn primary" disabled={!known.length} onClick={commit}>
        {known.length && state.numbers ? `Add ${fmt(total)} kcal` : date === today ? 'Add to today' : 'Add to this day'}
      </button>
      <p className="muted fine">Food data: ANSES-CIQUAL 2020 food composition table, Licence Ouverte.</p>
    </Sheet>
  )
}
