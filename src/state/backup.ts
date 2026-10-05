import { todayKey } from '../lib/dates'
import { useApp } from './AppContext'
import { migrate, SCHEMA_VERSION, type StoredDoc } from './schema'

const APP_ID = 'fuel-and-burn'

// Version 1 files held the bare state in `data`; version 2 holds the stored document
// (state plus change log) in `doc`. Both go through migrate(), like saved data.
interface BackupFile {
  app: typeof APP_ID
  version: 2
  exportedAt: string
  doc: StoredDoc
}

function parseBackup(text: string): { doc: StoredDoc; exportedAt: string } | { error: string } {
  const notOurs = { error: 'That file isn’t a Fuel & Burn backup.' }
  try {
    const file = JSON.parse(text)
    if (file?.app !== APP_ID) return notOurs
    if (file.doc?.schemaVersion > SCHEMA_VERSION) {
      return { error: 'This backup is from a newer version of Fuel & Burn. Update the app, then try again.' }
    }
    const doc = migrate(file.version === 1 ? file.data : file.doc)
    return doc ? { doc, exportedAt: file.exportedAt ?? '' } : notOurs
  } catch {
    return notOurs
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
  const { state, doc, replaceDoc, showToast } = useApp()

  const exportBackup = async () => {
    const backup: BackupFile = { app: APP_ID, version: 2, exportedAt: new Date().toISOString(), doc }
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
    if ('error' in backup) return showToast(backup.error)

    const saved = backup.exportedAt ? ` from ${new Date(backup.exportedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''
    const hasData = state.profile !== null || state.meals.length > 0
    if (hasData && !window.confirm(`Replace everything on this device with the backup${saved}?`)) return
    replaceDoc(backup.doc)
    showToast(`Backup${saved} restored`)
  }

  return { exportBackup, restoreBackup }
}
