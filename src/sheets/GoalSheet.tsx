import { useState } from 'react'
import { goalChangeText, GoalPicker } from '../components/GoalPicker'
import { Sheet } from '../components/Sheet'
import { fmt, goalIntake, goalLabel, GOALS } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { Goal } from '../types'

export function GoalSheet() {
  const { state, maint, update, closeSheet, showToast } = useApp()
  const [draft, setDraft] = useState<Goal>(state.goal)
  const [intakeLo, intakeHi] = goalIntake(maint, draft)

  const save = () => {
    update((s) => ({ ...s, goal: draft }))
    closeSheet()
    showToast('Goal saved: ' + goalLabel(draft))
  }

  return (
    <Sheet title="Your goal">
      <GoalPicker goal={draft} onChange={setDraft} />
      <div className="card inset">
        <span className="muted" style={{ fontSize: 13 }}>
          With your maintenance of ~{fmt(maint)}
        </span>
        <div className="headline" style={{ fontSize: 22 }}>
          {state.numbers ? (
            <>
              Eat about {fmt(intakeLo)}–{fmt(intakeHi)}
              <small>kcal a day</small>
            </>
          ) : (
            GOALS[draft.type].name
          )}
        </div>
        <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{goalChangeText(draft, maint)}</span>
      </div>
      <button className="bigbtn primary" onClick={save}>
        Save goal
      </button>
    </Sheet>
  )
}
