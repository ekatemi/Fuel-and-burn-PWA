import { useApp } from '../state/AppContext'

export function Toast() {
  const { toast, hideToast } = useApp()
  if (!toast) return null
  const { undo } = toast
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.message}</span>
      {undo && (
        <button
          onClick={() => {
            undo()
            hideToast()
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
}
