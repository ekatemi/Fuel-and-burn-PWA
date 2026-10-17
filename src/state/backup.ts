import { todayKey } from '../lib/dates'
import { useApp } from './AppContext'
import type { Consent } from '../types'
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
    input.accept = 'application/json,.json,text/plain,.txt'
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
  const { state, doc, update, replaceDoc, showToast } = useApp()
  const saved = () => update((s) => ({ ...s, lastBackupAt: new Date().toISOString() }))

  const exportBackup = async () => {
    const backup: BackupFile = { app: APP_ID, version: 2, exportedAt: new Date().toISOString(), doc }
    const text = JSON.stringify(backup, null, 2)
    const name = `fuel-and-burn-backup-${todayKey()}`

    // On phones the share sheet lets the file go to Files, Drive or a message. Chrome on Android shares only some
    // file types and refuses .json, so the shared copy is plain text (still JSON inside; restore takes both).
    const shared = new File([text], `${name}.txt`, { type: 'text/plain' })
    if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [shared] })) {
      try {
        await navigator.share({ files: [shared], title: 'Fuel & Burn backup' })
        saved()
        showToast('Backup sent. Keep that file somewhere safe.')
        return
      } catch (e) {
        // Closing the share sheet is a choice, not an error; anything else falls back to a download.
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(new File([text], `${name}.json`, { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${name}.json`
    link.click()
    URL.revokeObjectURL(url)
    saved()
    showToast('Backup saved to your downloads')
  }

  /** With `consent`, a backup made before consent was asked for gets it, so it isn't asked for twice. */
  const restoreBackup = async (consent?: Consent) => {
    const file = await pickFile()
    if (!file) return
    const backup = parseBackup(await file.text())
    if ('error' in backup) return showToast(backup.error)

    const saved = backup.exportedAt ? ` from ${new Date(backup.exportedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''
    const hasData = state.profile !== null || state.meals.length > 0
    if (hasData && !window.confirm(`Replace everything on this device with the backup${saved}?`)) return
    const restored = backup.doc
    replaceDoc(consent && !restored.state.consent ? { ...restored, state: { ...restored.state, consent } } : restored)
    showToast(`Backup${saved} restored`)
  }

  return { exportBackup, restoreBackup }
}
