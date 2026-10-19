import { useRef, useState, type FormEvent } from 'react'
import { CameraIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { AiError, aiAvailable, readLabel } from '../lib/aiFood'
import { newId } from '../lib/ids'
import { shrinkPhoto } from '../lib/photo'
import { useApp } from '../state/AppContext'

const EMPTY = { name: '', portion: '', kcal: '', protein: '', fat: '', carbs: '', fiber: '' }
type Field = keyof typeof EMPTY

const toNumber = (value: string) => Math.max(0, parseFloat(value.replace(',', '.')) || 0)
const oneDecimal = (n: number) => String(Math.round(n * 10) / 10)

export function NewFoodSheet() {
  const { update, closeSheet, showToast } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [labelNote, setLabelNote] = useState('')
  const camera = useRef<HTMLInputElement>(null)

  /** Fills the form from a photo of the nutrition table: one serving if the label gives it, else 100 g. */
  const fromLabel = async (file: File | undefined) => {
    if (!file) return
    setReading(true)
    setLabelNote('')
    try {
      const label = await readLabel(await shrinkPhoto(file))
      if (!label) {
        setLabelNote('Couldn’t find a nutrition table in this photo. Try closer, with the table filling the picture.')
        return
      }
      const amount = label.serving ?? 100
      const scale = (n: number | null) => (n == null ? '' : oneDecimal((n * amount) / 100))
      setForm((f) => ({
        name: f.name.trim() ? f.name : label.name,
        portion: `${amount} ${label.unit}`,
        kcal: String(Math.round((label.kcal * amount) / 100)),
        protein: scale(label.protein),
        fat: scale(label.fat),
        carbs: scale(label.carbs),
        fiber: scale(label.fiber),
      }))
      setLabelNote(
        `Filled in for ${amount} ${label.unit}${label.serving ? ', one serving on the label' : ''}. Check the numbers against the package.`,
      )
    } catch (e) {
      setLabelNote(
        e instanceof AiError && e.reason === 'rate_limited'
          ? 'Smart recognition is resting for today. You can type the numbers in.'
          : 'Couldn’t read the photo. You can type the numbers in.',
      )
    } finally {
      setReading(false)
    }
  }

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
      favs: [
        ...s.favs,
        {
          id: newId(),
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
        {aiAvailable() && (
          <>
            <button type="button" className="bigbtn secondary voice" disabled={reading} onClick={() => camera.current?.click()}>
              <CameraIcon />
              {reading ? 'Reading the label…' : 'Fill from a label photo'}
            </button>
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                fromLabel(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {labelNote && (
              <span className="muted" style={{ fontSize: 13 }} aria-live="polite">
                {labelNote}
              </span>
            )}
          </>
        )}
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
