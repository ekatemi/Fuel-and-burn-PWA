import { freshState } from '../data/demo'
import { todayKey } from '../lib/dates'
import type { AppState, Meal } from '../types'
import { useApp } from './AppContext'

const APP_ID = 'fuel-and-burn'

interface BackupFile {
  app: typeof APP_ID
  version: 1
  exportedAt: string
  data: AppState
}

/** Turns saved or imported data into a complete state, or null if it isn't ours. */
export function normalizeState(saved: unknown): AppState | null {
  const data = saved as Partial<AppState> | null
  if (!data || typeof data !== 'object' || !Array.isArray(data.meals) || !Array.isArray(data.favs)) return null
  // Meals saved before the diary was dated belong to the day they are first loaded on.
  const today = todayKey()
  const meals = data.meals.map((m: Meal) => (m.date ? m : { ...m, date: today }))
  return { ...freshState(), ...data, meals }
}

function parseBackup(text: string): { state: AppState; exportedAt: string } | null {
  try {
    const file = JSON.parse(text) as Partial<BackupFile>
    const state = file.app === APP_ID ? normalizeState(file.data) : null
    return state && { state, exportedAt: file.exportedAt ?? '' }
  } catch {
    return null
  }
}

/** Opens the system file picker; resolves with null if it is dismissed. */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.hidden = true
    const finish = (file: File | null) => {
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => finish(null))
    document.body.append(input)
    input.click()
  })
}

export function useBackup() {
  const { state, update, showToast } = useApp()

  const exportBackup = async () => {
    const backup: BackupFile = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), data: state }
    const file = new File([JSON.stringify(backup, null, 2)], `fuel-and-burn-backup-${todayKey()}.json`, {
      type: 'application/json',
    })

    // On phones the share sheet lets the file go to Files, Drive or a message; elsewhere it downloads.
    if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Fuel & Burn backup' })
      } catch {
        // Share sheet dismissed.
      }
      return
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
    showToast('Backup saved to your downloads')
  }

  const restoreBackup = async () => {
    const file = await pickFile()
    if (!file) return
    const backup = parseBackup(await file.text())
    if (!backup) return showToast('That file isn’t a Fuel & Burn backup.')

    const saved = backup.exportedAt ? ` from ${new Date(backup.exportedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''
    const hasData = state.profile !== null || state.meals.length > 0
    if (hasData && !window.confirm(`Replace everything on this device with the backup${saved}?`)) return
    update(() => backup.state)
    showToast(`Backup${saved} restored`)
  }

  return { exportBackup, restoreBackup }
}
