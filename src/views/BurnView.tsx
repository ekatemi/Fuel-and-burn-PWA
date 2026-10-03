import { ChevronIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { describeActivity } from '../lib/activityLabels'
import { longLabel } from '../lib/dates'
import { activitiesOn, activityKcal, fmt, r10, restingBurn, typicalActivityKcal } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { ActivityEntry } from '../types'

// Formula estimates are typically within about 10% of a person's real burn.
const FORMULA_ERROR = 0.1

export function BurnView() {
  const { state, today, maint, bodyWeight, bodyFatPct, burnOn, update, openSheet, showToast } = useApp()
  const { numbers, profile } = state
  const resting = profile ? Math.min(maint, Math.round(restingBurn(profile, bodyWeight, bodyFatPct))) : maint
  const todays = activitiesOn(state.activities, today)
  const logged = activityKcal(todays)
  const typical = typicalActivityKcal(state.meals, state.activities, today)
  const total = burnOn(today)
  // Usual workouts are already part of maintenance, so they come out of "daily activity".
  const parts = [
    { key: 'bmr', name: 'Resting burn', note: 'keeps your body running', kcal: resting },
    { key: 'act', name: 'Daily activity', note: 'moving around on a usual day', kcal: Math.max(0, total - resting - logged) },
    { key: 'sport', name: 'Logged activity', note: todays.length ? `${todays.length} today` : 'nothing logged today', kcal: logged },
  ]
  const partsTotal = parts.reduce((a, p) => a + p.kcal, 0) || 1

  const remove = (entry: ActivityEntry) => {
    update((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== entry.id) }))
    showToast('Activity removed', () => update((s) => ({ ...s, activities: [...s.activities, entry] })))
  }

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
          {bodyFatPct != null
            ? 'Based on your lean mass (trend weight and logged body fat) and activity level.'
            : 'Based on your sex, age, height, trend weight and activity level.'}{' '}
          It follows your weight trend as you log weigh-ins.
          {bodyFatPct == null &&
            Object.keys(state.bodyFat).length === 1 &&
            ' One more body fat reading and it will use your lean mass instead.'}
        </span>
      </section>

      <section className="card">
        <div className="row">
          <span className="h">Today</span>
          {numbers && (
            <span style={{ fontSize: 14 }}>
              <b className="num" style={{ color: 'var(--burn-ink)' }}>
                ~{fmt(total)}
              </b>{' '}
              <span className="muted">kcal</span>
            </span>
          )}
        </div>
        <div
          className="stack"
          role="img"
          aria-label={`Today’s burn: ${parts.map((p) => p.name + (numbers ? ` ${fmt(p.kcal)} kcal` : '')).join(', ')}`}
        >
          {parts.map((p) => (
            <div key={p.key} className={`seg-${p.key}`} style={{ width: `${(p.kcal / partsTotal) * 100}%` }} />
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
        {numbers && typical > 0 && (
          <p style={{ fontSize: 12 }}>
            A typical day for you includes ~{fmt(typical)} kcal of logged activity, so only the difference counts.
          </p>
        )}
      </section>

      <div className="col" style={{ gap: 8 }}>
        <span className="h">Activity today</span>
        {todays.length > 0 && (
          <div className="list">
            {todays.map((entry) => {
              const { name, detail } = describeActivity(entry)
              return (
                <div className="item" key={entry.id}>
                  <span className="muted" style={{ width: 42, fontSize: 13 }}>
                    {entry.time}
                  </span>
                  <div className="main">
                    <span className="nm">{name}</span>
                    <span className="pt">{detail}</span>
                  </div>
                  {numbers && (
                    <span className="num" style={{ fontSize: 15 }}>
                      ~{fmt(entry.burn.kcal)}
                    </span>
                  )}
                  <button className="icon-btn" aria-label={`Remove ${name}`} onClick={() => remove(entry)}>
                    <TrashIcon />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <button className="bigbtn secondary" onClick={() => openSheet('activity')}>
          <PlusIcon />
          Add activity
        </button>
      </div>

      <details>
        <summary>
          How it’s calculated <ChevronIcon />
        </summary>
        <p>
          Resting burn comes from the Mifflin–St Jeor formula, which uses your sex, age, height and weight. If you
          log your body fat at least twice, we use the Katch–McArdle formula instead, which works from lean mass and suits people
          with more or less muscle than average. We multiply
          it by a factor for your activity level to get what you burn on a typical day. It is an estimate: two people
          with the same numbers can differ by around 10%, so treat it as a starting point and watch how your weight
          trend actually moves.
        </p>
        <p>
          Logged activity counts only the energy above resting. Steps are turned into distance from your height, then
          into calories with the ACSM walking equation and your weight; walks and runs use the ACSM equations with
          your speed; other activities use their MET value times your own resting rate. Because your usual activity is
          already part of your maintenance, only the difference from a typical day (the median of your last 14 days)
          changes your balance. Activity numbers are rough, about ±20%.
        </p>
      </details>
    </>
  )
}
