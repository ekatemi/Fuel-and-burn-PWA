// The stored document and how older saved data is brought up to date.
// When the format changes: bump SCHEMA_VERSION and add a step to MIGRATIONS that turns the
// previous version into the new one. Saved data and backups both go through migrate().
import { freshState } from '../data/demo'
import { todayKey } from '../lib/dates'
import { newId } from '../lib/ids'
import type { AppState } from '../types'
import { emptySync, type SyncMeta } from './sync'

export const SCHEMA_VERSION = 2

export interface StoredDoc {
  schemaVersion: number
  state: AppState
  sync: SyncMeta
}

// Saved data comes from older versions of the app, so it is untyped until migrated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

const MIGRATIONS: Record<number, (doc: Raw) => Raw> = {
  // v1: the state object stored directly, with numeric ids from a counter (nextId) and no change log.
  // Ids become random ones, so two devices' records never clash once data can be synced.
  1: (doc) => {
    const { nextId: _nextId, ...state } = doc.state as Raw
    const reId = (list: Raw[] = []): Raw[] => list.map((record) => ({ ...record, id: newId() }))
    const today = todayKey()
    return {
      schemaVersion: 2,
      state: {
        ...state,
        // Meals from before the diary was dated belong to the day they are first loaded on.
        meals: reId(state.meals).map((m) => (m.date ? m : { ...m, date: today })),
        activities: reId(state.activities),
        favs: reId(state.favs),
      },
      sync: emptySync(),
    }
  },
}

/** Brings saved or imported data to the current format, or returns null if it isn't ours. */
export function migrate(raw: unknown): StoredDoc | null {
  if (!raw || typeof raw !== 'object') return null
  let doc = raw as Raw
  // Version 1 stored the bare state, recognisable by its lists of meals and saved foods.
  if (!('schemaVersion' in doc)) {
    if (!Array.isArray(doc.meals) || !Array.isArray(doc.favs)) return null
    doc = { schemaVersion: 1, state: doc }
  }
  // Data from a newer version of the app can't be read safely by this one.
  if (typeof doc.schemaVersion !== 'number' || doc.schemaVersion > SCHEMA_VERSION) return null
  while (doc.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[doc.schemaVersion]
    if (!step) return null
    doc = step(doc)
  }
  if (!doc.state || !Array.isArray(doc.state.meals) || !Array.isArray(doc.state.favs)) return null
  return {
    schemaVersion: SCHEMA_VERSION,
    // Fields added since the data was saved get their defaults.
    state: { ...freshState(), ...doc.state },
    sync: { ...emptySync(), ...doc.sync },
  }
}

export const freshDoc = (): StoredDoc => ({ schemaVersion: SCHEMA_VERSION, state: freshState(), sync: emptySync() })
