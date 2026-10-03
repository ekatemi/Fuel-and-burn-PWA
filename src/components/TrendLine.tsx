import type { TrendPoint, WeighIn } from '../lib/weight'

const W = 310
const PAD = 6

/** A trend as a line, with raw weigh-ins (if given) as faint dots behind it. */
export function TrendLine({
  series,
  weighIns = [],
  height = 70,
  minRange = 0.5,
}: {
  series: TrendPoint[]
  weighIns?: WeighIn[]
  height?: number
  /** Smallest half-height of the vertical scale, so normal noise doesn't look dramatic. */
  minRange?: number
}) {
  const n = series.length
  const index = new Map(series.map((p, i) => [p.date, i]))
  const dots = weighIns.filter((w) => index.has(w.date))
  const values = [...series.flatMap((p) => (p.value == null ? [] : [p.value])), ...dots.map((d) => d.kg)]
  if (!values.length || n < 2) return null

  const mid = (Math.max(...values) + Math.min(...values)) / 2
  const half = Math.max(minRange, (Math.max(...values) - Math.min(...values)) / 2)
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (n - 1)
  const y = (kg: number) => PAD + ((mid + half - kg) / (2 * half)) * (height - 2 * PAD)

  // Separate line pieces where the trend has gaps.
  const pieces: string[][] = [[]]
  series.forEach((p, i) => {
    if (p.value == null) {
      if (pieces[pieces.length - 1].length) pieces.push([])
    } else pieces[pieces.length - 1].push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
  })
  const last = [...series.keys()].reverse().find((i) => series[i].value != null)

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" aria-hidden="true">
      {dots.map((d) => (
        <circle
          key={d.date}
          cx={x(index.get(d.date)!)}
          cy={y(d.kg)}
          r="3"
          fill={d.anomaly ? 'none' : 'var(--outline)'}
          stroke={d.anomaly ? 'var(--outline)' : 'none'}
          opacity=".55"
        />
      ))}
      {pieces
        .filter((p) => p.length)
        .map((points, i) =>
          points.length === 1 ? (
            <circle key={i} cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r="2.5" fill="var(--burn)" />
          ) : (
            <polyline key={i} points={points.join(' ')} fill="none" stroke="var(--burn)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          ),
        )}
      {last != null && <circle cx={x(last)} cy={y(series[last].value!)} r="5" fill="var(--burn)" />}
    </svg>
  )
}
