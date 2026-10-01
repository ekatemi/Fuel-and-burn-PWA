import { goalRange, GOALS } from '../lib/model'
import type { Goal, GoalType, Pace } from '../types'

const TYPES: [GoalType, string][] = [
  ['cut', '↓'],
  ['maintain', '='],
  ['gain', '↑'],
]
const PACES: [Pace, string][] = [
  ['gentle', 'Gentle'],
  ['steady', 'Steady'],
]
const pct = (p: number) => Math.round(Math.abs(p) * 100)

export function GoalPicker({ goal, onChange }: { goal: Goal; onChange: (goal: Goal) => void }) {
  const [lo, hi] = goalRange(goal)
  const paceText =
    goal.type === 'cut'
      ? `${pct(hi)}–${pct(lo)}% below maintenance. ` +
        (goal.pace === 'steady'
          ? 'The fastest pace we offer; bigger cuts cost muscle and are hard to keep up.'
          : 'Easy to stick with and best for keeping muscle.')
      : goal.type === 'gain'
        ? `${pct(lo)}–${pct(hi)}% above maintenance. ` +
          (goal.pace === 'steady'
            ? 'A bit faster, with some extra fat gain along the way.'
            : 'Slow and lean, mostly muscle if you train.')
        : 'Within about 5% of maintenance.'

  return (
    <>
      <div role="radiogroup" aria-label="Goal" className="col" style={{ gap: 8 }}>
        {TYPES.map(([type, icon]) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={goal.type === type}
            className="gcard"
            onClick={() => onChange({ ...goal, type })}
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

      {goal.type !== 'maintain' ? (
        <div className="col" style={{ gap: 8 }}>
          <span className="h">Pace</span>
          <div className="seg full two" role="radiogroup" aria-label="Pace">
            {PACES.map(([pace, label]) => (
              <button
                key={pace}
                type="button"
                role="radio"
                aria-checked={goal.pace === pace}
                onClick={() => onChange({ ...goal, pace })}
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
    </>
  )
}

const KCAL_PER_KG = 7700

/** Expected weekly weight change at this goal, as a sentence. */
export function goalChangeText(goal: Goal, maint: number) {
  const [lo, hi] = goalRange(goal)
  const kgPerWeek = (p: number) => Math.abs((maint * p * 7) / KCAL_PER_KG).toFixed(1)
  return goal.type === 'maintain'
    ? 'Weight stays roughly the same'
    : goal.type === 'cut'
      ? `Expected change: about −${kgPerWeek(hi)}–${kgPerWeek(lo)} kg a week`
      : `Expected change: about +${kgPerWeek(lo)}–${kgPerWeek(hi)} kg a week`
}
