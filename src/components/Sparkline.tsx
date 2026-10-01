import type { PeriodItem } from '../lib/model'

/** Running total of the period's balances, as a line ending in a dot. */
export function Sparkline({ items }: { items: PeriodItem[] }) {
  const totals: number[] = []
  let sum = 0
  for (const item of items) {
    if (item.value == null) continue
    sum += item.value
    totals.push(sum)
  }
  if (totals.length < 2) totals.unshift(0)

  const min = Math.min(...totals, 0)
  const max = Math.max(...totals, 0)
  const range = max - min || 1
  const points = totals.map((v, i) => [
    Math.round(6 + i * (298 / (totals.length - 1))),
    Math.round(6 + ((max - v) / range) * 48),
  ])
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg viewBox="0 0 310 62" width="100%" height="84" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        vectorEffect="non-scaling-stroke"
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="var(--burn)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="5" fill="var(--burn)" />
    </svg>
  )
}
