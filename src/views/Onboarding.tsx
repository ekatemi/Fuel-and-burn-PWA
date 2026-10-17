import { useState, type FormEvent } from 'react'
import { goalChangeText, GoalPicker } from '../components/GoalPicker'
import { EMPTY_PROFILE, parseProfile, ProfileFields } from '../components/ProfileFields'
import { sampleState } from '../data/demo'
import { fmt, goalIntake, maintenance, planKcal, restingBurn, suggestedTargets } from '../lib/model'
import { PRIVACY_URL } from '../lib/links'
import { useApp } from '../state/AppContext'
import { useBackup } from '../state/backup'
import type { Consent, Goal } from '../types'

const NEEDS_CONSENT = 'Tick both boxes above to go on.'

interface ConsentDraft {
  adult: boolean
  healthData: boolean
}

/** The two separate agreements, both unticked until the person ticks them. */
function ConsentFields({ draft, onChange }: { draft: ConsentDraft; onChange: (draft: ConsentDraft) => void }) {
  return (
    <section className="card big" aria-label="Before you start">
      <span className="h" style={{ fontSize: 17 }}>
        Before you start
      </span>
      <label className="check">
        <input type="checkbox" checked={draft.adult} onChange={(e) => onChange({ ...draft, adult: e.target.checked })} />
        <span>I’m 18 or older.</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.healthData}
          onChange={(e) => onChange({ ...draft, healthData: e.target.checked })}
        />
        <span>
          I agree that Fuel & Burn keeps my health data (weight, body fat, food and activity) on this device to estimate
          my burn and show my trend. Food I type, say or photograph for recognition is sent to an AI service without my
          name or other details. I can delete everything at any time from the menu.{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener">
            Privacy policy
          </a>
        </span>
      </label>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Fuel & Burn is a wellness app, not medical advice. If you have a health condition, are pregnant, or have had
        difficulties with eating, talk to a doctor before changing how you eat.
      </p>
    </section>
  )
}

/** Shown when the profile is there but consent isn't: data from before consent was asked for. */
function ConsentOnly() {
  const { update, resetData } = useApp()
  const [draft, setDraft] = useState<ConsentDraft>({ adult: false, healthData: false })
  const [error, setError] = useState('')

  return (
    <main className="app onboarding">
      <header className="col" style={{ gap: 6, paddingTop: 12 }}>
        <h1 className="headline" style={{ margin: 0 }}>
          Fuel & Burn
        </h1>
        <p>One thing before you go on. Your diary is still here.</p>
      </header>
      <div className="col" style={{ gap: 16 }}>
        <ConsentFields
          draft={draft}
          onChange={(next) => {
            setDraft(next)
            setError('')
          }}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="bigbtn primary"
          type="button"
          onClick={() =>
            draft.adult && draft.healthData
              ? update((s) => ({ ...s, consent: { at: new Date().toISOString() } }))
              : setError(NEEDS_CONSENT)
          }
        >
          Continue
        </button>
        <button
          className="tbtn"
          type="button"
          style={{ color: 'var(--burn-ink)' }}
          onClick={() => {
            if (window.confirm('Delete your diary, weigh-ins, profile and saved foods from this device? This can’t be undone.')) resetData()
          }}
        >
          Delete all my data instead
        </button>
      </div>
    </main>
  )
}

/** First-run screen: asks for consent, then collects what the burn estimate needs, and the goal. */
export function Onboarding() {
  const { state } = useApp()
  return state.profile ? <ConsentOnly /> : <FirstRun />
}

function FirstRun() {
  const { today, update } = useApp()
  const { restoreBackup } = useBackup()
  const [consentDraft, setConsentDraft] = useState<ConsentDraft>({ adult: false, healthData: false })
  const [draft, setDraft] = useState(EMPTY_PROFILE)
  const [goal, setGoal] = useState<Goal>({ type: 'cut', pace: 'gentle' })
  const [error, setError] = useState('')

  const parsed = parseProfile(draft)
  const maint = 'profile' in parsed ? maintenance(parsed.profile, parsed.weight) : null
  const resting = 'profile' in parsed ? restingBurn(parsed.profile, parsed.weight) : 0

  /** The consent record, or null after asking for the boxes to be ticked. */
  const consent = (): Consent | null => {
    if (consentDraft.adult && consentDraft.healthData) return { at: new Date().toISOString() }
    setError(NEEDS_CONSENT)
    return null
  }

  const start = (e: FormEvent) => {
    e.preventDefault()
    const given = consent()
    if (!given) return
    if ('error' in parsed) return setError(parsed.error)
    const { profile, weight } = parsed
    const plan = planKcal(goal, maintenance(profile, weight), restingBurn(profile, weight))
    update((s) => ({
      ...s,
      profile,
      consent: given,
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
        <ConsentFields
          draft={consentDraft}
          onChange={(next) => {
            setConsentDraft(next)
            setError('')
          }}
        />

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
              Eat about {goalIntake(maint, goal, resting).map(fmt).join('–')}
              <small style={{ color: 'inherit' }}>kcal a day</small>
            </div>
            <span style={{ fontSize: 13 }}>{goalChangeText(goal, maint, resting)}</span>
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
        <button className="tbtn" type="button" style={{ color: 'var(--burn-ink)' }} onClick={() => {
            const given = consent()
            if (given) update(() => ({ ...sampleState(today), consent: given }))
          }}
        >
          Look around with sample data
        </button>
        <button className="tbtn" type="button" style={{ color: 'var(--burn-ink)', marginTop: -12 }} onClick={() => {
            const given = consent()
            if (given) restoreBackup(given)
          }}
        >
          Restore from a backup
        </button>
      </form>
    </main>
  )
}
