// Change log kept beside the data: when each record or setting last changed, and which records
// were deleted. Nothing uses it yet; it is what a later sync (or a merging restore) needs to decide,
// record by record, which side is newer. The screens never see it: every state update is compared
// with the previous one and stamped here automatically.
import type { AppState } from '../types'

export interface SyncMeta {
  /** Path → last change, in epoch ms. Paths look like "meals/<id>", "weighIns/2026-10-06", "settings/goal". */
  updated: Record<string, number>
  /** Path → deletion time, for records only. */
  deleted: Record<string, number>
}

export const emptySync = (): SyncMeta => ({ updated: {}, deleted: {} })

// Lists of records with an id, and maps keyed by day (one value per day, so the day is the id).
const LISTS = ['meals', 'activities', 'favs'] as const
const DAY_MAPS = ['weighIns', 'bodyFat'] as const
const RECORDS = new Set<string>([...LISTS, ...DAY_MAPS])

/** Every record and setting in the state, by path, with the value whose identity shows a change. */
function entries(state: AppState): Map<string, unknown> {
  const out = new Map<string, unknown>()
  for (const key of LISTS) for (const record of state[key]) out.set(`${key}/${record.id}`, record)
  for (const key of DAY_MAPS) for (const [day, value] of Object.entries(state[key])) out.set(`${key}/${day}`, value)
  for (const [key, value] of Object.entries(state)) if (!RECORDS.has(key)) out.set(`settings/${key}`, value)
  return out
}

/** The change log after going from `prev` to `next`. Updates replace records rather than mutate them. */
export function stamp(prev: AppState, next: AppState, sync: SyncMeta, now = Date.now()): SyncMeta {
  if (prev === next) return sync
  const before = entries(prev)
  const after = entries(next)
  const updated = { ...sync.updated }
  const deleted = { ...sync.deleted }
  let changed = false

  for (const [path, value] of after) {
    if (before.has(path) && before.get(path) === value) continue
    updated[path] = now
    delete deleted[path]
    changed = true
  }
  for (const path of before.keys()) {
    if (after.has(path) || path.startsWith('settings/')) continue
    deleted[path] = now
    delete updated[path]
    changed = true
  }
  return changed ? { updated, deleted } : sync
}
