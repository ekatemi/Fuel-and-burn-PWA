# Fuel & Burn

A simple food and activity diary for ordinary people working on body recomposition.
The core question the app answers: **"Am I in a deficit, how big, and where is my body trending?"**
Everything else is secondary. Keep it simpler than Samsung Health: few screens, obvious navigation.

- Live PWA: https://mikhaylova.dev/fuel/
- Stack: React 19 + TypeScript, Vite, vite-plugin-pwa (Workbox service worker). No backend. Hosted as static files on a VPS (nginx, `/var/www/mikhaylova.dev/fuel`) behind Cloudflare; build with `npm run build:fuel`, upload `fuel.tgz`.
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
1. Period selector: Today / Week / Month / Year (Week by default; "All" was dropped as it added nothing over Year). Today shows kcal eaten so far against the day's plan range and what is left of it; no daily deficit or status pill, since the day isn't over.
2. Goal chip, e.g. "🎯 Lose fat · Gentle", which opens the goal sheet.
3. One horizontal bar from 0 to the scale end:
   - scale end = max(maintenance, top of goal range): maintenance for Lose fat, goal max for Build muscle;
   - orange fill = average kcal eaten per day in the period;
   - solid green zone = goal intake range (colour, no hatching);
   - blue tick = maintenance when it is not the scale end;
   - if intake exceeds the scale end, fill to the end and show "+n";
   - legend on the right: goal range only. Labels "0" and the end value under the bar.
4. Line under the bar: "Deficit 247 kcal a day" plus a status pill (On target / A bit under your goal / Lighter deficit than planned / Above your goal / More than planned).
5. Trend card for the same period: body fat change, weight change, trend line. Opens Trends.
6. One tip at most. Buttons: Add food, Log weight.

No macros on Today.

**Fuel**: kcal today; macros and fiber (Protein, Fat, Carbs, Fiber) as bars relative to the user's targets, with an "Edit targets" button; Quick add; list of logged food; tips.
- Logged food is one list by time, each item showing its meal (Breakfast, Lunch, Dinner, Snack). An "Add food" FAB opens Add food.
- Add food has a meal picker; the default is the usual meal for the time of day (`slotForTime`). Quick add uses the time of day too.
- Macro status: "n g to go" / "✓ on target" / "✓ +n g extra". Calm view: "room for more" / "almost there" / "target reached".
- Targets sheet shows whether protein, fat and carbs add up to the calorie plan (±150 kcal) and gently says if not.
- Quick add has two parts. **My foods**: user-saved items, created via "+ New" or the ★ on any logged item. **Often in your diary**: items logged at least twice, top 5, no duplicates with My foods.

**Burn**: maintenance with range and confidence; today's burn split by colour into **Resting burn (BMR)**, **Daily activity** and **Workout**; manual activity entry; "How it's calculated" explanation.

**Trends**: weight trend (7-day smoothing, unusual readings left out), optional body fat trend, fat mass vs lean mass, expected vs actual change. No weekly balance chart: the balance lives on Today.

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
- Implemented in `src/lib/tdee.ts`: each of the last 4 full weeks (with food on ≥4 days and trend weight at both ends) gives an observed burn; α = 0.8 × good weeks / 4. A week >35% from the formula, or (with ≥3 weeks) >20% from their median, is flagged unusual and left out. Days with under half the formula logged count as incomplete and are skipped, so forgotten meals never pull maintenance (and the plan) down. The range narrows from ±10% to ±5% as α grows.

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
- All calls go through a small proxy, a Cloudflare Worker in `worker/` (`npm run deploy` there; key set with `wrangler secret put OPENAI_API_KEY`). **Never ship the API key in the client.** It allows only our origins and limits each IP to 10 requests a minute and `DAILY_LIMIT` a day (hashed IP in KV). The model is the `MODEL` var in `wrangler.toml`.
- Client: `src/lib/aiFood.ts`, address in `VITE_AI_URL` (no address = no AI). "Recognize" sends the whole text to AI when it is available (so a dish stays whole); the on-device parser (`parseFood.ts`) is the fallback offline or when AI can't be reached. The AI returns an English CIQUAL search term and grams per food, from text in any language (English, Spanish, Russian).
- Dishes: AI splits a dish into ingredients to look each up in CIQUAL, and tags each with `dish`, the person's own words for it ("Сэндвич с тунцом и салатом", never translated). Add food shows the ingredients under the dish (amounts editable); the diary gets **one entry per dish** under that name, with the summed nutrition (`itemsToLog`). A dish with an unmatched ingredient can't be added until it is matched or removed.
- Model: `gpt-5.4-mini` since 2026-10-14; `gpt-5.4-nano` mixed up dishes (dropped the bread, merged separate foods, duplicated items).
- Voice: "Speak" in Add food records with MediaRecorder (`src/lib/recorder.ts`, max 30 s) and the Worker's `/transcribe` turns it into text with `TRANSCRIBE_MODEL` (any language, detected); the text goes into the field and Recognize runs. Not the browser's SpeechRecognition: iOS blocks it in installed web apps. No transcription prompt: with a hint about food, the model invents meals from silence or noise.
- Send only the food text, voice note or photo. No name, weight or other health data. Audio is not stored.
- Photo: "Camera" in Add food opens the phone's camera straight away (`capture`), "or pick a photo from your gallery" opens the library; `src/lib/photo.ts` makes a ~768 px JPEG) goes to `/parse-food` as `image`, with the typed text as a note about it ("only half", hidden ingredients); the result replaces the list, like Recognize. Not kept yet.
- Photos: resize client-side to ~768 px before upload. Do not store them on the server. Keep them in the app (IndexedDB) as a photo food diary; saving to the gallery only via the share sheet.
- Build the app so it still works without AI (search, My foods, Quick add).
- Food database: ANSES-CIQUAL 2020 (EU, open licence, attribution shown in Add food), bundled and searched on the device (`src/lib/foodDb.ts`, data built by `scripts/build_ciqual.py`). English names now; the format keeps names per language for Spanish and Russian. Packaged products and barcodes: Open Food Facts (planned).
- Wrap the provider in one function (`parseFood(text | image) → items[]`) so switching providers is a one-file change.

## Data and privacy

- **Local-first**: all user data stays on the device. Prefer IndexedDB over localStorage; call `navigator.storage.persist()`.
- **Sync-ready storage** (`src/state/`): `storage.ts` is the only place that reads or writes saved data (IndexedDB, localStorage fallback). `schema.ts` holds `SCHEMA_VERSION` and the migrations; any change to the stored format bumps the version and adds a step. Records have random UUIDs; `sync.ts` keeps a change log (last change per record and setting, deletions) for a future sync or merging restore.
- Provide **export and import** (JSON), since browser data can be cleared.
- Weight, body fat, food and activity are health data under GDPR. Requires explicit, separate consent at onboarding (unticked by default), 18+ only, "delete all my data" in settings.
- Done: onboarding opens with "Before you start": two unticked boxes (18 or older; health data kept on the device, food sent to the AI provider) and the not-medical-advice note. `state.consent` keeps when they were ticked; without it the app shows only that screen (data from before v5 is asked once, or can be deleted). Sample data and restore need the boxes too. "Delete all my data" is in the ⋮ menu.
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
