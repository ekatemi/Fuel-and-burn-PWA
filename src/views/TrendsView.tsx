import { TrendLine } from '../components/TrendLine'
import { TopBar } from '../components/TopBar'
import { OLD_WEEKS } from '../data/demo'
import { addDays, monthDay, weekStart } from '../lib/dates'
import { weekSummary } from '../lib/model'
import { bodyFatSeries, changeWords, formatChange, trendChange, trendSeries } from '../lib/weight'
import { useApp } from '../state/AppContext'

// Bar centres for the eight weeks of the balance chart.
const COLUMNS = [53, 87, 120, 154, 188, 222, 255, 289]
const AXIS = { fontSize: 10, fill: 'var(--muted)' }
const balanceColor = (v: number) => (Math.abs(v) <= 100 ? 'var(--muted)' : v < 0 ? 'var(--burn)' : 'var(--fuel)')
const TREND_DAYS = 56
// Body fat moves slowly and readings are noisy: compare points at least two weeks apart.
const MIN_COMPOSITION_SPAN_DAYS = 14

function LegendDot({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span>
      <span className="legend-dot" style={hollow ? { border: `1.5px solid ${color}` } : { background: color }} />
      {label}
    </span>
  )
}

export function TrendsView() {
  const { state, today, burnOn, weighIns, trendWeight, bodyFatPct } = useApp()
  const { numbers } = state
  const weeks = [...OLD_WEEKS, Math.round(weekSummary(state.meals, today, burnOn).balance)]
  const weekLabel = (index: number) => monthDay(addDays(weekStart(today), (index - OLD_WEEKS.length) * 7))

  const from = addDays(today, -(TREND_DAYS - 1))
  const series = trendSeries(weighIns, from, today)
  const recent = weighIns.filter((w) => w.date >= from)
  const change = trendChange(series)
  const latest = weighIns[weighIns.length - 1]
  // Fat and lean mass from trend weight × smoothed body fat, on days where both are known.
  const fatSeries = bodyFatSeries(state.bodyFat, from, today)
  const fatReadings = Object.keys(state.bodyFat).filter((d) => d >= from).length
  const both = fatSeries.flatMap((p, i) => {
    const kg = series[i].value
    return p.value != null && kg != null ? [{ index: i, fatKg: (kg * p.value) / 100, leanKg: kg * (1 - p.value / 100) }] : []
  })
  const first = both[0]
  const last = both[both.length - 1]
  const composition =
    first && last && last.index - first.index >= MIN_COMPOSITION_SPAN_DAYS
      ? { fat: last.fatKg - first.fatKg, lean: last.leanKg - first.leanKg }
      : null

  const stats = [
    { label: 'Weight change', value: change == null ? '—' : formatChange(change), color: 'var(--burn-ink)' },
    { label: 'Trend weight', value: trendWeight == null ? '—' : trendWeight.toFixed(1) + ' kg', color: 'var(--ink)' },
    { label: 'Latest weigh-in', value: latest ? `${latest.kg.toFixed(1)} kg` : '—', color: 'var(--ink)' },
    { label: 'Weigh-ins', value: String(recent.length), color: 'var(--ink)' },
  ]

  return (
    <>
      <TopBar title="Trends" withBack />
      <section className="card big">
        <span className="h">Last 8 weeks</span>
        {numbers && (
          <div className="grid2">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {s.label}
                </span>
                <span className="num" style={{ fontSize: 19, color: s.color }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}
        {recent.length ? (
          <>
            <div className="row">
              <span className="h">Weight trend</span>
              {change != null && (
                <span className="muted" style={{ fontSize: 13 }}>
                  {changeWords(change)}
                </span>
              )}
            </div>
            <TrendLine series={series} weighIns={recent} height={110} />
            <div className="row muted" style={{ fontSize: 11, marginTop: -6 }}>
              <span>{monthDay(from)}</span>
              <span>today</span>
            </div>
            <div className="legend">
              <LegendDot color="var(--burn)" label="7-day trend" />
              <LegendDot color="var(--outline)" label="weigh-ins" />
              {recent.some((w) => w.anomaly) && <LegendDot color="var(--outline)" label="left out, unusual reading" hollow />}
            </div>
            <p>Single weigh-ins move with water and food. The trend line is what to watch.</p>
          </>
        ) : (
          <p>Log your weight in the morning a few times a week, and your trend appears here.</p>
        )}
      </section>

      <section className="card">
        <div className="row">
          <span className="h">Body composition</span>
          {numbers && bodyFatPct != null && (
            <span className="muted" style={{ fontSize: 13 }}>
              {bodyFatPct.toFixed(1)}% body fat
            </span>
          )}
        </div>
        {fatReadings === 0 ? (
          <p>
            Optional: add your body fat % when you log your weight, from a smart scale or a measurement. You’ll see fat
            and lean mass here, and your burn estimate will use your lean mass.
          </p>
        ) : (
          <>
            {composition && numbers && (
              <div className="grid2">
                <div className="stat">
                  <span className="muted" style={{ fontSize: 12 }}>
                    Fat mass
                  </span>
                  <span className="num" style={{ fontSize: 19, color: 'var(--burn-ink)' }}>
                    {formatChange(composition.fat)}
                  </span>
                </div>
                <div className="stat">
                  <span className="muted" style={{ fontSize: 12 }}>
                    Lean mass
                  </span>
                  <span className="num" style={{ fontSize: 19 }}>
                    {formatChange(composition.lean)}
                  </span>
                </div>
              </div>
            )}
            {composition && !numbers && (
              <div className="headline" style={{ fontSize: 20 }}>
                Fat {changeWords(composition.fat)}, lean mass {changeWords(composition.lean)}
              </div>
            )}
            <TrendLine series={fatSeries} height={80} />
            <div className="row muted" style={{ fontSize: 11, marginTop: -6 }}>
              <span>{monthDay(from)}</span>
              <span>body fat %, smoothed</span>
            </div>
            <p>
              {composition
                ? 'Home scales estimate body fat roughly, so watch the direction over weeks rather than single readings.'
                : 'Keep logging body fat now and then. Fat and lean mass changes show once readings span two weeks.'}
            </p>
          </>
        )}
      </section>

      <section className="card">
        <div>
          <div className="h">Weekly balance</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Average per day, compared with your maintenance
          </div>
        </div>
        <svg viewBox="0 0 310 160" width="100%" role="img" aria-label="Weekly balance for 8 weeks">
          <rect x="36" y="57" width="270" height="36" rx="4" fill="var(--track)" />
          <line x1="36" y1="75" x2="306" y2="75" stroke="var(--outline)" strokeWidth="1" />
          <text x="0" y="24" {...AXIS}>
            {numbers ? '+300' : 'more'}
          </text>
          {numbers && (
            <text x="0" y="79" {...AXIS}>
              0
            </text>
          )}
          <text x="0" y="134" {...AXIS}>
            {numbers ? '−300' : 'less'}
          </text>
          {weeks.map((v, i) => {
            const h = Math.max(3, Math.round(Math.min(400, Math.abs(v)) * 0.18))
            return (
              <rect
                key={i}
                x={COLUMNS[i] - 9}
                y={v < 0 ? 75 : 75 - h}
                width="18"
                height={h}
                rx="4"
                fill={balanceColor(v)}
                opacity={i === weeks.length - 1 ? 0.55 : undefined}
              />
            )
          })}
          <text x={COLUMNS[0]} y="152" textAnchor="middle" {...AXIS}>
            {weekLabel(0)}
          </text>
          <text x={COLUMNS[4]} y="152" textAnchor="middle" {...AXIS}>
            {weekLabel(4)}
          </text>
          <text x={COLUMNS[7]} y="152" textAnchor="middle" {...AXIS}>
            now
          </text>
        </svg>
        <div className="legend">
          <LegendDot color="var(--burn)" label="deficit" />
          <LegendDot color="var(--muted)" label="maintenance" />
          <LegendDot color="var(--fuel)" label="surplus" />
        </div>
      </section>
    </>
  )
}
