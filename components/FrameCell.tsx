interface FrameCellProps {
  frameIndex: number
  rollNumber: number
  value?: string
  onClick?: () => void
  isSelected?: boolean
  domRef?: React.RefObject<HTMLButtonElement | null>
}

export function FrameCell({ frameIndex, rollNumber, value = "-", onClick, isSelected, domRef }: FrameCellProps) {
  return (
    <button
      ref={domRef}
      type="button"
      onClick={onClick}
      className={`min-w-9 min-h-10 flex items-center justify-center border font-medium text-base rounded-md transition-all focus:outline-none 
        ${isSelected
          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] scale-105 z-10'
          : 'bg-neutral-900/50 border-white/10 text-white hover:bg-white/10 active:bg-white/20'
        }`}
      aria-label={`Frame ${frameIndex + 1}, Roll ${rollNumber + 1}`}
    >
      {value}
    </button>
  )
}
