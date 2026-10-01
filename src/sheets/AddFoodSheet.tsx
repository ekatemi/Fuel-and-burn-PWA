import { useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { QuickChips } from '../components/QuickChips'
import { Sheet } from '../components/Sheet'
import { fmt, fmtQty, isKnown, kcalOf, parseFoodText, SIZE_NAMES } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { DraftItem, PortionSize } from '../types'

const SIZES: PortionSize[] = ['S', 'M', 'L']

export function AddFoodSheet() {
  const { state, update, addMeals, removeMeals, closeSheet, showToast } = useApp()
  const [text, setText] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [tried, setTried] = useState(false)

  const known = items.filter(isKnown)
  const total = known.reduce((a, item) => a + kcalOf(item), 0)
  const removeItem = (index: number) => setItems((list) => list.filter((_, i) => i !== index))

  const commit = () => {
    if (!known.length) return
    const ids = addMeals(known)
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
        placeholder="e.g. 2 eggs and toast, a latte"
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
                  <div className="col" style={{ gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {item.qty !== 1 && fmtQty(item.qty) + ' × '}
                      {item.food.name}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {item.food.portion}
                    </span>
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
                <div className="sizes" role="group" aria-label="Portion size">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      aria-pressed={item.size === size}
                      onClick={() => setItems((list) => list.map((it, j) => (j === i ? { ...item, size } : it)))}
                    >
                      {SIZE_NAMES[size]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pitem" key={i}>
                <div className="row center">
                  <span style={{ fontSize: 14 }}>Couldn’t find “{item.raw}”</span>
                  <button className="icon-btn" aria-label="Remove" onClick={() => removeItem(i)}>
                    <CloseIcon />
                  </button>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>
                  Try another word, or pick from My foods below.
                </span>
              </div>
            ),
          )}
        </div>
      )}
      {tried && !items.length && <p>Type something like “half a portion of patatas bravas and 2 beers”.</p>}

      <QuickChips
        onPick={(food) => {
          setItems((list) => [...list, { food, qty: 1, size: 'M' }])
          setTried(true)
        }}
      />

      <button className="bigbtn primary" disabled={!known.length} onClick={commit}>
        {known.length && state.numbers ? `Add ${fmt(total)} kcal` : 'Add to today'}
      </button>
      <p className="muted fine">A simple built-in parser stands in for AI recognition.</p>
    </Sheet>
  )
}
