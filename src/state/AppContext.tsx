import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { freshState } from '../data/demo'
import { todayKey, useToday } from '../lib/dates'
import { maintenance, nowTime, toMeal } from '../lib/model'
import type { AppState, KnownItem, SheetName } from '../types'

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
  /** Estimated kcal burned a day, from the profile and latest weight. */
  maint: number
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
  const today = todayKey()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && Array.isArray(saved.meals) && Array.isArray(saved.favs)) {
      // Meals saved before the diary was dated belong to the day they are first loaded on.
      const meals = saved.meals.map((m: AppState['meals'][number]) => (m.date ? m : { ...m, date: today }))
      return { ...freshState(), ...saved, meals }
    }
  } catch {
    // Unreadable or blocked storage: start from the sample data.
  }
  return freshState()
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

    return {
      state,
      update: setState,
      today,
      maint: state.profile ? maintenance(state.profile, state.weight) : DEFAULT_MAINT,
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
