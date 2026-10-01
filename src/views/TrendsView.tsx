import { TipBox } from '../components/TipBox'
import { TopBar } from '../components/TopBar'
import { BODYFAT, OLD_WEEKS } from '../data/demo'
import { weekBalance } from '../lib/model'
import { useApp } from '../state/AppContext'

// Bar and point centres for the eight weeks, shared by both charts.
const COLUMNS = [53, 87, 120, 154, 188, 222, 255, 289]
const AXIS = { fontSize: 10, fill: 'var(--muted)' }
const fatY = (pct: number) => Math.round(10 + (28 - pct) * 55.5)
const balanceColor = (v: number) => (Math.abs(v) <= 100 ? 'var(--muted)' : v < 0 ? 'var(--burn)' : 'var(--fuel)')

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <span className="legend-dot" style={{ background: color }} />
      {label}
    </span>
  )
}

export function TrendsView() {
  const { state } = useApp()
  const { numbers } = state
  const weeks = [...OLD_WEEKS, Math.round(weekBalance(state.meals))]
  const stats = [
    { label: 'Body fat', value: '−0.9 kg', color: 'var(--burn-ink)' },
    { label: 'Lean mass', value: '+0.2 kg', color: 'var(--ink)' },
    { label: 'Weight', value: '−0.7 kg', color: 'var(--ink)' },
    { label: 'Latest weigh-in', value: state.weight.toFixed(1) + ' kg', color: 'var(--ink)' },
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
        <p>
          Fat is going down while muscle holds. That’s what recomposition looks like, even when the scale barely moves.
        </p>
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
            Aug 3
          </text>
          <text x={COLUMNS[4]} y="152" textAnchor="middle" {...AXIS}>
            Aug 31
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
        <div className="divider" />
        <div className="row">
          <span className="h">Body fat</span>
          {numbers && (
            <span className="muted" style={{ fontSize: 13 }}>
              27.8 to 26.5%
            </span>
          )}
        </div>
        <svg viewBox="0 0 310 110" width="100%" role="img" aria-label="Body fat trending down over 8 weeks">
          <polyline
            points={BODYFAT.map((f, i) => `${COLUMNS[i]},${fatY(f)}`).join(' ')}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {BODYFAT.map((f, i) => (
            <circle key={i} cx={COLUMNS[i]} cy={fatY(f)} r="3.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
          ))}
        </svg>
      </section>

      <TipBox title="The surplus week in August">
        One higher week didn’t change the direction: body fat kept trending down afterwards. Single weeks go up and
        down, and the long line is what matters.
      </TipBox>
    </>
  )
}
