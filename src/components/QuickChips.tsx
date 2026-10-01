import { quickList, type QuickEntry } from '../lib/model'
import { useApp } from '../state/AppContext'
import type { Food } from '../types'
import { PlusIcon, StarIcon } from './Icons'

export function QuickChips({ onPick, showManage }: { onPick: (food: Food) => void; showManage?: boolean }) {
  const { state, openSheet } = useApp()
  const entries = quickList(state.favs, state.meals)
  const favs = entries.filter((e) => e.source === 'fav')
  const frequent = entries.filter((e) => e.source === 'freq')

  const chip = (entry: QuickEntry) => (
    <button
      key={entry.source + entry.food.name}
      className={entry.source === 'fav' ? 'qchip fav' : 'qchip'}
      onClick={() => onPick(entry.food)}
    >
      {entry.source === 'fav' ? <StarIcon /> : <PlusIcon size={16} />}
      {entry.food.name}
    </button>
  )

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row center">
        <span className="h">My foods</span>
        {showManage && (
          <button className="tbtn link" onClick={() => openSheet('favs')}>
            Manage
          </button>
        )}
      </div>
      <div className="qchips">
        {favs.map(chip)}
        <button className="qchip new" onClick={() => openSheet('newfav')}>
          <PlusIcon size={16} />
          New
        </button>
      </div>
      {frequent.length > 0 && (
        <>
          <span className="h" style={{ fontSize: 14, marginTop: 4 }}>
            Often in your diary
          </span>
          <div className="qchips">{frequent.map(chip)}</div>
        </>
      )}
    </div>
  )
}
