import { useState, type FormEvent } from 'react'
import { PlusIcon, TrashIcon } from '../components/Icons'
import { draftFrom, EMPTY_PROFILE, parseProfile, ProfileFields } from '../components/ProfileFields'
import { Sheet } from '../components/Sheet'
import { SNACKS } from '../data/demo'
import { fmt, MACROS, planKcal } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { MacroKey } from '../types'

export function FavsSheet() {
  const { state, update, openSheet } = useApp()
  return (
    <Sheet title="My foods">
      {state.favs.length ? (
        <div className="list">
          {state.favs.map((fav) => (
            <div className="item" key={fav.id}>
              <div className="main">
                <span className="nm">{fav.name}</span>
                <span className="pt">
                  {fav.portion}
                  {state.numbers && ` · ${fmt(fav.kcal)} kcal`}
                </span>
              </div>
              <button
                className="icon-btn"
                aria-label={`Remove ${fav.name} from My foods`}
                onClick={() => update((s) => ({ ...s, favs: s.favs.filter((f) => f.id !== fav.id) }))}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p>No saved foods yet.</p>
      )}
      <button className="bigbtn secondary" onClick={() => openSheet('newfav')}>
        <PlusIcon />
        New food
      </button>
    </Sheet>
  )
}

export function TargetsSheet() {
  const { state, maint, update, closeSheet } = useApp()
  const { targets } = state
  const kcal = 4 * targets.protein + 9 * targets.fat + 4 * targets.carbs
  const plan = planKcal(state.goal, maint)
  const fits = Math.abs(kcal - plan) <= 150

  const adjust = (key: MacroKey, delta: number) =>
    update((s) => ({ ...s, targets: { ...s.targets, [key]: Math.max(0, s.targets[key] + delta) } }))

  return (
    <Sheet title="Daily targets">
      <div className="col" style={{ gap: 4 }}>
        {MACROS.map(({ key, icon, label }) => {
          const step = key === 'fiber' ? 1 : 5
          return (
            <div className="trow" key={key}>
              <span className="mname">
                <span aria-hidden="true">{icon}</span> {label}
              </span>
              <div className="tctl">
                <button aria-label={`Lower ${label} target`} onClick={() => adjust(key, -step)}>
                  −
                </button>
                <span className="num">{targets[key]}</span>
                <button aria-label={`Raise ${label} target`} onClick={() => adjust(key, step)}>
                  +
                </button>
              </div>
              <span className="muted">g a day</span>
            </div>
          )
        })}
      </div>
      <div className={fits ? 'card inset' : 'tip'}>
        <p>
          Protein, fat and carbs add up to about <b>{fmt(kcal)} kcal</b>.{' '}
          {fits
            ? `That matches your plan of ~${fmt(plan)}.`
            : kcal > plan
              ? `That’s more than your plan of ~${fmt(plan)}. You could lower carbs or fat a little.`
              : `That’s less than your plan of ~${fmt(plan)}. You could raise carbs or fat a little.`}
        </p>
      </div>
      <button className="bigbtn primary" onClick={closeSheet}>
        Done
      </button>
    </Sheet>
  )
}

export function WeightSheet() {
  const { state, update, today, closeSheet, showToast } = useApp()
  const [draft, setDraft] = useState(state.weight)
  const step = (delta: number) => setDraft((w) => Math.max(0, Math.round((w + delta) * 10) / 10))

  const save = () => {
    update((s) => ({ ...s, weight: draft, weighIns: { ...s.weighIns, [today]: draft } }))
    closeSheet()
    showToast('Weight saved. Your trend updates as the week goes on.')
  }

  return (
    <Sheet title="Log weight">
      <p>Best in the morning, before eating. Daily ups and downs are normal; we only use the trend.</p>
      <div className="stepper">
        <button aria-label="Decrease" onClick={() => step(-0.1)}>
          −
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 44, fontWeight: 600 }} aria-live="polite">
            {draft.toFixed(1)}
          </div>
          <div className="muted">kg</div>
        </div>
        <button aria-label="Increase" onClick={() => step(0.1)}>
          +
        </button>
      </div>
      <button className="bigbtn primary" onClick={save}>
        Save
      </button>
    </Sheet>
  )
}

export function SnacksSheet() {
  const { state } = useApp()
  return (
    <Sheet title="Lighter snacks">
      <div className="list">
        {SNACKS.map((snack) => (
          <div className="item" key={snack.name}>
            <div className="main">
              <span className="nm">{snack.name}</span>
              <span className="pt">{state.numbers ? `${snack.kcal}, ${snack.note}` : snack.note}</span>
            </div>
          </div>
        ))}
      </div>
      <p>Only ideas. Chips can absolutely stay on the menu.</p>
    </Sheet>
  )
}

export function ProfileSheet() {
  const { state, today, update, closeSheet, showToast } = useApp()
  const [draft, setDraft] = useState(state.profile ? draftFrom(state.profile, state.weight) : EMPTY_PROFILE)
  const [error, setError] = useState('')

  const save = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseProfile(draft)
    if ('error' in parsed) return setError(parsed.error)
    const { profile, weight } = parsed
    update((s) => ({
      ...s,
      profile,
      weight,
      weighIns: weight === s.weight ? s.weighIns : { ...s.weighIns, [today]: weight },
    }))
    closeSheet()
    showToast('Profile saved. Your maintenance is updated.')
  }

  return (
    <Sheet title="Your profile">
      <form className="col" style={{ gap: 14 }} onSubmit={save} noValidate>
        <ProfileFields
          draft={draft}
          onChange={(next) => {
            setDraft(next)
            setError('')
          }}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="bigbtn primary" type="submit">
          Save
        </button>
      </form>
    </Sheet>
  )
}
