import { fmt, goalIntake, r10, type PeriodData, type Status } from '../lib/model'
import { useApp } from '../state/AppContext'

/** One bar for the period: what was eaten, against the goal band and maintenance. */
export function BalanceBar({ period, status }: { period: PeriodData; status: Status }) {
  const { state } = useApp()
  const showNumbers = state.numbers
  const { avgEaten, avgBurn, balance } = period
  const [goalLo, goalHi] = goalIntake(avgBurn, state.goal)
  const end = r10(Math.max(avgBurn, goalHi))
  const pct = (x: number) => Math.max(0, Math.min(100, (x / end) * 100))
  const over = Math.round(avgEaten - end)
  const endIsMaintenance = end <= avgBurn + 5
  const balanceText =
    balance < -40 ? `Deficit ${fmt(-balance)}` : balance > 40 ? `Surplus ${fmt(balance)}` : 'About even'

  return (
    <>
      <div className="ohead">
        <div>
          {showNumbers ? (
            <>
              <div className="onum">{fmt(avgEaten)}</div>
              <div className="muted" style={{ fontSize: 14 }}>
                kcal a day eaten
              </div>
            </>
          ) : (
            <div className="headline" style={{ fontSize: 26 }}>
              {status.title}
            </div>
          )}
        </div>
        <div className="olegend">
          <span>
            <span className="sw-goal" aria-hidden="true" />
            {showNumbers ? `${fmt(goalLo)}–${fmt(goalHi)}` : 'your goal'}
          </span>
          <span>
            <span className="sw-maint" aria-hidden="true" />
            {showNumbers ? `~${fmt(avgBurn)} burn` : 'maintenance'}
          </span>
        </div>
      </div>
      <div
        className="otrack"
        role="img"
        aria-label={
          showNumbers
            ? `Eaten ${fmt(avgEaten)} of ${fmt(end)} kcal. Goal ${fmt(goalLo)} to ${fmt(goalHi)}, maintenance ${fmt(avgBurn)}.`
            : status.title
        }
      >
        <div className="ofill" style={{ width: `${pct(avgEaten)}%` }} />
        <div
          className={pct(goalHi) >= 99.5 ? 'ogoal at-end' : 'ogoal'}
          style={{ left: `${pct(goalLo)}%`, width: `${Math.max(2, pct(goalHi) - pct(goalLo))}%` }}
        />
        {avgBurn < end - 5 && <div className="omaint" style={{ left: `${pct(avgBurn)}%` }} title="Maintenance" />}
        {over > 0 && showNumbers && <span className="oover">+{fmt(over)}</span>}
      </div>
      <div className="row muted" style={{ fontSize: 12, marginTop: -6 }}>
        <span>0</span>
        <span>
          {showNumbers && `${fmt(end)} `}
          {endIsMaintenance ? 'maintenance' : 'goal max'}
        </span>
      </div>
      {showNumbers && (
        <div className="gsub">
          {balanceText} kcal a day <span className={`gpill g-${status.kind}`}>{status.title}</span>
        </div>
      )}
    </>
  )
}
