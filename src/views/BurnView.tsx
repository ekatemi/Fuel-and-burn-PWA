import { ChevronIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { BURN_PARTS, TODAY_LABEL } from '../data/demo'
import { fmt } from '../lib/model'
import { useApp } from '../state/AppContext'

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="num" style={{ fontSize: 17 }}>
        {value}
      </span>
      <span className="muted" style={{ fontSize: 12 }}>
        {label}
      </span>
    </div>
  )
}

export function BurnView() {
  const { state } = useApp()
  const { numbers } = state
  const total = BURN_PARTS.reduce((a, p) => a + p.kcal, 0)

  return (
    <>
      <TopBar subtitle={TODAY_LABEL} title="Burn" />
      <section className="hero">
        <span className="h muted">Your maintenance</span>
        {numbers ? (
          <>
            <div className="baseline">
              <span className="num hero-num">1,870</span>
              <span className="muted" style={{ fontSize: 16 }}>
                kcal a day
              </span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              Likely between 1,820 and 1,930
            </div>
          </>
        ) : (
          <div className="headline" style={{ color: 'var(--hero-ink)' }}>
            Learned from your data
          </div>
        )}
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
          Based on 28 days of your food and weight. The estimate gets more precise the longer you log.
        </span>
      </section>

      <section className="card">
        <div className="row">
          <span className="h">Today</span>
          {numbers ? (
            <span style={{ fontSize: 14 }}>
              <b className="num" style={{ color: 'var(--burn-ink)' }}>
                ~1,870
              </b>{' '}
              <span className="muted">expected</span>
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 14 }}>
              More active than usual
            </span>
          )}
        </div>
        <div
          className="stack"
          role="img"
          aria-label={`Today’s burn: ${BURN_PARTS.map((p) => p.name + (numbers ? ` ${p.kcal} kcal` : '')).join(', ')}`}
        >
          {BURN_PARTS.map((p) => (
            <div key={p.key} className={`seg-${p.key}`} style={{ width: `${(p.kcal / total) * 100}%` }} />
          ))}
        </div>
        <div className="plist">
          {BURN_PARTS.map((p) => (
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
        <div className="divider" />
        <div className="grid3">
          <Mini value="9,420" label="steps" />
          <Mini value="45 min" label="strength" />
          {numbers ? <Mini value="380" label="active kcal" /> : <Mini value="Synced" label="Galaxy Watch" />}
        </div>
      </section>

      <details>
        <summary>
          How it’s calculated <ChevronIcon />
        </summary>
        <p>
          We start with a formula based on your height, weight, age and activity. Then we compare what you eat with how
          your weight trend moves, and your own data gradually replaces the formula. Watch activity only adjusts for how
          much more active a day was than usual; active calories aren’t added directly, since tracker accuracy varies a
          lot.
        </p>
      </details>
    </>
  )
}
