import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useBackup } from '../state/backup'
import { BackIcon, MoreIcon, WatchIcon } from './Icons'

interface TopBarProps {
  title: string
  subtitle?: string
  withBack?: boolean
}

export function TopBar({ title, subtitle, withBack }: TopBarProps) {
  const { state, update, openSheet, resetData, showToast } = useApp()
  const { exportBackup, restoreBackup } = useBackup()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.menu, .menu-btn')) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const pick = (action: () => void) => () => {
    setMenuOpen(false)
    action()
  }

  return (
    <header className="top">
      {withBack ? (
        <div className="top-back">
          <button className="icon-btn" aria-label="Back" onClick={() => update((s) => ({ ...s, view: 'today' }))}>
            <BackIcon />
          </button>
          <h1 style={{ fontSize: 22 }}>{title}</h1>
        </div>
      ) : (
        <div>
          <div className="sub">{subtitle}</div>
          <h1>{title}</h1>
        </div>
      )}
      <div className="right">
        <span className="chip" title="Galaxy Watch 7, synced 5 minutes ago">
          <WatchIcon />
          <span>5 min</span>
        </span>
        <button
          className="icon-btn menu-btn"
          aria-label="More options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreIcon />
        </button>
      </div>
      {menuOpen && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={pick(() => openSheet('goal'))}>
            Change goal
          </button>
          <button role="menuitem" onClick={pick(() => openSheet('share'))}>
            Share your day
          </button>
          <button role="menuitem" onClick={pick(() => openSheet('profile'))}>
            Edit profile
          </button>
          <button
            role="menuitemcheckbox"
            aria-checked={!state.numbers}
            onClick={pick(() => {
              update((s) => ({ ...s, numbers: !s.numbers }))
              showToast(state.numbers ? 'Calm view on. Numbers are hidden' : 'Numbers are back')
            })}
          >
            {state.numbers ? 'Calm view (hide numbers)' : 'Show numbers'}
          </button>
          <button role="menuitem" onClick={pick(exportBackup)}>
            Export backup
          </button>
          <button role="menuitem" onClick={pick(restoreBackup)}>
            Restore from backup
          </button>
          <button
            role="menuitem"
            onClick={pick(() => {
              if (window.confirm('Erase your diary, profile and saved foods, and start over?')) resetData()
            })}
          >
            Start over
          </button>
          <button role="menuitem" onClick={pick(() => showToast('Fuel & Burn. Your data stays on this device.'))}>
            About
          </button>
        </div>
      )}
    </header>
  )
}
