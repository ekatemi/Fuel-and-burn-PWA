import { useState, type FormEvent } from 'react'
import { Sheet } from '../components/Sheet'
import { activityBurn, MET, type Activity as ActivityInput, type OtherType, type Pace as WalkPace } from '../lib/activity'
import {
  ACTIVITY_GROUPS,
  ALL_SHORTCUTS,
  isCalisthenics,
  optionLabel,
  SHORTCUT_LABELS,
  shortcutsFrom,
  WALK_PACES,
  type Shortcut,
} from '../lib/activityLabels'
import { fmt, nowTime } from '../lib/model'
import { useApp } from '../state/AppContext'

const DEFAULT_SPEED: Record<'walk' | 'run', string> = { walk: '5', run: '9' }
const TYPES = Object.keys(MET) as OtherType[]
const toNumber = (value: string) => parseFloat(value.replace(',', '.'))
const isMovement = (c: Shortcut): c is 'steps' | 'walk' | 'run' => c === 'steps' || c === 'walk' || c === 'run'

export function AddActivitySheet() {
  const { state, today, bodyWeight, bodyFatPct, update, closeSheet, showToast } = useApp()
  const shortcuts = shortcutsFrom(state.activityShortcuts)
  const [picked, setPicked] = useState<Shortcut>(shortcuts[0])
  // Editing replaces the selected button with one picked from a list.
  const [editing, setEditing] = useState(false)
  const [steps, setSteps] = useState('')
  const [pace, setPace] = useState<WalkPace>('normal')
  const [minutes, setMinutes] = useState('')
  const [speed, setSpeed] = useState(DEFAULT_SPEED.walk)
  const [type, setType] = useState<OtherType>('strength_moderate')
  const [error, setError] = useState('')

  // If the picked button was just replaced, fall back to the first one.
  const choice: Shortcut = shortcuts.includes(picked) ? picked : shortcuts[0]
  // Types offered for the current choice: one group, or everything under "Other".
  const types = choice === 'other' ? TYPES : isMovement(choice) ? [] : ACTIVITY_GROUPS[choice].types
  const activeType: OtherType = types.includes(type) ? type : types[0]

  const pick = (c: Shortcut) => {
    setPicked(c)
    if (c === 'walk' || c === 'run') setSpeed(DEFAULT_SPEED[c])
    setError('')
  }

  const replaceSelected = (next: Shortcut) => {
    update((s) => ({ ...s, activityShortcuts: shortcutsFrom(s.activityShortcuts).map((sc) => (sc === choice ? next : sc)) }))
    setEditing(false)
    pick(next)
  }

  // The entered activity, or a message saying what is missing.
  const parsed = ((): ActivityInput | string => {
    if (choice === 'steps') {
      const n = Math.round(toNumber(steps))
      return n >= 1 && n <= 100_000 ? { kind: 'steps', steps: n, pace } : 'Enter your steps, e.g. 8000.'
    }
    const min = Math.round(toNumber(minutes))
    if (!(min >= 1 && min <= 600)) return 'Enter how many minutes, e.g. 30.'
    if (!isMovement(choice)) return { kind: 'other', type: activeType, minutes: min }
    const kmh = toNumber(speed)
    const [lo, hi] = choice === 'walk' ? [1, 9] : [4, 25]
    return kmh >= lo && kmh <= hi ? { kind: choice, minutes: min, speedKmh: kmh } : `Enter a speed between ${lo} and ${hi} km/h.`
  })()

  const profile = state.profile
  const burn =
    profile && typeof parsed !== 'string'
      ? activityBurn({ sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: bodyWeight, bodyFatPct: bodyFatPct ?? undefined }, parsed)
      : null

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (typeof parsed === 'string' || !burn) return setError(typeof parsed === 'string' ? parsed : 'Set up your profile first.')
    const id = state.nextId
    update((s) => ({
      ...s,
      nextId: s.nextId + 1,
      activities: [...s.activities, { id, date: today, time: nowTime(), input: parsed, burn }],
    }))
    closeSheet()
    showToast('Activity added', () => update((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) })))
  }

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setError('')
  }

  return (
    <Sheet title="Add activity">
      <form className="col" style={{ gap: 14 }} onSubmit={save} noValidate>
        <div className="col" style={{ gap: 4 }}>
          <div className={editing ? 'seg full editing' : 'seg full'} role="radiogroup" aria-label="Kind of activity">
            {shortcuts.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={choice === c} onClick={() => pick(c)}>
                {SHORTCUT_LABELS[c]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tbtn link"
            style={{ alignSelf: 'flex-end' }}
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing && (
          <div className="col" style={{ gap: 8 }}>
            <span className="h">Replace {SHORTCUT_LABELS[choice]} with</span>
            <div className="list">
              {ALL_SHORTCUTS.map((option) => {
                const current = option === choice
                const inUse = !current && shortcuts.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    className="item pick"
                    disabled={current || inUse}
                    onClick={() => replaceSelected(option)}
                  >
                    <span className="main">
                      <span className="nm">{SHORTCUT_LABELS[option]}</span>
                      {option === 'other' && <span className="pt">Lists every activity</span>}
                    </span>
                    {(current || inUse) && <span className="muted" style={{ fontSize: 13 }}>{current ? 'this button' : 'in use'}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!editing && (
          <>
            {choice === 'steps' && (
              <>
                <label className="fld">
                  <span>Steps</span>
                  <input type="number" inputMode="numeric" min={0} placeholder="e.g. 8000" autoFocus value={steps} onChange={(e) => change(setSteps)(e.target.value)} />
                </label>
                <div className="col" style={{ gap: 8 }}>
                  <span className="h" style={{ fontSize: 13 }}>
                    Usual pace
                  </span>
                  <div className="seg full three" role="radiogroup" aria-label="Walking pace">
                    {WALK_PACES.map(([p, label]) => (
                      <button key={p} type="button" role="radio" aria-checked={pace === p} onClick={() => setPace(p)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {types.length > 1 && (
              <label className="fld">
                <span>{choice === 'other' ? 'Activity' : 'Type'}</span>
                <select value={activeType} onChange={(e) => setType(e.target.value as OtherType)}>
                  {choice === 'other' ? (
                    [
                      { label: 'Calisthenics', types: TYPES.filter(isCalisthenics) },
                      { label: 'Other activities', types: TYPES.filter((t) => !isCalisthenics(t)) },
                    ].map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.types.map((t) => (
                          <option key={t} value={t}>
                            {optionLabel(t)}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    types.map((t) => (
                      <option key={t} value={t}>
                        {optionLabel(t)}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}

            {choice !== 'steps' && (
              <div className="grid2">
                <label className="fld">
                  <span>Minutes</span>
                  <input type="number" inputMode="numeric" min={0} placeholder="e.g. 30" value={minutes} onChange={(e) => change(setMinutes)(e.target.value)} />
                </label>
                {isMovement(choice) && (
                  <label className="fld">
                    <span>Speed, km/h</span>
                    <input type="number" inputMode="decimal" min={0} value={speed} onChange={(e) => change(setSpeed)(e.target.value)} />
                  </label>
                )}
              </div>
            )}

            {burn && (
              <div className="card inset" aria-live="polite">
                {state.numbers ? (
                  <>
                    <div className="headline" style={{ fontSize: 22 }}>
                      ~{fmt(burn.kcal)}
                      <small>kcal above resting</small>
                    </div>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Likely {fmt(burn.low)}–{fmt(burn.high)}
                      {burn.distanceKm ? ` · ${burn.distanceKm.toFixed(1)} km` : ''}
                      {choice === 'steps' ? ` · about ${burn.minutes} min` : ''}
                    </span>
                  </>
                ) : (
                  <span className="h">Ready to add</span>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="bigbtn primary" type="submit">
              Add activity
            </button>
          </>
        )}
      </form>
    </Sheet>
  )
}
