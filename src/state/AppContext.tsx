import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { freshState } from '../data/demo'
import { nowTime, toMeal } from '../lib/model'
import type { AppState, KnownItem, SheetName } from '../types'

const STORAGE_KEY = 'fuel-and-burn-v1'
const TOAST_MS = 4500

export interface ToastData {
  id: number
  message: string
  undo?: () => void
}

interface AppContextValue {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  /** Logs the items as meals at the current time and returns their ids. */
  addMeals: (items: KnownItem[]) => number[]
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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && Array.isArray(saved.meals) && Array.isArray(saved.favs)) {
      return { ...freshState(), ...saved }
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

    const addMeals = (items: KnownItem[]) => {
      const time = nowTime()
      const meals = items.map((item, i) => toMeal(item, state.nextId + i, time))
      setState((s) => ({ ...s, meals: [...s.meals, ...meals], nextId: s.nextId + meals.length }))
      return meals.map((m) => m.id)
    }

    return {
      state,
      update: setState,
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
  }, [state, sheet, toast, showToast, hideToast])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
