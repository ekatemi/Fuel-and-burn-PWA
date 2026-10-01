import { useState, type FormEvent } from 'react'
import { Sheet } from '../components/Sheet'
import { useApp } from '../state/AppContext'

const EMPTY = { name: '', portion: '', kcal: '', protein: '', fat: '', carbs: '', fiber: '' }
type Field = keyof typeof EMPTY

const toNumber = (value: string) => Math.max(0, parseFloat(value.replace(',', '.')) || 0)

export function NewFoodSheet() {
  const { update, closeSheet, showToast } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const field = (key: Field, label: string, placeholder: string, numeric = false) => (
    <label className="fld">
      <span>{label}</span>
      <input
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        min={numeric ? 0 : undefined}
        autoComplete="off"
        autoFocus={key === 'name'}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  )

  const save = (e: FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    const kcal = parseFloat(form.kcal.replace(',', '.'))
    if (!name) return setError('Give it a name.')
    if (!(kcal >= 0)) return setError('Add the calories for one portion.')
    update((s) => ({
      ...s,
      nextId: s.nextId + 1,
      favs: [
        ...s.favs,
        {
          id: s.nextId,
          name,
          portion: form.portion.trim() || '1 portion',
          kcal: Math.round(kcal),
          protein: toNumber(form.protein),
          carbs: toNumber(form.carbs),
          fat: toNumber(form.fat),
          fiber: toNumber(form.fiber),
        },
      ],
    }))
    closeSheet()
    showToast('Saved to My foods')
  }

  return (
    <Sheet title="New food">
      <form className="col" style={{ gap: 14 }} onSubmit={save} noValidate>
        <p>Save something you eat often. It appears in My foods for one-tap logging.</p>
        {field('name', 'Name', 'e.g. Coffee with milk')}
        {field('portion', 'Portion', 'e.g. 1 cup')}
        {field('kcal', 'Calories per portion', 'kcal', true)}
        <div className="grid2">
          {field('protein', 'Protein, g', 'optional', true)}
          {field('fat', 'Fat, g', 'optional', true)}
          {field('carbs', 'Carbs, g', 'optional', true)}
          {field('fiber', 'Fiber, g', 'optional', true)}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="bigbtn primary" type="submit">
          Save to My foods
        </button>
        <p className="muted fine">Tip: tap the star next to anything you’ve logged to save it here.</p>
      </form>
    </Sheet>
  )
}
