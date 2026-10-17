import { TrendLine } from '../components/TrendLine'
import { TopBar } from '../components/TopBar'
import { addDays, monthDay } from '../lib/dates'
import { expectedVsActual, type ExpectedVsActual } from '../lib/tdee'
import { bodyFatSeries, changeWords, formatChange, trendChange, trendSeries } from '../lib/weight'
import { useApp } from '../state/AppContext'

const TREND_DAYS = 56
// Body fat moves slowly and readings are noisy: compare points at least two weeks apart.
const MIN_COMPOSITION_SPAN_DAYS = 14

const COMPARISON: Record<ExpectedVsActual['verdict'], { title: string; text: string }> = {
  'as-expected': {
    title: 'About as expected',
    text: 'Your weight is moving about as your food diary and the standard formula predict: the formula fits you well.',
  },
  lower: {
    title: 'A bit lower than expected',
    text: 'Your weight came out a bit lower than the standard formula predicts for your diary: you probably burn a bit more. Your maintenance estimate learns this from these weeks, and your plan follows it.',
  },
  higher: {
    title: 'A bit higher than expected',
    text: 'Your weight came out a bit higher than the standard formula predicts for your diary. Water, salt and the odd unlogged snack all play a part, and some people burn a little less than the formula says. It isn’t a reason to eat less: your maintenance estimate learns from these weeks.',
  },
}

function LegendDot({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span>
      <span className="legend-dot" style={hollow ? { border: `1.5px solid ${color}` } : { background: color }} />
      {label}
    </span>
  )
}

export function TrendsView() {
  const { state, today, weighIns, trendWeight, bodyFatPct, maintEstimate } = useApp()
  const { numbers } = state

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

  // Against the formula: the learned estimate is fitted to these same weeks, so it would always agree.
  const formula = maintEstimate?.formula
  const comparison = formula
    ? expectedVsActual(state.meals, weighIns, today, formula, () => formula)
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
          <span className="h">Expected vs actual</span>
          {comparison && (
            <span className="muted" style={{ fontSize: 13 }}>
              since {monthDay(comparison.from)}
            </span>
          )}
        </div>
        {comparison ? (
          <>
            {numbers ? (
              <div className="grid2">
                <div className="stat">
                  <span className="muted" style={{ fontSize: 12 }}>
                    Expected by the formula
                  </span>
                  <span className="num" style={{ fontSize: 19 }}>
                    {formatChange(comparison.expected)}
                  </span>
                </div>
                <div className="stat">
                  <span className="muted" style={{ fontSize: 12 }}>
                    Your weight trend
                  </span>
                  <span className="num" style={{ fontSize: 19, color: 'var(--burn-ink)' }}>
                    {formatChange(comparison.actual)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="headline" style={{ fontSize: 20 }}>
                {COMPARISON[comparison.verdict].title}
              </div>
            )}
            <p>{COMPARISON[comparison.verdict].text}</p>
          </>
        ) : (
          <p>
            Log food on most days of a week, with a few weigh-ins around it, and you’ll see here whether your weight moves
            the way your diary predicts.
          </p>
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

    </>
  )
}
