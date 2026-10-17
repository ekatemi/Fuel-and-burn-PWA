import { describe, expect, it } from 'vitest'
import { migrate, SCHEMA_VERSION } from './schema'

describe('migrate', () => {
  it('asks people who started before consent was asked for to give it', () => {
    const v4 = { schemaVersion: 4, state: { profile: { sex: 'female', age: 40, heightCm: 165, activity: 'light' }, meals: [], favs: [] } }
    const doc = migrate(v4)
    expect(doc?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc?.state.consent).toBeNull()
    expect(doc?.state.profile).not.toBeNull()
  })

  it('keeps consent that was given', () => {
    const at = '2026-10-17T09:00:00.000Z'
    const doc = migrate({ schemaVersion: SCHEMA_VERSION, state: { consent: { at }, meals: [], favs: [] } })
    expect(doc?.state.consent).toEqual({ at })
  })
})
