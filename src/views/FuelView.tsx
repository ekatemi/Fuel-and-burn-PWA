import { BackIcon, PlusIcon, ShareIcon, StarIcon, TrashIcon } from '../components/Icons'
import { MacroBlock } from '../components/MacroBlock'
import { QuickChips } from '../components/QuickChips'
import { TipBox } from '../components/TipBox'
import { TopBar } from '../components/TopBar'
import { addDays, longLabel, weekdayLong } from '../lib/dates'
import { eaten, fmt, GROUP_NAMES, mealGroups, mealsOn, nowTime, rangeSummary, slotForTime, SLOT_NAMES, status, swapIdea } from '../lib/model'
import { newId } from '../lib/ids'
import { useApp } from '../state/AppContext'
import type { Food, Meal } from '../types'

export function FuelView() {
  const { state, update, today, maint, resting, burnOn, diaryDate, setDiaryDate, addMeals, removeMeals, openSheet, openAddFood, showToast } =
    useApp()
  const { favs, numbers } = state
  const isToday = diaryDate === today
  const meals = mealsOn(state.meals, diaryDate)
  const total = eaten(meals)
  const groups = mealGroups(meals)

  // A "half the portion" idea, only while the past two weeks run above the plan: never a nudge to eat
  // less for someone already on target or under it, and never while building muscle.
  const twoWeeks = rangeSummary(state.meals, addDays(today, -14), addDays(today, -1), burnOn)
  const aboveGoal =
    state.goal.type !== 'gain' &&
    twoWeeks.loggedDays >= 4 &&
    status(twoWeeks.balance, maint, state.goal, resting).kind === 'over'
  const swap = aboveGoal ? swapIdea(state.meals, today) : null
  const swapKey = swap && `swap-${swap.name.toLowerCase()}-${today.slice(0, 7)}`
  const dayName = isToday ? 'Today' : diaryDate === addDays(today, -1) ? 'Yesterday' : weekdayLong(diaryDate)

  const quickAdd = (food: Food) => {
    const slot = slotForTime(nowTime())
    const ids = addMeals([{ food, qty: 1, size: 'M' }], diaryDate, slot)
    showToast(`Added to ${SLOT_NAMES[slot].toLowerCase()}: ${food.name}`, () => removeMeals(ids))
  }

  const remove = (meal: Meal) => {
    removeMeals([meal.id])
    showToast('Removed ' + meal.name, () => update((s) => ({ ...s, meals: [...s.meals, meal] })))
  }

  const toggleFav = (meal: Meal) => {
    if (favs.some((f) => f.name === meal.name)) {
      update((s) => ({ ...s, favs: s.favs.filter((f) => f.name !== meal.name) }))
      showToast('Removed from My foods')
    } else {
      const { id: _id, date: _date, time: _time, slot: _slot, ...food } = meal
      update((s) => ({ ...s, favs: [...s.favs, { ...food, id: newId() }] }))
      showToast('Saved to My foods')
    }
  }

  return (
    <>
      <TopBar subtitle={longLabel(diaryDate)} title="Fuel" />
      <div className="daynav">
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDiaryDate(addDays(diaryDate, -1))}>
          <BackIcon size={20} />
        </button>
        <span className="h" aria-live="polite">
          {dayName}
        </span>
        <button
          className="icon-btn flip"
          aria-label="Next day"
          disabled={isToday}
          onClick={() => setDiaryDate(addDays(diaryDate, 1))}
        >
          <BackIcon size={20} />
        </button>
      </div>
      <section className="card big">
        {numbers ? (
          <div className="baseline">
            <span className="num fuel-total">{fmt(total)}</span>
            <span className="muted" style={{ fontSize: 15 }}>
              {isToday ? 'kcal today' : 'kcal'}
            </span>
          </div>
        ) : (
          <div className="headline" style={{ fontSize: 24 }}>
            {meals.length} {meals.length === 1 ? 'item' : 'items'} {isToday ? 'today' : 'logged'}
          </div>
        )}
        <div className="row center" style={{ marginTop: 4 }}>
          <span className="h">Macros and fiber</span>
          <button className="tbtn link" onClick={() => openSheet('targets')}>
            Edit targets
          </button>
        </div>
        <MacroBlock meals={meals} />
      </section>

      <QuickChips onPick={quickAdd} showManage />

      <div className="col" style={{ gap: 8 }}>
        <div className="row">
          <span className="h">{isToday ? 'Logged today' : 'Logged'}</span>
          <button className="tbtn link with-icon" disabled={!meals.length} onClick={() => openSheet('share')}>
            <ShareIcon />
            Share day
          </button>
        </div>
        {groups.length ? (
          groups.map((group) => (
            <section className="col" style={{ gap: 6 }} key={group.slot} aria-label={GROUP_NAMES[group.slot]}>
              <div className="row" style={{ padding: '0 4px' }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                  {GROUP_NAMES[group.slot]}
                </span>
                {numbers && (
                  <span className="muted" style={{ fontSize: 13 }}>
                    {fmt(eaten(group.meals))} kcal
                  </span>
                )}
              </div>
              <div className="list">
                {group.meals.map((meal) => {
                  const saved = favs.some((f) => f.name === meal.name)
                  return (
                    <div className="item" key={meal.id}>
                      <span className="muted" style={{ width: 42, fontSize: 13 }}>
                        {meal.time}
                      </span>
                      <div className="main">
                        <span className="nm">{meal.name}</span>
                        <span className="pt">{meal.portion}</span>
                      </div>
                      {numbers && (
                        <span className="num" style={{ fontSize: 15 }}>
                          {fmt(meal.kcal)}
                        </span>
                      )}
                      <button
                        className="icon-btn"
                        aria-pressed={saved}
                        aria-label={saved ? 'Saved in My foods' : 'Save to My foods'}
                        style={{ color: saved ? 'var(--burn)' : 'var(--muted)' }}
                        onClick={() => toggleFav(meal)}
                      >
                        <StarIcon size={20} filled={saved} />
                      </button>
                      <button className="icon-btn" aria-label={`Remove ${meal.name}`} onClick={() => remove(meal)}>
                        <TrashIcon />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="card">
            <p>{isToday ? 'Nothing logged yet today.' : 'Nothing logged on this day.'}</p>
          </div>
        )}
      </div>

      {swap && swapKey && !state.dismissed[swapKey] && (
        <TipBox
          title="A small idea for your week"
          actions={
            <>
              <button className="tbtn" onClick={() => update((s) => ({ ...s, dismissed: { ...s.dismissed, [swapKey]: true } }))}>
                Not now
              </button>
              {swap.snack && (
                <button className="tonal" onClick={() => openSheet('snacks')}>
                  Lighter snacks
                </button>
              )}
            </>
          }
        >
          {swap.name} showed up {swap.count} times in two weeks
          {numbers
            ? `, about ${fmt(swap.avgKcal)} kcal each. Having half the portion would free up around ${fmt(swap.weekly)} kcal a week, about ${fmt(swap.monthly)} a month.`
            : '. Having half the portion now and then would make a nice difference over a month.'}
        </TipBox>
      )}

      <button className="fab" onClick={() => openAddFood()}>
        <PlusIcon />
        Add food
      </button>
    </>
  )
}
