# Fuel & Burn (PWA)

React + TypeScript port of the Fuel & Burn prototype, installable and usable offline.

```sh
npm install
npm run dev       # dev server (no service worker)
npm run build     # type-check, then build to dist/ with the service worker
npm run preview   # serve dist/ to test installing and offline use
npm run icons     # regenerate the PNG icons from public/icon.svg
```

- `src/data/` holds the sample data and the food catalog; `src/lib/model.ts` holds the calculations.
- The food diary is real and stored per day (`src/lib/dates.ts`). Daily burn is estimated from the onboarding profile (Mifflin–St Jeor × activity level). Body-composition trends and history older than the diary are still sample data.
- State is saved in `localStorage` on the device. The menu can export it to a JSON backup file and restore from one (`src/state/backup.ts`).
- Installing needs HTTPS (or `localhost`).
