# Fuel & Burn

A simple food and activity diary for ordinary people working on body recomposition.
The core question the app answers: **"Am I in a deficit, how big, and where is my body trending?"**
Everything else is secondary. Keep it simpler than Samsung Health: few screens, obvious navigation.

- Live PWA: https://mikhaylova.dev/fuel/
- Stack: React 19 + TypeScript, Vite, vite-plugin-pwa (Workbox service worker). No backend. Hosted as static files on a VPS (nginx, `/var/www/html/fuel`) behind Cloudflare; build with `npm run build:fuel`, upload `fuel.tgz`.
- UI language: English. Units: kg, km, kcal.
- Status: personal trial project, free. Goal: go through all stages and publish (PWA now, Google Play later).

## Non-negotiable principles (eating-disorder safety)

This is not a professional or competitive tool. It must never encourage restriction, guilt or compensation.

- **Weekly framing over single days.** Headline numbers are averages over a period. Never a big daily "−460" style number.
- **No red, no failure language.** Never use "over", "exceeded", "failed", "bad", "cheat". A surplus is neutral orange (the Fuel colour), not an error.
- **Exceeding a target is information, not a mistake.** Macros above target show "✓ +n g extra".
- **No compensation advice.** After a big day the tip is: the weekly average matters, eat as usual tomorrow. Never "eat less tomorrow".
- **Undereating gets the same gentle nudge.** If the deficit is well beyond the chosen pace, suggest eating more ("Your body could use a bit more").
- **Swaps, not bans.** Frequent-snack tips suggest swapping some, e.g. half the chips, with the weekly kcal effect, plus a "Not now" option.
- **No "Fast" or "Hard" pace.** Deficit capped at −20% of maintenance. Plan never below estimated resting burn (BMR).
- **No achievement badges for weight loss.** Rapid loss is a reason for a gentle tip, not praise.
- **Calm view**: a setting that hides all numbers (kcal, grams) and shows words and shapes instead.
- Wellness app, not medical. Never use "treat", "diagnose", "patients". Show "not medical advice" in onboarding.

## Navigation and screens

Bottom navigation (Material 3), three tabs: **Today · Fuel · Burn**. Trends is a detail screen opened from Today.

**Today** (answer at a glance):
1. Period selector: Week / Month / Year / All.
2. Goal chip, e.g. "🎯 Lose fat · Gentle", which opens the goal sheet.
3. One horizontal bar from 0 to the scale end:
   - scale end = max(maintenance, top of goal range): maintenance for Lose fat, goal max for Build muscle;
   - orange fill = average kcal eaten per day in the period;
   - hatched green zone = goal intake range;
   - blue tick = maintenance when it is not the scale end;
   - if intake exceeds the scale end, fill to the end and show "+n";
   - legend on the right: goal range and "~maintenance burn". Labels "0" and the end value under the bar.
4. Line under the bar: "Deficit 247 kcal a day" plus a status pill (On target / A bit under your goal / Lighter deficit than planned / Above your goal / More than planned).
5. Trend card for the same period: body fat change, weight change, trend line. Opens Trends.
6. One tip at most. Buttons: Add food, Log weight.

No macros on Today.

**Fuel**: kcal today; macros and fiber (Protein, Fat, Carbs, Fiber) as bars relative to the user's targets, with an "Edit targets" button; Quick add; list of logged food; tips.
- Macro status: "n g to go" / "✓ on target" / "✓ +n g extra". Calm view: "room for more" / "almost there" / "target reached".
- Targets sheet shows whether protein, fat and carbs add up to the calorie plan (±150 kcal) and gently says if not.
- Quick add has two parts. **My foods**: user-saved items, created via "+ New" or the ★ on any logged item. **Often in your diary**: items logged at least twice, top 5, no duplicates with My foods.

**Burn**: maintenance with range and confidence; today's burn split by colour into **Resting burn (BMR)**, **Daily activity** and **Workout**; manual activity entry; "How it's calculated" explanation.

