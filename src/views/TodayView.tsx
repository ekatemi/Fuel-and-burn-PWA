import { BalanceBar } from '../components/BalanceBar'
import { ChevronIcon, PlusIcon } from '../components/Icons'
import { TrendLine } from '../components/TrendLine'
import { TipBox } from '../components/TipBox'
import { TopBar } from '../components/TopBar'
import { addDays, longLabel, weekdayLong } from '../lib/dates'
import { eaten, fmt, goalIntake, goalLabel, mealsOn, periodData, planKcal, status, weekSummary, type PeriodData } from '../lib/model'
import { changeWords, formatChange, trendChange, trendSeries } from '../lib/weight'
import { useApp } from '../state/AppContext'
import type { Goal, Period } from '../types'

const PERIODS: [Period, string][] = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
]

/** The line under today's bar: what is left of the day's plan, never a verdict on the day. */
function soFarText({ avgEaten, avgBurn }: PeriodData, goal: Goal, numbers: boolean): string {
  const [lo, hi] = goalIntake(avgBurn, goal)
  if (avgEaten < lo) {
    return numbers
      ? `About ${fmt(lo - avgEaten)}–${fmt(hi - avgEaten)} kcal left in today’s plan.`
      : 'There’s room left in today’s plan for your next meals.'
  }
  if (avgEaten <= hi) return 'You’re within today’s plan.'
  return 'Above today’s plan range. That’s fine: your weekly average is what counts.'
}

export function TodayView() {
  const { state, update, today, maint, burnOn, weighIns, openSheet } = useApp()
  const { goal, meals, numbers } = state
  const period = periodData(state.period, meals, today, burnOn)
  const periodStatus = status(period.balance, period.avgBurn, goal)
  const week = weekSummary(meals, today, burnOn)
  // The most recent earlier day this week that ended clearly above maintenance.
  const biggerDay = week.items.findLast((d) => !d.live && d.value != null && d.value > 100)?.date
  const biggerDayKey = `bigger-${biggerDay}`

  // Weight trend over the selected period (the week view looks back 7 days).
  const firstWeighIn = weighIns[0]?.date ?? today
  const trendFrom =
    state.period === 'week' || state.period === 'today'
      ? addDays(today, -6)
      : state.period === 'month'
        ? addDays(today, -29)
        : addDays(today, -364)
  const trendLabel =
    state.period === 'week' || state.period === 'today' ? 'past 7 days' : state.period === 'month' ? 'past 30 days' : 'past 12 months'
  const trend = trendSeries(weighIns, trendFrom < firstWeighIn ? firstWeighIn : trendFrom, today)
  const change = trendChange(trend)

  let tip = null
  if (week.loggedDays > 0 && status(week.balance, maint, goal).kind === 'big') {
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
  } else if (eaten(mealsOn(meals, today)) > planKcal(goal, maint) + 300) {
    tip = (
      <TipBox title="A bigger day today">
        That happens, and it’s completely fine. What counts is your weekly average. Tomorrow, just eat as usual, no
        need to make up for it.
      </TipBox>
    )
  } else if (biggerDay && !state.dismissed[biggerDayKey]) {
    tip = (
      <TipBox
        title={`${weekdayLong(biggerDay)} was a bigger day`}
        actions={
          <button
            className="tbtn"
            onClick={() => update((s) => ({ ...s, dismissed: { ...s.dismissed, [biggerDayKey]: true } }))}
          >
            Got it
          </button>
        }
      >
        That’s completely fine. What counts is the weekly average
        {week.balance < 0 && ', and your week is still in a deficit'}. No need to eat less today.
      </TipBox>
    )
  }

  return (
    <>
      <TopBar subtitle={longLabel(today)} title="Today" />
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
        {period.empty ? (
          <>
            <div className="headline" style={{ fontSize: 22 }}>
              No finished days this week yet
            </div>
            <p>Your weekly average counts finished days only, so today joins it tomorrow.</p>
          </>
        ) : (
          <>
            <BalanceBar period={period} status={periodStatus} />
            <p>{period.soFar ? soFarText(period, goal, numbers) : periodStatus.text.replace('this week', period.phrase)}</p>
          </>
        )}
      </section>

      <button className="linkcard" aria-label="Open trends" onClick={() => update((s) => ({ ...s, view: 'trends' }))}>
        <span className="row center wide">
          <span className="h">Weight, {trendLabel}</span>
          <span className="more">
            Details
            <ChevronIcon />
          </span>
        </span>
        {change == null ? (
          <p>
            {weighIns.length
              ? 'A few more weigh-ins over the coming days and your trend shows here.'
              : 'Log your weight in the morning a few times a week to see your trend.'}
          </p>
        ) : numbers ? (
          <span className="baseline">
            <span className="num" style={{ fontSize: 22, color: 'var(--burn-ink)' }}>
              {formatChange(change)}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              weight trend
            </span>
          </span>
        ) : (
          <span className="headline block" style={{ fontSize: 22 }}>
            Weight is {changeWords(change)}
          </span>
        )}
        <span className="block wide">
          <TrendLine series={trend} />
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
      <div className="proto">Stored on this device</div>
    </>
  )
}
