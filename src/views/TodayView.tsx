import { BalanceBar } from '../components/BalanceBar'
import { ChevronIcon, PlusIcon } from '../components/Icons'
import { TrendLine } from '../components/TrendLine'
import { TipBox } from '../components/TipBox'
import { TopBar } from '../components/TopBar'
import { addDays, longLabel, weekdayLong } from '../lib/dates'
import { busyDay, eaten, fmt, goalIntake, goalLabel, mealsOn, periodData, planKcal, status, weekSummary, type PeriodData } from '../lib/model'
import { changeWords, formatChange, trendChange, trendSeries } from '../lib/weight'
import { HELP_URL } from '../lib/links'
import { useBackup } from '../state/backup'
import { useApp } from '../state/AppContext'
import type { Goal, Period } from '../types'

const PERIODS: [Period, string][] = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
]

/** The line under today's bar: what is left of the day's plan, never a verdict on the day. */
function soFarText({ avgEaten, avgBurn }: PeriodData, goal: Goal, floor: number, numbers: boolean): string {
  const [lo, hi] = goalIntake(avgBurn, goal, floor)
  if (avgEaten < lo) {
    return numbers
      ? `About ${fmt(lo - avgEaten)}–${fmt(hi - avgEaten)} kcal left in today’s plan.`
      : 'There’s room left in today’s plan for your next meals.'
  }
  if (avgEaten <= hi) return 'You’re within today’s plan.'
  return 'Above today’s plan range. That’s fine: your weekly average is what counts.'
}

/** Days of history before the first-week card stops showing, even if the estimate hasn't learned yet. */
const NEW_USER_DAYS = 35
/** History needed before a backup is worth suggesting, and how long one counts as recent. */
const BACKUP_AFTER_DAYS = 14
const BACKUP_EVERY_DAYS = 30

/**
 * For someone new: what makes the numbers fit them, and how much of it is there so far.
 * Counts only, never streaks or missed days.
 */
function FirstWeekCard({ foodDays, weighIns, onHide }: { foodDays: number; weighIns: number; onHide: () => void }) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return (
    <section className="card" aria-label="Getting to know you">
      <span className="h">Getting to know you</span>
      <p>
        Log what you eat on most days and weigh in on a few mornings. After about a week, your burn estimate starts to
        fit you, not just the formula.
      </p>
      <div className="row muted" style={{ fontSize: 13 }}>
        <span>
          This week: food on {plural(foodDays, 'day', 'days')} · {plural(weighIns, 'weigh-in', 'weigh-ins')}
        </span>
      </div>
      <div className="row">
        <a className="tbtn" href={HELP_URL} target="_blank" rel="noopener" style={{ color: 'var(--burn-ink)', textDecoration: 'none' }}>
          How it works
        </a>
        <button className="tbtn" onClick={onHide}>
          Hide
        </button>
      </div>
    </section>
  )
}

export function TodayView() {
  const { state, update, today, maint, maintEstimate, resting, burnOn, weighIns, openSheet } = useApp()
  const { exportBackup } = useBackup()
  const { goal, meals, numbers } = state
  const period = periodData(state.period, meals, today, burnOn)
  const periodStatus = status(period.balance, period.avgBurn, goal, resting)
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

  // The first week: until the estimate learns from a full week, for people who started recently.
  const firstDay = [...meals.map((m) => m.date), ...weighIns.map((w) => w.date)].sort()[0] ?? today
  const weekAgo = addDays(today, -6)
  const showFirstWeek =
    maintEstimate?.goodWeeks === 0 && firstDay >= addDays(today, -NEW_USER_DAYS) && !state.dismissed.firstWeek
  const recentFoodDays = new Set(meals.filter((m) => m.date >= weekAgo).map((m) => m.date)).size
  const recentWeighIns = weighIns.filter((w) => w.date >= weekAgo).length

  // A backup, once there are two weeks of diary to lose, and again a month after the last one.
  const backupKey = `backup-${today.slice(0, 7)}`
  const suggestBackup =
    firstDay <= addDays(today, -BACKUP_AFTER_DAYS) &&
    (!state.lastBackupAt || state.lastBackupAt.slice(0, 10) <= addDays(today, -BACKUP_EVERY_DAYS)) &&
    !state.dismissed[backupKey]

  let tip = null
  if (week.loggedDays > 0 && status(week.balance, maint, goal, resting).kind === 'big') {
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
  } else if (eaten(mealsOn(meals, today)) > planKcal(goal, maint, resting) + 300) {
    tip = (
      <TipBox title="A bigger day today">
        That happens, and it’s completely fine. What counts is your weekly average. Tomorrow, just eat as usual, no
        need to make up for it.
      </TipBox>
    )
  } else if (busyDay(meals, state.activities, today)) {
    // Only ever this way round: a quiet day is never a reason to eat less.
    tip = (
      <TipBox title="A busy day of moving">
        If you’re hungrier than usual, eating a bit more today fits your week. Your plan stays the same: it’s your
        average that counts.
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
  } else if (suggestBackup) {
    const later = () => update((s) => ({ ...s, dismissed: { ...s.dismissed, [backupKey]: true } }))
    tip = (
      <TipBox
        title="Keep a copy of your diary"
        actions={
          <>
            <button className="tbtn" onClick={later}>
              Not now
            </button>
            <button className="tbtn" onClick={exportBackup}>
              Export backup
            </button>
          </>
        }
      >
        Your diary lives only on this phone. A backup file, saved to your drive or sent to yourself, brings it back if
        the phone is lost or the browser data is cleared.
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
              No full days logged yet
            </div>
            <p>Averages count finished days with most of the day’s food logged, so today joins them tomorrow.</p>
          </>
        ) : (
          <>
            <BalanceBar period={period} status={periodStatus} />
            <p>{period.soFar ? soFarText(period, goal, resting, numbers) : periodStatus.text.replace('this week', period.phrase)}</p>
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

      {showFirstWeek && (
        <FirstWeekCard
          foodDays={recentFoodDays}
          weighIns={recentWeighIns}
          onHide={() => update((s) => ({ ...s, dismissed: { ...s.dismissed, firstWeek: true } }))}
        />
      )}

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
