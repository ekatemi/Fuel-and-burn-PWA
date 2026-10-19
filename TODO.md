# TODO

## Check calorie calculation

- [x] **Egg parts were counted as whole eggs.** "2 yolks, 3 whites" came out as whole eggs, ~330 kcal instead of
  ~160. Causes and fixes:
  - AI: the prompt kept an omelette whole even when the person said what it was made of. It now lists the named
    ingredients, and counts parts of a food (yolks, whites, skinless chicken, skimmed milk) on their own.
    **Needs a Worker deploy** (`cd worker && npm run deploy`).
  - CIQUAL matching was already right ("Egg yolk, cooked", "Egg white, cooked"); now covered by a test.
  - Offline parser: Egg yolk and Egg white added to the catalog; naming a part stops the whole egg being counted too.
- [ ] Offline, "2 yolks 3 whites" with no comma or "and" between them takes one count (2) for both. Rare; the AI
  path handles it.
- [ ] Look for similar cases with real phrases: skimmed vs whole milk, chicken with or without skin, "only the
  filling", "half the bun".
