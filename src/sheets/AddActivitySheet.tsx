import { useState, type FormEvent } from 'react'
import { Sheet } from '../components/Sheet'
import { activityBurn, MET, type Activity as ActivityInput, type OtherType, type Pace as WalkPace } from '../lib/activity'
import { OTHER_LABELS, WALK_PACES } from '../lib/activityLabels'
import { fmt, nowTime } from '../lib/model'
import { useApp } from '../state/AppContext'

type Kind = ActivityInput['kind']

const KINDS: [Kind, string][] = [
  ['steps', 'Steps'],
  ['walk', 'Walk'],
  ['run', 'Run'],
  ['other', 'Other'],
]
const DEFAULT_SPEED: Record<'walk' | 'run', string> = { walk: '5', run: '9' }
const toNumber = (value: string) => parseFloat(value.replace(',', '.'))

export function AddActivitySheet() {
  const { state, today, bodyWeight, bodyFatPct, update, closeSheet, showToast } = useApp()
  const [kind, setKind] = useState<Kind>('steps')
  const [steps, setSteps] = useState('')
  const [pace, setPace] = useState<WalkPace>('normal')
  const [minutes, setMinutes] = useState('')
  const [speed, setSpeed] = useState(DEFAULT_SPEED.walk)
  const [type, setType] = useState<OtherType>('strength_moderate')
  const [error, setError] = useState('')

  // The entered activity, or a message saying what is missing.
  const parsed = ((): ActivityInput | string => {
    if (kind === 'steps') {
      const n = Math.round(toNumber(steps))
      return n >= 1 && n <= 100_000 ? { kind, steps: n, pace } : 'Enter your steps, e.g. 8000.'
    }
    const min = Math.round(toNumber(minutes))
    if (!(min >= 1 && min <= 600)) return 'Enter how many minutes, e.g. 30.'
    if (kind === 'other') return { kind, type, minutes: min }
    const kmh = toNumber(speed)
    const [lo, hi] = kind === 'walk' ? [1, 9] : [4, 25]
    return kmh >= lo && kmh <= hi ? { kind, minutes: min, speedKmh: kmh } : `Enter a speed between ${lo} and ${hi} km/h.`
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
        <div className="seg full" role="radiogroup" aria-label="Kind of activity">
          {KINDS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                if (k === 'walk' || k === 'run') setSpeed(DEFAULT_SPEED[k])
                setError('')
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === 'steps' && (
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

        {kind === 'other' && (
          <label className="fld">
            <span>Activity</span>
            <select value={type} onChange={(e) => setType(e.target.value as OtherType)}>
              {(Object.keys(MET) as OtherType[]).map((t) => (
                <option key={t} value={t}>
                  {OTHER_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind !== 'steps' && (
          <div className="grid2">
            <label className="fld">
              <span>Minutes</span>
              <input type="number" inputMode="numeric" min={0} placeholder="e.g. 30" value={minutes} onChange={(e) => change(setMinutes)(e.target.value)} />
            </label>
            {kind !== 'other' && (
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
                  {kind === 'steps' ? ` · about ${burn.minutes} min` : ''}
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
      </form>
    </Sheet>
  )
}
