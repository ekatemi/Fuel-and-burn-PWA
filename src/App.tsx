import { useEffect } from 'react'
import { NavBar } from './components/NavBar'
import { Toast } from './components/Toast'
import { AddActivitySheet } from './sheets/AddActivitySheet'
import { AddFoodSheet } from './sheets/AddFoodSheet'
import { GoalSheet } from './sheets/GoalSheet'
import { NewFoodSheet } from './sheets/NewFoodSheet'
import { FavsSheet, ProfileSheet, SnacksSheet, TargetsSheet, WeightSheet } from './sheets/SmallSheets'
import { useApp } from './state/AppContext'
import type { SheetName, View } from './types'
import { BurnView } from './views/BurnView'
import { FuelView } from './views/FuelView'
import { Onboarding } from './views/Onboarding'
import { TodayView } from './views/TodayView'
import { TrendsView } from './views/TrendsView'

const VIEWS: Record<View, () => React.JSX.Element> = {
  today: TodayView,
  fuel: FuelView,
  burn: BurnView,
  trends: TrendsView,
}

const SHEETS: Record<SheetName, () => React.JSX.Element> = {
  add: AddFoodSheet,
  activity: AddActivitySheet,
  goal: GoalSheet,
  profile: ProfileSheet,
  newfav: NewFoodSheet,
  favs: FavsSheet,
  targets: TargetsSheet,
  weight: WeightSheet,
  snacks: SnacksSheet,
}

export default function App() {
  const { state, sheet, closeSheet } = useApp()
  const CurrentView = VIEWS[state.view] ?? TodayView
  const CurrentSheet = sheet && SHEETS[sheet]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [state.view])

  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheet, closeSheet])

  if (!state.profile) {
    return (
      <>
        <Onboarding />
        <Toast />
      </>
    )
  }

  return (
    <>
      <main className="app">
        <CurrentView />
      </main>
      <NavBar />
      {CurrentSheet && <CurrentSheet key={sheet} />}
      <Toast />
    </>
  )
}
