import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

function Stroke({ size, width, children }: { size: number; width: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PlusIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size} width={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
)

export const ChevronIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size} width={2}>
    <path d="M9 6l6 6-6 6" />
  </Stroke>
)

export const BackIcon = ({ size = 24 }: IconProps) => (
  <Stroke size={size} width={2}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Stroke>
)

export const MoreIcon = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
)

export const WatchIcon = ({ size = 16 }: IconProps) => (
  <Stroke size={size} width={1.8}>
    <rect x="6" y="6" width="12" height="12" rx="6" />
    <path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3" />
  </Stroke>
)

export const BulbIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size} width={1.8}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </Stroke>
)

export const TrashIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size} width={1.8}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Stroke>
)

export const CloseIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size} width={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
)

export const TodayIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size} width={1.9}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Stroke>
)

export const FuelIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size} width={1.9}>
    <path d="M12 7c-2-2-7-1.5-7 3.5C5 15.5 8.5 21 12 21s7-5.5 7-10.5C19 5.5 14 5 12 7z" />
    <path d="M12 7c0-2 1-3.5 3-4" />
  </Stroke>
)

export const ShareIcon = ({ size = 20 }: IconProps) => (
  <Stroke size={size} width={1.9}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
  </Stroke>
)

export const BurnIcon = ({ size = 22 }: IconProps) => (
  <Stroke size={size} width={1.9}>
    <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />
  </Stroke>
)

const STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'

export const StarIcon = ({ size = 16, filled = true }: IconProps & { filled?: boolean }) =>
  filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  ) : (
    <Stroke size={size} width={1.8}>
      <path d={STAR_PATH} />
    </Stroke>
  )
