import type { ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import type { View } from '../types'
import { BurnIcon, FuelIcon, TodayIcon } from './Icons'

const TABS: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'today', label: 'Today', icon: <TodayIcon /> },
  { view: 'fuel', label: 'Fuel', icon: <FuelIcon /> },
  { view: 'burn', label: 'Burn', icon: <BurnIcon /> },
]

export function NavBar() {
  const { state, update } = useApp()
  // Trends is opened from Today, so it keeps the Today tab highlighted.
  const current = state.view === 'trends' ? 'today' : state.view
  return (
    <nav className="navbar" aria-label="Main">
      <div className="inner">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            aria-current={current === tab.view ? 'page' : undefined}
            onClick={() => update((s) => ({ ...s, view: tab.view }))}
          >
            <span className="pill">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
