import type { ActivityEntry } from '../types'
import type { OtherType, Pace as WalkPace } from './activity'

export const OTHER_LABELS: Record<OtherType, string> = {
  strength_moderate: 'Strength training, moderate',
  strength_vigorous: 'Strength training, hard',
  cycling_easy: 'Cycling, easy',
  cycling_moderate: 'Cycling, moderate',
  cycling_vigorous: 'Cycling, fast',
  swimming_moderate: 'Swimming',
  yoga: 'Yoga',
  pilates: 'Pilates',
  dancing: 'Dancing',
  hiking: 'Hiking',
  elliptical: 'Elliptical trainer',
  hiit: 'HIIT',
  housework: 'Housework, gardening',
}

export const WALK_PACES: [WalkPace, string][] = [
  ['slow', 'Slow'],
  ['normal', 'Normal'],
  ['brisk', 'Brisk'],
]

const km = (d?: number) => (d ? ` · ${d.toFixed(1)} km` : '')

/** Name and detail line for a logged activity. */
export function describeActivity(entry: ActivityEntry): { name: string; detail: string } {
  const { input, burn } = entry
  switch (input.kind) {
    case 'steps':
      return {
        name: `${input.steps.toLocaleString('en-US')} steps`,
        detail: `${WALK_PACES.find(([p]) => p === input.pace)?.[1]} pace${km(burn.distanceKm)}`,
      }
    case 'walk':
    case 'run':
      return {
        name: input.kind === 'walk' ? 'Walk' : 'Run',
        detail: `${input.minutes} min at ${input.speedKmh} km/h${km(burn.distanceKm)}`,
      }
    case 'other':
      return { name: OTHER_LABELS[input.type], detail: `${input.minutes} min` }
  }
}
