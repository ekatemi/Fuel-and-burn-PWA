# TODO

## Check calorie calculation

- [ ] **Egg parts are counted as whole eggs.** An omelette or fried eggs made of "2 yolks, 3 whites" comes out as
  whole fried eggs, ~330 kcal, though it should be about 160 kcal (2 yolks ≈ 35 g × 322 kcal/100 g ≈ 110 kcal,
  3 whites ≈ 100 g × 48 kcal/100 g ≈ 50 kcal, plus any oil or butter for frying).
  Check where it goes wrong:
  - the AI's `query` and `grams` (does it return "egg yolk" and "egg white" as separate items, or one "egg fried"?);
  - the CIQUAL match in `bestMatch` (`src/lib/aiFood.ts`): does "egg yolk" / "egg white" find "Egg, yolk, raw" and
    "Egg, white, raw", or fall back to "egg"?
  - the offline parser (`src/lib/parseFood.ts`), which only knows whole eggs.
  Then add a test with this phrase, and look for similar cases (skimmed vs whole milk, chicken with or without skin,
  "only the filling").
