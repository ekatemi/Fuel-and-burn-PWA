import { ChevronIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { describeActivity } from '../lib/activityLabels'
import { longLabel } from '../lib/dates'
import { ACTIVITY, activitiesOn, activityFit, fmt, restingBurn } from '../lib/model'
import { WEEKS } from '../lib/tdee'
import { useApp } from '../state/AppContext'
import type { Activity, ActivityEntry } from '../types'

/** Where the estimate stands: from the profile, learning, or based mostly on the person's own data. */
function learningLabel(weeks: number) {
  if (!weeks) return 'Estimate from your profile'
  return weeks < WEEKS ? 'Learning from your data' : 'Tuned to you'
}

/** One dot per week the estimate can learn from, filled for the weeks it did. */
function LearningDots({ weeks }: { weeks: number }) {
  return (
    <span className="dots" aria-hidden="true">
      {Array.from({ length: WEEKS }, (_, i) => (
        <span key={i} className={i < weeks ? 'on' : undefined} />
      ))}
    </span>
  )
}

export function BurnView() {
  const { state, today, maint, maintEstimate, bodyWeight, bodyFatPct, update, openSheet, showToast } = useApp()
  const { numbers, profile } = state
  const resting = profile ? Math.min(maint, Math.round(restingBurn(profile, bodyWeight, bodyFatPct))) : maint
  const todays = activitiesOn(state.activities, today)
  const fit = profile ? activityFit(state.meals, state.activities, today, resting) : null
  const parts = [
    { key: 'bmr', name: 'Resting burn', note: 'keeps your body running', kcal: resting },
    { key: 'act', name: 'Moving and digesting', note: 'everything else on a usual day', kcal: maint - resting },
  ]
  const learned = maintEstimate?.goodWeeks ?? 0
  const unusual = maintEstimate?.unusualWeeks ?? 0

  const switchLevel = (level: Activity) => {
    const before = profile!.activity
    const set = (activity: Activity) => update((s) => (s.profile ? { ...s, profile: { ...s.profile, activity } } : s))
    set(level)
    showToast(`Activity level: ${ACTIVITY[level].name}`, () => set(before))
  }

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
            {maintEstimate && (
              <div className="muted" style={{ fontSize: 13 }}>
                Likely between {fmt(maintEstimate.low)} and {fmt(maintEstimate.high)}
              </div>
            )}
          </>
        ) : (
          <div className="headline" style={{ color: 'var(--hero-ink)' }}>
            {learningLabel(learned)}
          </div>
        )}
        <div className="learning">
          <span>
            {numbers && <b>{learningLabel(learned)}</b>}
            {numbers && learned > 0 && ' · '}
            {(learned > 0 || !numbers) && `${learned} of ${WEEKS} weeks`}
          </span>
          <LearningDots weeks={learned} />
        </div>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
          {!learned
            ? `${
                bodyFatPct != null
                  ? 'Based on your lean mass (trend weight and logged body fat) and activity level.'
                  : 'Based on your sex, age, height, trend weight and activity level.'
              } Log food on most days and weigh in a few times a week: after about a week it starts learning what you really burn.`
            : learned < WEEKS
              ? 'Your food diary and weight trend, blended with the estimate from your profile. Each full week you log makes it more yours.'
              : 'Based mostly on your own food diary and weight trend over the last four weeks, and it keeps following them.'}
          {unusual > 0 && ` ${unusual === 1 ? 'One week' : `${unusual} weeks`} looked unusual and ${unusual === 1 ? 'was' : 'were'} left out.`}
          {bodyFatPct == null &&
            Object.keys(state.bodyFat).length === 1 &&
            ' One more body fat reading and it will use your lean mass instead.'}
        </span>
      </section>

      <section className="card">
        <span className="h">What it’s made of</span>
        <div
          className="stack"
          role="img"
          aria-label={`Your maintenance: ${parts.map((p) => p.name + (numbers ? ` ${fmt(p.kcal)} kcal` : '')).join(', ')}`}
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
        <p style={{ fontSize: 12 }}>
          It’s the same every day: the balance on Today is an average over the period, so a busier or quieter day
          doesn’t change it.
        </p>
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
        <p style={{ fontSize: 12 }}>
          A diary for you: your maintenance already holds how you usually move, so logged activity doesn’t change your
          numbers. After about two weeks it shows which activity level it fits.
        </p>
      </div>

      {fit && profile && (
        <section className="card">
          <span className="h">Your activity level</span>
          <p>
            {numbers
              ? `Over the past ${fit.days} days your logged activity averages ~${fmt(fit.avgKcal)} kcal a day, which fits `
              : 'Your logged activity fits '}
            <b>{ACTIVITY[fit.level].name}</b>
            {fit.level === profile.activity ? ', as in your profile.' : `. Your profile says ${ACTIVITY[profile.activity].name}.`}
          </p>
          {fit.level !== profile.activity && (
            <>
              <p style={{ fontSize: 12 }}>
                Activity logs are rough and easy to miss, so it’s your call. Either way, your weight trend corrects the
                estimate over the next weeks.
              </p>
              <div className="row">
                <button className="tbtn link" onClick={() => switchLevel(fit.level)}>
                  Switch to {ACTIVITY[fit.level].name}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <details>
        <summary>
          How it’s calculated <ChevronIcon />
        </summary>
        <p>
          Resting burn comes from the Mifflin–St Jeor formula, which uses your sex, age, height and weight. If you
          log your body fat at least twice, we use the Katch–McArdle formula instead, which works from lean mass and suits people
          with more or less muscle than average. We multiply
          it by a factor for your activity level to get what you burn on a typical day. It is an estimate: two people
          with the same numbers can differ by around 10%, so it is only the starting point.
        </p>
        <p>
          Then it learns from you. For each of the last four weeks with food logged on at least four days and
          weigh-ins around it, we take what you ate on average and correct it by how your weight trend moved, at
          about 7,700 kcal per kg: if your trend went down, you burned more than you ate. Each such week shifts your
          maintenance a little further from the formula towards your own number. A week that looks very different
          from the others, say after a holiday or a stomach bug, is left out, so one strange week doesn’t move it.
          Days with little or nothing logged are taken as incomplete and don’t count.
        </p>
        <p>
          Logged activity counts only the energy above resting. Steps are turned into distance from your height, then
          into calories with the ACSM walking equation and your weight; walks and runs use the ACSM equations with
          your speed; other activities use their MET value times your own resting rate. Activity numbers are rough,
          about ±20%. They don’t change your balance: your maintenance, learned from your food and weight, already
          holds how you usually move. Instead, after about two weeks the average is compared with what each activity
          level adds over “Mostly sitting” (resting burn × 0.175, 0.35 or 0.525), and you can switch to the level it
          fits.
        </p>
      </details>
    </>
  )
}
