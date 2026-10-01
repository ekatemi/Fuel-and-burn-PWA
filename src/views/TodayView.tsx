import { BalanceBar } from '../components/BalanceBar'
import { ChevronIcon, PlusIcon } from '../components/Icons'
import { Sparkline } from '../components/Sparkline'
import { TipBox } from '../components/TipBox'
import { TopBar } from '../components/TopBar'
import { MAINT, TODAY_LABEL } from '../data/demo'
import { eaten, goalLabel, periodData, planKcal, status, weekBalance } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { Period } from '../types'

const PERIODS: [Period, string][] = [
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['all', 'All'],
]

export function TodayView() {
  const { state, update, openSheet } = useApp()
  const { goal, meals, numbers } = state
  const period = periodData(state.period, meals)
  const periodStatus = status(period.balance, period.avgBurn, goal)
  const weekStatus = status(weekBalance(meals), MAINT, goal)

  let tip = null
  if (weekStatus.kind === 'big') {
    tip = (
      <TipBox
        title="Your body could use a bit more"
        actions={
          <button className="tbtn" onClick={() => openSheet('add')}>
            Add a snack
          </button>
        }
      >
        This week you’ve eaten quite a bit less than planned. Eating closer to your plan helps you keep muscle and
        energy. A snack or a slightly bigger dinner today would be a good idea.
      </TipBox>
    )
  } else if (eaten(meals) > planKcal(goal) + 300) {
    tip = (
      <TipBox title="A bigger day today">
        That happens, and it’s completely fine. What counts is your weekly average. Tomorrow, just eat as usual, no
        need to make up for it.
      </TipBox>
    )
  } else if (!state.dismissed.tue) {
    tip = (
      <TipBox
        title="Tuesday was a bigger day"
        actions={
          <button className="tbtn" onClick={() => update((s) => ({ ...s, dismissed: { ...s.dismissed, tue: true } }))}>
            Got it
          </button>
        }
      >
        That’s completely fine. What counts is the weekly average, and your week is still in a deficit. No need to eat
        less today.
      </TipBox>
    )
  }

  return (
    <>
      <TopBar subtitle={TODAY_LABEL} title="Today" />
      <section className="card big" aria-label="Energy balance">
        <div className="seg full" role="radiogroup" aria-label="Period">
          {PERIODS.map(([key, label]) => (
            <button
              key={key}
              role="radio"
              aria-checked={state.period === key}
              onClick={() => update((s) => ({ ...s, period: key }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="row center">
          <span className="muted" style={{ fontSize: 14 }}>
            {period.title}
          </span>
          <button className="goalchip" aria-label={`Goal: ${goalLabel(goal)}. Change`} onClick={() => openSheet('goal')}>
            🎯 {goalLabel(goal)}
          </button>
        </div>
        <BalanceBar period={period} status={periodStatus} />
        <p>{periodStatus.text.replace('this week', period.phrase)}</p>
      </section>

      <button className="linkcard" aria-label="Open trends" onClick={() => update((s) => ({ ...s, view: 'trends' }))}>
        <span className="row center wide">
          <span className="h">Trend, {period.trendLabel}</span>
          <span className="more">
            Details
            <ChevronIcon />
          </span>
        </span>
        {numbers ? (
          <span className="grid2 wide">
            <span>
              <span className="num block" style={{ fontSize: 22, color: 'var(--burn-ink)' }}>
                {period.fatChange}
              </span>
              <span className="muted block" style={{ fontSize: 12 }}>
                body fat
              </span>
            </span>
            <span>
              <span className="num block" style={{ fontSize: 22 }}>
                {period.weightChange}
              </span>
              <span className="muted block" style={{ fontSize: 12 }}>
                weight
              </span>
            </span>
          </span>
        ) : (
          <span className="headline block" style={{ fontSize: 22 }}>
            Body fat is trending down
          </span>
        )}
        <span className="block wide">
          <Sparkline items={period.items} />
        </span>
      </button>

      {tip}

      <div className="grid2">
        <button className="bigbtn primary" onClick={() => openSheet('add')}>
          <PlusIcon />
          Add food
        </button>
        <button className="bigbtn secondary" onClick={() => openSheet('weight')}>
          <PlusIcon />
          Log weight
        </button>
      </div>
      <div className="proto">Demo data · stored on this device</div>
    </>
  )
}
