import { useId, type ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { CloseIcon } from './Icons'

export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const { closeSheet } = useApp()
  const titleId = useId()
  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="handle" />
        <div className="row center">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={closeSheet}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
