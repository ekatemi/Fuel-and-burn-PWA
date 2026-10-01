import type { ReactNode } from 'react'
import { BulbIcon } from './Icons'

export function TipBox({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="tip" aria-label="Tip">
      <div className="t">
        <BulbIcon />
        <span>{title}</span>
      </div>
      <p>{children}</p>
      {actions && <div className="acts">{actions}</div>}
    </section>
  )
}
