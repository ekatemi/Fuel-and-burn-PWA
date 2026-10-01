import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { MAINT } from '../data/demo'
import { fmt, goalIntake, goalLabel, goalRange, GOALS } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { Goal, GoalType, Pace } from '../types'

const KCAL_PER_KG = 7700
const TYPES: [GoalType, string][] = [
  ['cut', '↓'],
  ['maintain', '='],
  ['gain', '↑'],
]
const PACES: [Pace, string][] = [
  ['gentle', 'Gentle'],
  ['steady', 'Steady'],
]

export function GoalSheet() {
  const { state, update, closeSheet, showToast } = useApp()
  const [draft, setDraft] = useState<Goal>(state.goal)
  const [lo, hi] = goalRange(draft)
  const [intakeLo, intakeHi] = goalIntake(MAINT, draft)
  const pct = (p: number) => Math.round(Math.abs(p) * 100)
  const kgPerWeek = (p: number) => Math.abs((MAINT * p * 7) / KCAL_PER_KG).toFixed(1)

  const paceText =
    draft.type === 'cut'
      ? `${pct(hi)}–${pct(lo)}% below maintenance. ` +
        (draft.pace === 'steady'
          ? 'The fastest pace we offer; bigger cuts cost muscle and are hard to keep up.'
          : 'Easy to stick with and best for keeping muscle.')
      : draft.type === 'gain'
        ? `${pct(lo)}–${pct(hi)}% above maintenance. ` +
          (draft.pace === 'steady'
            ? 'A bit faster, with some extra fat gain along the way.'
            : 'Slow and lean, mostly muscle if you train.')
        : 'Within about 5% of maintenance.'

  const change =
    draft.type === 'maintain'
      ? 'Weight stays roughly the same'
      : draft.type === 'cut'
        ? `Expected change: about −${kgPerWeek(hi)}–${kgPerWeek(lo)} kg a week`
        : `Expected change: about +${kgPerWeek(lo)}–${kgPerWeek(hi)} kg a week`

  const save = () => {
    update((s) => ({ ...s, goal: draft }))
    closeSheet()
    showToast('Goal saved: ' + goalLabel(draft))
  }

  return (
    <Sheet title="Your goal">
      <div role="radiogroup" aria-label="Goal" className="col" style={{ gap: 8 }}>
        {TYPES.map(([type, icon]) => (
          <button
            key={type}
            role="radio"
            aria-checked={draft.type === type}
            className="gcard"
            onClick={() => setDraft((d) => ({ ...d, type }))}
          >
            <span className="gic" aria-hidden="true">
              {icon}
            </span>
            <span className="col" style={{ gap: 2, textAlign: 'left' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{GOALS[type].name}</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {GOALS[type].desc}
              </span>
            </span>
          </button>
        ))}
      </div>

      {draft.type !== 'maintain' ? (
        <div className="col" style={{ gap: 8 }}>
          <span className="h">Pace</span>
          <div className="seg full two" role="radiogroup" aria-label="Pace">
            {PACES.map(([pace, label]) => (
              <button
                key={pace}
                role="radio"
                aria-checked={draft.pace === pace}
                onClick={() => setDraft((d) => ({ ...d, pace }))}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 13 }}>{paceText}</p>
        </div>
      ) : (
        <p style={{ fontSize: 13 }}>{paceText}</p>
      )}

      <div className="card inset">
        <span className="muted" style={{ fontSize: 13 }}>
          With your maintenance of ~{fmt(MAINT)}
        </span>
        <div className="headline" style={{ fontSize: 22 }}>
          {state.numbers ? (
            <>
              Eat about {fmt(intakeLo)}–{fmt(intakeHi)}
              <small>kcal a day</small>
            </>
          ) : (
            GOALS[draft.type].name
          )}
        </div>
        <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{change}</span>
      </div>
      <button className="bigbtn primary" onClick={save}>
        Save goal
      </button>
    </Sheet>
  )
}
