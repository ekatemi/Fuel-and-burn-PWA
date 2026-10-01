import { ACTIVITY } from '../lib/model'
import type { Activity, Profile, Sex } from '../types'

/** Form values as typed; numbers stay strings until they are validated. */
export interface ProfileDraft {
  sex: Sex | ''
  age: string
  height: string
  weight: string
  activity: Activity | ''
}

export const EMPTY_PROFILE: ProfileDraft = { sex: '', age: '', height: '', weight: '', activity: '' }

export const draftFrom = (profile: Profile, weight: number): ProfileDraft => ({
  sex: profile.sex,
  age: String(profile.age),
  height: String(profile.heightCm),
  weight: String(weight),
  activity: profile.activity,
})

const toNumber = (value: string) => parseFloat(value.replace(',', '.'))

/** Returns the validated profile and weight, or a message saying what is missing. */
export function parseProfile(draft: ProfileDraft): { profile: Profile; weight: number } | { error: string } {
  const age = Math.round(toNumber(draft.age))
  const heightCm = Math.round(toNumber(draft.height))
  const weight = Math.round(toNumber(draft.weight) * 10) / 10
  if (!draft.sex) return { error: 'Choose a sex for the formula.' }
  if (!(age >= 18 && age <= 100)) {
    return { error: age < 18 ? 'Fuel & Burn is designed for adults, 18 and over.' : 'Enter your age in years.' }
  }
  if (!(heightCm >= 120 && heightCm <= 230)) return { error: 'Enter your height in centimetres, e.g. 165.' }
  if (!(weight >= 30 && weight <= 300)) return { error: 'Enter your weight in kilograms, e.g. 62.5.' }
  if (!draft.activity) return { error: 'Choose your activity level.' }
  return { profile: { sex: draft.sex, age, heightCm, activity: draft.activity }, weight }
}

const SEXES: [Sex, string][] = [
  ['female', 'Female'],
  ['male', 'Male'],
]

export function ProfileFields({ draft, onChange }: { draft: ProfileDraft; onChange: (draft: ProfileDraft) => void }) {
  const number = (key: 'age' | 'height' | 'weight', label: string, placeholder: string) => (
    <label className="fld">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={placeholder}
        value={draft[key]}
        onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
      />
    </label>
  )

  return (
    <>
      <div className="col" style={{ gap: 8 }}>
        <span className="h">Sex</span>
        <div className="seg full two" role="radiogroup" aria-label="Sex">
          {SEXES.map(([sex, label]) => (
            <button key={sex} type="button" role="radio" aria-checked={draft.sex === sex} onClick={() => onChange({ ...draft, sex })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid3">
        {number('age', 'Age', 'years')}
        {number('height', 'Height, cm', 'cm')}
        {number('weight', 'Weight, kg', 'kg')}
      </div>
      <div className="col" style={{ gap: 8 }}>
        <span className="h">Activity level</span>
        <div role="radiogroup" aria-label="Activity level" className="col" style={{ gap: 8 }}>
          {(Object.keys(ACTIVITY) as Activity[]).map((activity) => (
            <button
              key={activity}
              type="button"
              role="radio"
              aria-checked={draft.activity === activity}
              className="gcard"
              onClick={() => onChange({ ...draft, activity })}
            >
              <span className="col" style={{ gap: 2, textAlign: 'left' }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{ACTIVITY[activity].name}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {ACTIVITY[activity].desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