**Trends**: weekly balance bars (deficit below the line in blue, surplus above in orange, maintenance grey), weight and body fat trend, fat mass vs lean mass, expected vs actual change.

## Goals

| Goal | Gentle | Steady |
|---|---|---|
| Lose fat | −10 to −15% of maintenance | −15 to −20% |
| Maintain | ±5% | — |
| Build muscle | +5 to +10% | +10 to +15% |

Goal sheet shows kcal range and expected weekly change (kcal × 7 / 7700). Default: Lose fat, Gentle.
Plan floor: never below estimated resting burn.

## Maintenance (TDEE) estimation

Do not build a perfect physiological model. Estimate the user's real TDEE from their own data.

Pipeline: raw weight → remove obvious anomalies → 7-day smoothing → weight trend → energy balance → observed TDEE → weighted update → personal TDEE.

- Observed TDEE = average intake − (Δ trend weight × 7700 / days). If weight goes down, add the deficit to intake; if it goes up, subtract.
- Start (days 1–7): Mifflin-St Jeor × activity factor as the prior. From day 8: blend prior and observed. From day 14: two trend points.
- Blend: estimate = (1 − α) × formula + α × observed; α grows with the amount of good data.
- One strange week must not move the baseline: flag it as an anomaly instead.
- 7700 kcal/kg is an approximation. Always show ranges ("1,820–1,930"), never false precision.

## Activity (manual entry for now)

See `activity.ts`. All results are NET kcal (above resting) to avoid double counting.
- Steps + pace: distance from height and pace, then the ACSM walking equation with weight.
- Walk or run with speed: ACSM walking or running equation.
- Other activities: MET × the user's own resting rate (Katch-McArdle if body fat is known, else Mifflin).
- Use the smoothed trend weight.
- **Only the deviation from a typical day enters the balance** (`activityAdjustment`). Usual activity is already inside the learned maintenance. Typical = median of the last 14 logged days.
- Show results as "~215" (±20%).

## AI usage (OpenAI)

- AI parses free text and photos into **structure** (foods, quantities, portion size; or activity type, duration, intensity). Calories come from a nutrition database or formulas, not from the model's guess, so results are consistent.
- Always show a confirmation card where the user can adjust the portion (Small / Medium / Large) before saving.
- All calls go through a small proxy on our own server. **Never ship the API key in the client.** Rate-limit per user per day.
- Send only the food text or photo. No name, weight or other health data.
- Photos: resize client-side to ~768 px before upload. Do not store them on the server. Keep them in the app (IndexedDB) as a photo food diary; saving to the gallery only via the share sheet.
- Build the app so it still works without AI (search, My foods, Quick add).
- Wrap the provider in one function (`parseFood(text | image) → items[]`) so switching providers is a one-file change.

## Data and privacy

- **Local-first**: all user data stays on the device. Prefer IndexedDB over localStorage; call `navigator.storage.persist()`.
- Provide **export and import** (JSON), since browser data can be cleared.
- Weight, body fat, food and activity are health data under GDPR. Requires explicit, separate consent at onboarding (unticked by default), 18+ only, "delete all my data" in settings.
- Privacy policy draft exists; keep it in sync (no Health Connect while it is a PWA; mention food photos and the AI provider).
- No analytics or ad SDKs without consent.

## Platform roadmap

1. PWA: manifest, icons, service worker, HTTPS only.
2. AI food parsing (text, then photo) via server proxy.
3. Later: Capacitor wrapper for Google Play. Adds Health Connect (Galaxy Watch, scales and other devices) via a health plugin, plus camera and albums. A PWA, even installed, cannot access Health Connect.

## Visual style

- Colours: Fuel (eaten) orange `#C4501A`, Burn blue `#2A47C9`, goal zone and positive tips green `#0E8A74`, neutral greys. Light and dark themes.
- Fonts: Unbounded for numbers and headings, Onest for text.
- Material 3 on Android: navigation bar with pill indicator, FAB for the main action, segmented buttons, touch targets at least 48 dp.
- Never rely on colour alone: every coloured element also has a label.
