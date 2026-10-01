import { ChevronIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { longLabel } from '../lib/dates'
import { ACTIVITY, fmt, r10, restingBurn } from '../lib/model'
import { useApp } from '../state/AppContext'

// Formula estimates are typically within about 10% of a person's real burn.
const FORMULA_ERROR = 0.1

export function BurnView() {
  const { state, today, maint } = useApp()
  const { numbers, profile } = state
  const resting = profile ? Math.min(maint, Math.round(restingBurn(profile, state.weight))) : maint
  const parts = [
    { key: 'bmr', name: 'Resting burn', note: 'keeps your body running', kcal: resting },
    {
      key: 'act',
      name: 'Daily activity',
      note: profile ? ACTIVITY[profile.activity].name.toLowerCase() : 'steps, chores, moving around',
      kcal: maint - resting,
    },
  ]

  return (
    <>
      <TopBar subtitle={longLabel(today)} title="Burn" />
      <section className="hero">
        <span className="h muted">Your maintenance</span>
        {numbers ? (
          <>
            <div className="baseline">
              <span className="num hero-num">{fmt(maint)}</span>
              <span className="muted" style={{ fontSize: 16 }}>
                kcal a day
              </span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              Likely between {fmt(r10(maint * (1 - FORMULA_ERROR)))} and {fmt(r10(maint * (1 + FORMULA_ERROR)))}
            </div>
          </>
        ) : (
          <div className="headline" style={{ color: 'var(--hero-ink)' }}>
            Estimated from your profile
          </div>
        )}
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
          Based on your sex, age, height, weight and activity level. It updates when you log a new weight or edit your
          profile.
        </span>
      </section>

      <section className="card">
        <div className="row">
          <span className="h">A typical day</span>
          {numbers && (
            <span style={{ fontSize: 14 }}>
              <b className="num" style={{ color: 'var(--burn-ink)' }}>
                ~{fmt(maint)}
              </b>{' '}
              <span className="muted">kcal</span>
            </span>
          )}
        </div>
        <div
          className="stack"
          role="img"
          aria-label={`Daily burn: ${parts.map((p) => p.name + (numbers ? ` ${fmt(p.kcal)} kcal` : '')).join(', ')}`}
        >
          {parts.map((p) => (
            <div key={p.key} className={`seg-${p.key}`} style={{ width: `${(p.kcal / maint) * 100}%` }} />
          ))}
        </div>
        <div className="plist">
          {parts.map((p) => (
            <div className="pitem2" key={p.key}>
              <span className={`sw seg-${p.key}`} />
              <span className="pmain">
                <span className="pname">{p.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {p.note}
                </span>
              </span>
              {numbers && (
                <span className="num" style={{ fontSize: 15 }}>
                  {fmt(p.kcal)}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <details>
        <summary>
          How it’s calculated <ChevronIcon />
        </summary>
        <p>
          Resting burn comes from the Mifflin–St Jeor formula, which uses your sex, age, height and weight. We multiply
          it by a factor for your activity level to get what you burn on a typical day. It is an estimate: two people
          with the same numbers can differ by around 10%, so treat it as a starting point and watch how your weight
          trend actually moves.
        </p>
      </details>
    </>
  )
}
