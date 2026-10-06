# Fuel & Burn (PWA)

React + TypeScript port of the Fuel & Burn prototype, installable and usable offline.

```sh
npm install
npm run dev       # dev server (no service worker)
npm run build     # type-check, then build to dist/ with the service worker
npm run preview   # serve dist/ to test installing and offline use
npm test          # run the unit tests (Vitest)
npm run icons     # regenerate the PNG icons from public/icon.svg
npm run build:fuel  # build for https://mikhaylova.dev/fuel/ and pack it as fuel.tgz
```

- `src/data/` holds the sample data and the food catalog; `src/lib/model.ts` holds the calculations.
- Food search uses the ANSES-CIQUAL 2020 food composition table (Licence Ouverte / Etalab 2.0, https://ciqual.anses.fr/), converted by `python3 scripts/build_ciqual.py` into `src/data/ciqual.json` (about 3,100 foods, values per 100 g, English names). Names are stored per language, so Spanish or Russian names can be merged in later.
- The food diary is real and stored per day (`src/lib/dates.ts`). Daily burn is estimated from the onboarding profile (Mifflin–St Jeor × activity level). Body-composition trends and history older than the diary are still sample data.
- Data is saved on the device in IndexedDB (`src/state/storage.ts`), with a versioned format and migrations (`src/state/schema.ts`). The menu can export it to a JSON backup file and restore from one (`src/state/backup.ts`).
- Installing needs HTTPS (or `localhost`).
