import { MACROS, macroSum } from '../lib/model'
import { useApp } from '../state/AppContext'

export function MacroBlock() {
  const { state } = useApp()
  const showNumbers = state.numbers
  return (
    <div className="macros">
      {MACROS.map(({ key, icon, label }) => {
        const value = Math.round(macroSum(state.meals, key))
        const target = state.targets[key]
        const pct = Math.min(100, (value / Math.max(target, 1)) * 100)
        const cls = value < target ? 'm-low' : 'm-ok'
        const statusText =
          value < target
            ? showNumbers
              ? `${target - value} g to go`
              : pct >= 75
                ? 'almost there'
                : 'room for more'
            : value === target
              ? '✓ on target'
              : showNumbers
                ? `✓ +${value - target} g extra`
                : '✓ target reached'
        return (
          <div className="mrow" key={key}>
            <div className="mhead">
              <span className="mname">
                <span aria-hidden="true">{icon}</span> {label}
              </span>
              {showNumbers && (
                <span>
                  <b className="num">{value}</b> <span className="muted">/ {target} g</span>
                </span>
              )}
            </div>
            <div
              className="mtrack"
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-valuenow={Math.min(value, target)}
            >
              <div className={`mfill ${cls}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`mst ${cls}`}>{statusText}</span>
          </div>
        )
      })}
    </div>
  )
}
