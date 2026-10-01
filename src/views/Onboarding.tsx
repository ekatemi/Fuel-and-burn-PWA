import { useState, type FormEvent } from 'react'
import { goalChangeText, GoalPicker } from '../components/GoalPicker'
import { EMPTY_PROFILE, parseProfile, ProfileFields } from '../components/ProfileFields'
import { sampleState } from '../data/demo'
import { fmt, goalIntake, maintenance, planKcal, suggestedTargets } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { Goal } from '../types'

/** First-run screen: collects what the burn estimate needs, and the goal. */
export function Onboarding() {
  const { today, update } = useApp()
  const [draft, setDraft] = useState(EMPTY_PROFILE)
  const [goal, setGoal] = useState<Goal>({ type: 'cut', pace: 'gentle' })
  const [error, setError] = useState('')

  const parsed = parseProfile(draft)
  const maint = 'profile' in parsed ? maintenance(parsed.profile, parsed.weight) : null

  const start = (e: FormEvent) => {
    e.preventDefault()
    if ('error' in parsed) return setError(parsed.error)
    const { profile, weight } = parsed
    const plan = planKcal(goal, maintenance(profile, weight))
    update((s) => ({
      ...s,
      profile,
      weight,
      weighIns: { ...s.weighIns, [today]: weight },
      goal,
      targets: suggestedTargets(weight, plan),
      view: 'today',
    }))
    window.scrollTo(0, 0)
  }

  return (
    <main className="app onboarding">
      <header className="col" style={{ gap: 6, paddingTop: 12 }}>
        <h1 className="headline" style={{ margin: 0 }}>
          Fuel & Burn
        </h1>
        <p>A few details so we can estimate how much you burn in a day. Everything stays on this device.</p>
      </header>

      <form className="col" style={{ gap: 16 }} onSubmit={start} noValidate>
        <section className="card big" aria-label="About you">
          <span className="h" style={{ fontSize: 17 }}>
            About you
          </span>
          <ProfileFields
            draft={draft}
            onChange={(next) => {
              setDraft(next)
              setError('')
            }}
          />
        </section>

        <section className="card big" aria-label="Your goal">
          <span className="h" style={{ fontSize: 17 }}>
            Your goal
          </span>
          <GoalPicker goal={goal} onChange={setGoal} />
        </section>

        {maint != null && (
          <section className="tip" aria-live="polite">
            <span className="muted" style={{ fontSize: 13, color: 'inherit' }}>
              You burn about {fmt(maint)} kcal a day
            </span>
            <div className="headline" style={{ fontSize: 22 }}>
              Eat about {goalIntake(maint, goal).map(fmt).join('–')}
              <small style={{ color: 'inherit' }}>kcal a day</small>
            </div>
            <span style={{ fontSize: 13 }}>{goalChangeText(goal, maint)}</span>
          </section>
        )}

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="bigbtn primary" type="submit">
          Start
        </button>
        <button className="tbtn" type="button" style={{ color: 'var(--burn-ink)' }} onClick={() => update(() => sampleState(today))}>
          Look around with sample data
        </button>
      </form>
    </main>
  )
}
