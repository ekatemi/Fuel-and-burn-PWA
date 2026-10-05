import { useEffect, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { longLabel } from '../lib/dates'
import { mealsOn, status, weekSummary } from '../lib/model'
import { drawShareCard, shareCard, type ShareCardInput } from '../lib/shareCard'
import { useApp } from '../state/AppContext'

const NOTE_DELAY_MS = 350

export function ShareSheet() {
  const { state, today, diaryDate, maint, burnOn, showToast } = useApp()
  const [showKcal, setShowKcal] = useState(false)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)

  // Shares the day open in the diary; from any other tab, today.
  const date = state.view === 'fuel' ? diaryDate : today
  const meals = mealsOn(state.meals, date)
  const week = weekSummary(state.meals, today, burnOn)
  const weekStatus = week.loggedDays ? status(week.balance, maint, state.goal) : null

  const input: ShareCardInput = {
    meals,
    targets: state.targets,
    numbers: state.numbers,
    showKcal,
    note: note.trim(),
    dateLabel: longLabel(date),
    isToday: date === today,
    weekStatus: weekStatus?.title ?? null,
    weekOnTarget: weekStatus?.kind === 'on',
  }
  const inputKey = JSON.stringify(input)

  useEffect(() => {
    let cancelled = false
    // Redraw at once for the switch, a moment after typing stops for the note.
    const timer = window.setTimeout(async () => {
      const canvas = await drawShareCard(JSON.parse(inputKey))
      if (!cancelled) setPreview(canvas.toDataURL('image/png'))
    }, preview ? NOTE_DELAY_MS : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey])

  const share = async () => {
    setBusy(true)
    try {
      const result = await shareCard(await drawShareCard(input), 'My food today: ' + meals.map((m) => m.name).join(', '))
      if (result === 'downloaded') showToast('Image saved to your downloads')
    } catch {
      showToast('Couldn’t create the image. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Share your day">
      {meals.length === 0 ? (
        <p>Nothing logged on this day yet. Add some food first, then share it.</p>
      ) : (
        <>
          <img
            className="share-preview"
            src={preview || undefined}
            alt="Preview of the card you’ll share: the day’s food, protein, fat, carbs, fiber and this week’s status"
          />
          {state.numbers && (
            <div className="row center" style={{ minHeight: 52 }}>
              <span className="col" style={{ gap: 2 }}>
                <span className="h">Show calories</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Off by default. Food and macros are enough to cheer each other on.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showKcal}
                aria-label="Show calories"
                className={showKcal ? 'switch on' : 'switch'}
                onClick={() => setShowKcal((v) => !v)}
              >
                <span />
              </button>
            </div>
          )}
          <label className="fld">
            <span>Add a note (optional)</span>
            <input type="text" maxLength={60} placeholder="e.g. Tried a new salad!" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button className="bigbtn primary" disabled={busy} onClick={share}>
            Share
          </button>
          <p className="muted fine">Opens your phone’s share menu, so you can pick WhatsApp and your chat.</p>
        </>
      )}
    </Sheet>
  )
}
