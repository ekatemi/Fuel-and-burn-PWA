import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { freshState } from '../data/demo'
import { useToday } from '../lib/dates'
import { newId } from '../lib/ids'
import { dayBurn, maintenance, nowTime, toMeal } from '../lib/model'
import { currentBodyFat, trendOn, weighInList, type WeighIn } from '../lib/weight'
import type { AppState, KnownItem, SheetName } from '../types'
import { freshDoc, type StoredDoc } from './schema'
import { loadDoc, requestPersistence, saveDoc } from './storage'
import { emptySync, stamp } from './sync'

const TOAST_MS = 4500
// Only used before a profile exists, when no view that shows it is reachable.
const DEFAULT_MAINT = 2000

export interface ToastData {
  id: number
  message: string
  undo?: () => void
}

interface AppContextValue {
  state: AppState
  /** The stored document: state plus its change log. Used for backups. */
  doc: StoredDoc
  update: (fn: (s: AppState) => AppState) => void
  /** Replaces everything, e.g. from a backup. */
  replaceDoc: (doc: StoredDoc) => void
  /** The current local day, as YYYY-MM-DD. */
  today: string
  /** All weigh-ins, oldest first, anomalies flagged. */
  weighIns: WeighIn[]
  /** Smoothed weight today, or null with no weigh-in in the last 7 days. */
  trendWeight: number | null
  /** Weight used in formulas: the trend weight, else the latest weigh-in. */
  bodyWeight: number
  /** Body fat % from logged readings, or null when none were logged. */
  bodyFatPct: number | null
  /** Estimated kcal burned a day, from the profile, body weight and body fat if logged. */
  maint: number
  /** Burn for a day: maintenance adjusted for that day's logged activity. */
  burnOn: (date: string) => number
  /** The day shown in the Fuel diary. */
  diaryDate: string
  setDiaryDate: (date: string) => void
  /** Logs the items as meals on the given day at the current time and returns their ids. */
  addMeals: (items: KnownItem[], date: string) => string[]
  removeMeals: (ids: string[]) => void
  resetData: () => void
  sheet: SheetName | null
  openSheet: (name: SheetName) => void
  closeSheet: () => void
  toast: ToastData | null
  showToast: (message: string, undo?: () => void) => void
  hideToast: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  // null while the saved data loads (IndexedDB is asynchronous).
  const [doc, setDoc] = useState<StoredDoc | null>(null)
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const today = useToday()
  // null follows today, so the diary rolls over at midnight.
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadDoc().then((saved) => {
      if (cancelled) return
      setDoc(saved)
      requestPersistence()
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Save every change. The first save also stores data that was just migrated or carried over
    // from localStorage, so it is in IndexedDB in the current format from then on.
    if (doc) saveDoc(doc)
  }, [doc])

  const hideToast = useCallback(() => {
    window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setDoc((d) => {
      if (!d) return d
      const next = fn(d.state)
      return next === d.state ? d : { ...d, state: next, sync: stamp(d.state, next, d.sync) }
    })
  }, [])

  const value = useMemo<AppContextValue | null>(() => {
    if (!doc) return null
    const { state } = doc

    const removeMeals = (ids: string[]) => update((s) => ({ ...s, meals: s.meals.filter((m) => !ids.includes(m.id)) }))

    const addMeals = (items: KnownItem[], date: string) => {
      const time = nowTime()
      const meals = items.map((item) => toMeal(item, newId(), date, time))
      update((s) => ({ ...s, meals: [...s.meals, ...meals] }))
      return meals.map((m) => m.id)
    }

    const weighIns = weighInList(state.weighIns)
    const trendWeight = trendOn(weighIns, today)
    const bodyWeight = trendWeight ?? state.weight
    const bodyFatPct = currentBodyFat(state.bodyFat)
    const maint = state.profile ? maintenance(state.profile, bodyWeight, bodyFatPct) : DEFAULT_MAINT

    return {
      state,
      doc,
      update,
      replaceDoc: setDoc,
      today,
      weighIns,
      trendWeight,
      bodyWeight,
      bodyFatPct,
      maint,
      burnOn: (date) => dayBurn(maint, state.meals, state.activities, date),
      diaryDate: pickedDate && pickedDate < today ? pickedDate : today,
      setDiaryDate: (date) => setPickedDate(date < today ? date : null),
      addMeals,
      removeMeals,
      // Starting over clears the change log too: there is nothing left to sync.
      resetData: () => setDoc({ ...freshDoc(), state: freshState(), sync: emptySync() }),
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      toast,
      showToast,
      hideToast,
    }
  }, [doc, update, sheet, toast, today, pickedDate, showToast, hideToast])

  // A blank screen in the app's background colour for the moment the data loads.
  if (!value) return null
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
