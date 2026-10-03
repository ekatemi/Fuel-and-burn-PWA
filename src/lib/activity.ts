// Fuel & Burn — manual activity → calories burned.
// All results are NET kcal: energy above resting, so nothing is counted twice
// with the resting part of maintenance.

export type Sex = 'female' | 'male';

export interface UserProfile {
  sex: Sex;
  age: number;          // years
  heightCm: number;
  weightKg: number;     // use the smoothed trend weight, not today's scale reading
  bodyFatPct?: number;  // optional; improves the resting estimate
}

export type Pace = 'slow' | 'normal' | 'brisk';

export type Activity =
  | { kind: 'steps'; steps: number; pace: Pace }
  | { kind: 'walk'; minutes: number; speedKmh: number }
  | { kind: 'run'; minutes: number; speedKmh: number }
  | { kind: 'other'; type: OtherType; minutes: number };

export interface Burn {
  kcal: number;         // best estimate, rounded to 5
  low: number;          // ~±20%: show as "~X", never as an exact number
  high: number;
  minutes: number;
  distanceKm?: number;
  method: string;       // for the "How it's calculated" screen
}

// ---------- resting energy ----------

/** Resting kcal per day. Katch-McArdle if body fat is known, otherwise Mifflin-St Jeor. */
export function restingKcalPerDay(u: UserProfile): number {
  if (u.bodyFatPct !== undefined && u.bodyFatPct > 3 && u.bodyFatPct < 60) {
    const leanKg = u.weightKg * (1 - u.bodyFatPct / 100);
    return 370 + 21.6 * leanKg;
  }
  const base = 10 * u.weightKg + 6.25 * u.heightCm - 5 * u.age;
  return u.sex === 'male' ? base + 5 : base - 161;
}

// ---------- walking and running (ACSM metabolic equations) ----------

// Typical walking speed and stride length (as a share of height) for each pace.
const PACE: Record<Pace, { speedKmh: number; strideFactor: number }> = {
  slow:   { speedKmh: 3.2, strideFactor: 0.37 },
  normal: { speedKmh: 4.8, strideFactor: 0.415 },
  brisk:  { speedKmh: 6.0, strideFactor: 0.45 },
};

// Net O2 cost (ml/kg/min) above rest, flat ground. 1 L O2 ≈ 5 kcal.
const netWalkVO2 = (mPerMin: number) => 0.1 * mPerMin;
const netRunVO2 = (mPerMin: number) => 0.2 * mPerMin;
const kcalFromVO2 = (netVO2: number, kg: number, min: number) => (netVO2 * kg * min / 1000) * 5;

// ---------- other activities (MET, adjusted to the person's own resting rate) ----------

// Approximate values from the Compendium of Physical Activities. Check before release.
export const MET = {
  strength_moderate: 3.5,
  strength_vigorous: 6.0,
  cycling_easy: 4.0,
  cycling_moderate: 6.8,
  cycling_vigorous: 8.0,
  swimming_moderate: 5.8,
  yoga: 2.5,
  pilates: 3.0,
  dancing: 5.0,
  hiking: 6.0,
  elliptical: 5.0,
  hiit: 8.0,
  housework: 3.0,
} as const;
export type OtherType = keyof typeof MET;

// ---------- main function ----------

export function activityBurn(u: UserProfile, a: Activity): Burn {
  let kcal: number, minutes: number, distanceKm: number | undefined, method: string;

  switch (a.kind) {
    case 'steps': {
      const p = PACE[a.pace];
      distanceKm = (a.steps * p.strideFactor * u.heightCm) / 100 / 1000;
      minutes = (distanceKm / p.speedKmh) * 60;
      const mPerMin = (p.speedKmh * 1000) / 60;
      kcal = kcalFromVO2(netWalkVO2(mPerMin), u.weightKg, minutes);
      method = 'Steps → distance from your height → walking equation (ACSM) with your weight';
      break;
    }
    case 'walk':
    case 'run': {
      minutes = a.minutes;
      distanceKm = (a.speedKmh * a.minutes) / 60;
      const mPerMin = (a.speedKmh * 1000) / 60;
      // Above ~8 km/h even "walking" costs like running; below ~6 km/h jogging is closer to walking.
      const asRun = a.kind === 'run' ? a.speedKmh >= 6 : a.speedKmh >= 8;
      const vo2 = asRun ? netRunVO2(mPerMin) : netWalkVO2(mPerMin);
      kcal = kcalFromVO2(vo2, u.weightKg, minutes);
      method = `${asRun ? 'Running' : 'Walking'} equation (ACSM) with your weight and speed`;
      break;
    }
    case 'other': {
      minutes = a.minutes;
      const restingPerMin = restingKcalPerDay(u) / 1440;   // personal "1 MET"
      kcal = (MET[a.type] - 1) * restingPerMin * minutes;
      method = 'Activity MET × your own resting rate (height, weight, age, sex, body fat if known)';
      break;
    }
  }

  const r5 = (x: number) => Math.max(0, Math.round(x / 5) * 5);
  return {
    kcal: r5(kcal), low: r5(kcal * 0.8), high: r5(kcal * 1.2),
    minutes: Math.round(minutes),
    distanceKm: distanceKm !== undefined ? Math.round(distanceKm * 100) / 100 : undefined,
    method,
  };
}

// ---------- how it enters the daily balance ----------

/**
 * Maintenance learned from the weight trend already contains the user's USUAL activity.
 * Only the difference from a typical day is added (or subtracted).
 * typicalKcal = median activity kcal of the last 14 logged days (or a default early on).
 */
export function activityAdjustment(todayKcal: number, typicalKcal: number): number {
  return Math.round((todayKcal - typicalKcal) / 5) * 5;
}

// ---------- examples (example user: 55 kg, 165 cm, 40-year-old woman) ----------
// activityBurn(u, { kind: 'steps', steps: 11456, pace: 'normal' })
//   → ~215 kcal, ~7.8 km, ~98 min
// activityBurn(u, { kind: 'run', minutes: 20, speedKmh: 8 })
//   → ~145 kcal, 2.67 km
// activityBurn(u, { kind: 'other', type: 'strength_moderate', minutes: 45 })
//   → ~95 kcal (Mifflin resting ≈ 1,220 kcal/day)
