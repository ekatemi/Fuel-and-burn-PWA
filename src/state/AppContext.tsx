import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { freshState } from '../data/demo'
import { useToday } from '../lib/dates'
import { dayBurn, maintenance, nowTime, toMeal } from '../lib/model'
import { currentBodyFat, trendOn, weighInList, type WeighIn } from '../lib/weight'
import type { AppState, KnownItem, SheetName } from '../types'
import { normalizeState } from './backup'

const STORAGE_KEY = 'fuel-and-burn-v1'
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
  update: (fn: (s: AppState) => AppState) => void
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
  addMeals: (items: KnownItem[], date: string) => number[]
  removeMeals: (ids: number[]) => void
  resetData: () => void
  sheet: SheetName | null
  openSheet: (name: SheetName) => void
  closeSheet: () => void
  toast: ToastData | null
  showToast: (message: string, undo?: () => void) => void
  hideToast: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function loadState(): AppState {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? freshState()
  } catch {
    // Unreadable or blocked storage: start from scratch.
    return freshState()
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(loadState)
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const today = useToday()
  // null follows today, so the diary rolls over at midnight.
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or blocked: the app keeps working for this session.
    }
  }, [state])

  const hideToast = useCallback(() => {
    window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const value = useMemo<AppContextValue>(() => {
    const removeMeals = (ids: number[]) =>
      setState((s) => ({ ...s, meals: s.meals.filter((m) => !ids.includes(m.id)) }))

    const addMeals = (items: KnownItem[], date: string) => {
      const time = nowTime()
      const meals = items.map((item, i) => toMeal(item, state.nextId + i, date, time))
      setState((s) => ({ ...s, meals: [...s.meals, ...meals], nextId: s.nextId + meals.length }))
      return meals.map((m) => m.id)
    }

    const weighIns = weighInList(state.weighIns)
    const trendWeight = trendOn(weighIns, today)
    const bodyWeight = trendWeight ?? state.weight
    const bodyFatPct = currentBodyFat(state.bodyFat)
    const maint = state.profile ? maintenance(state.profile, bodyWeight, bodyFatPct) : DEFAULT_MAINT

    return {
      state,
      update: setState,
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
      resetData: () => setState(freshState()),
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      toast,
      showToast,
      hideToast,
    }
  }, [state, sheet, toast, today, pickedDate, showToast, hideToast])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
