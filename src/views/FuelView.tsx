import { PlusIcon, StarIcon, TrashIcon } from '../components/Icons'
import { MacroBlock } from '../components/MacroBlock'
import { QuickChips } from '../components/QuickChips'
import { TipBox } from '../components/TipBox'
import { TopBar } from '../components/TopBar'
import { TODAY_LABEL } from '../data/demo'
import { eaten, fmt } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { Food, Meal } from '../types'

export function FuelView() {
  const { state, update, addMeals, removeMeals, openSheet, showToast } = useApp()
  const { meals, favs, numbers } = state
  const total = eaten(meals)
  const sorted = [...meals].sort((a, b) => a.time.localeCompare(b.time))

  const quickAdd = (food: Food) => {
    const ids = addMeals([{ food, qty: 1, size: 'M' }])
    showToast('Added ' + food.name, () => removeMeals(ids))
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
      const { id: _id, time: _time, ...food } = meal
      update((s) => ({ ...s, favs: [...s.favs, { ...food, id: s.nextId }], nextId: s.nextId + 1 }))
      showToast('Saved to My foods')
    }
  }

  return (
    <>
      <TopBar subtitle={TODAY_LABEL} title="Fuel" />
      <section className="card big">
        {numbers ? (
          <div className="baseline">
            <span className="num fuel-total">{fmt(total)}</span>
            <span className="muted" style={{ fontSize: 15 }}>
              kcal today
            </span>
          </div>
        ) : (
          <div className="headline" style={{ fontSize: 24 }}>
            {meals.length} {meals.length === 1 ? 'item' : 'items'} today
          </div>
        )}
        <div className="row center" style={{ marginTop: 4 }}>
          <span className="h">Macros and fiber</span>
          <button className="tbtn link" onClick={() => openSheet('targets')}>
            Edit targets
          </button>
        </div>
        <MacroBlock />
      </section>

      <QuickChips onPick={quickAdd} showManage />

      <div className="col" style={{ gap: 8 }}>
        <div className="row">
          <span className="h">Logged today</span>
          {numbers && (
            <span className="muted" style={{ fontSize: 13 }}>
              {fmt(total)} kcal
            </span>
          )}
        </div>
        {sorted.length ? (
          <div className="list">
            {sorted.map((meal) => {
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
        ) : (
          <div className="card">
            <p>Nothing logged yet today.</p>
          </div>
        )}
      </div>

      {!state.dismissed.chips && (
        <TipBox
          title="A small idea for your week"
          actions={
            <>
              <button
                className="tbtn"
                onClick={() => update((s) => ({ ...s, dismissed: { ...s.dismissed, chips: true } }))}
              >
                Not now
              </button>
              <button className="tonal" onClick={() => openSheet('snacks')}>
                Lighter snacks
              </button>
            </>
          }
        >
          Chips showed up 5 times in two weeks
          {numbers
            ? ', about 300 kcal each. Swapping half for a lighter snack frees up around 375 kcal a week.'
            : '. Swapping half of those for a lighter snack would make a nice difference over a week.'}
        </TipBox>
      )}

      <button className="fab" onClick={() => openSheet('add')}>
        <PlusIcon />
        Add food
      </button>
    </>
  )
}
