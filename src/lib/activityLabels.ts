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
  calisthenics_handstand: 'Handstand',
  calisthenics_plank: 'Plank',
  calisthenics_back_lever: 'Back lever',
  calisthenics_fundamentals: 'Fundamentals',
  calisthenics_front_lever: 'Front lever',
}

export const isCalisthenics = (type: OtherType) => type.startsWith('calisthenics_')

/** Name in a picker; adds examples where the short name isn't self-explanatory. */
export const optionLabel = (type: OtherType) =>
  type === 'calisthenics_fundamentals' ? 'Fundamentals (push-ups, pull-ups, dips…)' : OTHER_LABELS[type]

// Activities grouped the way they appear as buttons; a group with several types asks which one.
export const ACTIVITY_GROUPS = {
  calisthenics: { label: 'Calisthenics', types: ['calisthenics_handstand', 'calisthenics_plank', 'calisthenics_back_lever', 'calisthenics_fundamentals', 'calisthenics_front_lever'] },
  strength: { label: 'Strength', types: ['strength_moderate', 'strength_vigorous'] },
  cycling: { label: 'Cycling', types: ['cycling_easy', 'cycling_moderate', 'cycling_vigorous'] },
  swimming: { label: 'Swimming', types: ['swimming_moderate'] },
  yoga: { label: 'Yoga', types: ['yoga'] },
  pilates: { label: 'Pilates', types: ['pilates'] },
  dancing: { label: 'Dancing', types: ['dancing'] },
  hiking: { label: 'Hiking', types: ['hiking'] },
  elliptical: { label: 'Elliptical', types: ['elliptical'] },
  hiit: { label: 'HIIT', types: ['hiit'] },
  housework: { label: 'Housework', types: ['housework'] },
} satisfies Record<string, { label: string; types: OtherType[] }>
export type GroupKey = keyof typeof ACTIVITY_GROUPS

/** A button at the top of "Add activity"; "other" lists every activity. */
export type Shortcut = 'steps' | 'walk' | 'run' | GroupKey | 'other'

export const SHORTCUT_LABELS: Record<Shortcut, string> = {
  steps: 'Steps',
  walk: 'Walk',
  run: 'Run',
  ...(Object.fromEntries(Object.entries(ACTIVITY_GROUPS).map(([k, g]) => [k, g.label])) as Record<GroupKey, string>),
  other: 'Other',
}
export const ALL_SHORTCUTS = Object.keys(SHORTCUT_LABELS) as Shortcut[]
export const SHORTCUT_COUNT = 4
export const DEFAULT_SHORTCUTS: Shortcut[] = ['steps', 'walk', 'run', 'other']

/** Saved buttons, filled up to four (older data saved three, without Other). */
export function shortcutsFrom(saved: Shortcut[] | undefined): Shortcut[] {
  const list = (saved ?? []).filter((s, i, all) => s in SHORTCUT_LABELS && all.indexOf(s) === i)
  // Other first, so a three-button setting from before keeps access to every activity.
  for (const fallback of ['other', ...DEFAULT_SHORTCUTS] as Shortcut[]) {
    if (list.length < SHORTCUT_COUNT && !list.includes(fallback)) list.push(fallback)
  }
  return list.slice(0, SHORTCUT_COUNT)
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
      return {
        name: OTHER_LABELS[input.type],
        detail: (isCalisthenics(input.type) ? 'Calisthenics · ' : '') + `${input.minutes} min`,
      }
  }
}
