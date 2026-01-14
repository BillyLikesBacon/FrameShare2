'use client'

import { useState, useRef, useEffect } from 'react'
import { FrameCell } from "./FrameCell"
import { PlayerWithFrames } from "@/lib/useRealtimeRolls"

interface PlayerRowProps {
  player: PlayerWithFrames
  playerIndex: number
  onRollClick: (playerId: string, frame: number, roll: number, pins: number) => void
  onNameUpdate: (playerId: string, newName: string) => void
  onResetFrame: (playerId: string, frameNumber: number) => void
  onResetPlayer: (playerId: string) => void
  selectedCell: { playerId: string, frameIndex: number, rollNumber: number } | null
  onCellSelect: (playerId: string, frameIndex: number, rollNumber: number) => void
}

export function PlayerRow({
  player,
  playerIndex,
  onRollClick,
  onNameUpdate,
  onResetFrame,
  onResetPlayer,
  selectedCell,
  onCellSelect,
}: PlayerRowProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(player.display_name)
  const activeCellRef = useRef<HTMLButtonElement>(null)

  // Scroll active cell into view
  useEffect(() => {
    if (activeCellRef.current) {
      // Only scroll if this is truly the selected cell (covered by logic of ref assignment usually, but here we just have one ref? No).
      // Actually, we pass the ref to the specific cell that IS selected.
      // So if activeCellRef.current exists, it means one of the cells rendered with this ref.
      activeCellRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
  }, [selectedCell])

  const isEvenRow = playerIndex % 2 === 0

  // Handle name edit
  const handleNameClick = () => {
    setIsEditingName(true)
    setEditedName(player.display_name)
  }

  const handleNameSubmit = () => {
    if (editedName.trim() && editedName !== player.display_name) {
      // Supabase mutation: Update player name
      onNameUpdate(player.id, editedName.trim())
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
      setEditedName(player.display_name)
    }
  }

  // Handle roll click - opens pin selection
  // Handle roll click - selects the cell for the global keypad
  const handleFrameCellClick = (frameIndex: number, rollNumber: number) => {
    // Prevent entering second roll if first roll is a strike (frames 1-9 only)
    if (frameIndex < 9 && rollNumber === 1 && hasStrike(frameIndex)) {
      return // Don't allow second roll after a strike
    }

    // Select the cell
    onCellSelect(player.id, frameIndex, rollNumber)
  }

  // Check if frame has a strike (for frames 1-9, this means the second roll should be hidden)
  const hasStrike = (frameIndex: number): boolean => {
    if (frameIndex >= 9) return false // Frame 10 can have multiple strikes
    const frame = player.frames[frameIndex]
    if (!frame || frame.rolls.length === 0) return false
    const sortedRolls = [...frame.rolls].sort((a, b) => a.rollNumber - b.rollNumber)
    const firstRoll = sortedRolls[0]
    return firstRoll?.pins === 10
  }

  // Get roll value for display with proper strike/spare notation
  const getRollValue = (frameIndex: number, rollNumber: number): string => {
    const frame = player.frames[frameIndex]
    if (!frame) return '-'

    // Sort rolls to ensure correct order
    const sortedRolls = [...frame.rolls].sort((a, b) => a.rollNumber - b.rollNumber)
    const roll = sortedRolls.find((r) => r.rollNumber === rollNumber)

    if (!roll) return '-'

    // Check for Spare FIRST (prioritize / over X for second roll)
    if (rollNumber > 0) {
      const previousRoll = sortedRolls.find((r) => r.rollNumber === rollNumber - 1)
      if (previousRoll) {
        const previousPins = previousRoll.pins
        // Spare: previous + current = 10, and previous wasn't a strike 
        // (prev != 10 ensures we don't mark a 10 after a strike as a spare in Frame 10, unless intended)
        if (previousPins !== 10 && previousPins + roll.pins === 10) {
          return '/'
        }
      }
    }

    // Show "X" for any strike (10 pins)
    if (roll.pins === 10) {
      return 'X'
    }

    // Default: show pin number
    return roll.pins.toString()
  }

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-xl border border-white/5 backdrop-blur-md ${isEvenRow ? "bg-neutral-900/40" : "bg-neutral-900/20"}`}>
      {/* Player Name Header - Display prominently above the frames */}
      <div className="flex items-center justify-between mb-2">
        {isEditingName ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="font-bold text-white text-lg bg-neutral-950 border border-white/20 rounded px-3 py-1.5 min-w-[150px] focus:outline-none focus:border-cyan-500"
            autoFocus
          />
        ) : (
          <h3
            className="font-bold text-white text-lg truncate min-w-[150px] cursor-pointer hover:text-cyan-400 transition-colors"
            onClick={handleNameClick}
            title="Click to edit name"
          >
            {player.display_name || 'Unnamed Player'}
          </h3>
        )}
        {/* Reset Frame Button - resets current frame */}
        <button
          type="button"
          onClick={async () => {
            const result = prompt('Enter frame number (1-10) to reset, or type "ALL" to reset all scores:')
            if (result !== null && result.trim() !== '') {
              const upperInput = result.trim().toUpperCase()
              if (upperInput === 'ALL') {
                if (confirm('Are you sure you want to delete ALL scores for this player?')) {
                  await onResetPlayer(player.id)
                }
              } else {
                const frameNum = parseInt(result.trim(), 10)
                if (!isNaN(frameNum) && frameNum >= 1 && frameNum <= 10) {
                  // Convert to 0-indexed for the handler
                  const frameIndex = frameNum - 1
                  await onResetFrame(player.id, frameIndex)
                } else {
                  alert('Please enter a valid frame number (1-10) or "ALL".')
                }
              }
            }
          }}
          className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
        >
          Reset Frame
        </button>
      </div>

      {/* Frames Layout */}
      <div className="flex items-start gap-2">
        {/* Scrollable Frames Area */}
        <div className="flex-1 flex gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* Frames 1-9 (2 cells each, but second cell hidden if strike) */}
          {Array.from({ length: 9 }).map((_, frameIndex) => {
            const frame = player.frames[frameIndex]
            const isStrike = hasStrike(frameIndex)
            const isSelected0 = selectedCell?.playerId === player.id && selectedCell?.frameIndex === frameIndex && selectedCell?.rollNumber === 0
            const isSelected1 = selectedCell?.playerId === player.id && selectedCell?.frameIndex === frameIndex && selectedCell?.rollNumber === 1

            return (
              <div key={frameIndex} className="flex flex-col items-center gap-1 shrink-0">
                <div className="flex gap-0.5">
                  <FrameCell
                    frameIndex={frameIndex}
                    rollNumber={0}
                    value={getRollValue(frameIndex, 0)}
                    onClick={() => handleFrameCellClick(frameIndex, 0)}
                    isSelected={isSelected0}
                    domRef={isSelected0 ? activeCellRef : undefined}
                  />
                  {/* Hide second roll cell if first roll is a strike (frames 1-9 only) */}
                  {!isStrike && (
                    <FrameCell
                      frameIndex={frameIndex}
                      rollNumber={1}
                      value={getRollValue(frameIndex, 1)}
                      onClick={() => handleFrameCellClick(frameIndex, 1)}
                      isSelected={isSelected1}
                      domRef={isSelected1 ? activeCellRef : undefined}
                    />
                  )}
                  {/* Show empty space or dash when strike to maintain layout */}
                  {isStrike && (
                    <div className="min-w-9 min-h-10 flex items-center justify-center border border-white/5 bg-white/5 text-neutral-500 font-medium text-base rounded-md">
                      -
                    </div>
                  )}
                </div>
                {/* Display frame running total */}
                <div className="text-xs text-neutral-400 h-4 font-mono">
                  {frame?.runningTotal || 0}
                </div>
              </div>
            )
          })}

          {/* Frame 10 (3 cells) */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex gap-0.5">
              <FrameCell
                frameIndex={9}
                rollNumber={0}
                value={getRollValue(9, 0)}
                onClick={() => handleFrameCellClick(9, 0)}
                isSelected={selectedCell?.playerId === player.id && selectedCell?.frameIndex === 9 && selectedCell?.rollNumber === 0}
                domRef={selectedCell?.playerId === player.id && selectedCell?.frameIndex === 9 && selectedCell?.rollNumber === 0 ? activeCellRef : undefined}
              />
              <FrameCell
                frameIndex={9}
                rollNumber={1}
                value={getRollValue(9, 1)}
                onClick={() => handleFrameCellClick(9, 1)}
                isSelected={selectedCell?.playerId === player.id && selectedCell?.frameIndex === 9 && selectedCell?.rollNumber === 1}
                domRef={selectedCell?.playerId === player.id && selectedCell?.frameIndex === 9 && selectedCell?.rollNumber === 1 ? activeCellRef : undefined}
              />
              <FrameCell
                frameIndex={9}
                rollNumber={2}
                value={getRollValue(9, 2)}
                onClick={() => handleFrameCellClick(9, 2)}
                isSelected={selectedCell?.playerId === player.id && selectedCell?.frameIndex === 9 && selectedCell?.rollNumber === 2}
                domRef={selectedCell?.playerId === player.id && selectedCell?.frameIndex === 9 && selectedCell?.rollNumber === 2 ? activeCellRef : undefined}
              />
            </div>
            {/* Display frame running total */}
            <div className="text-xs text-neutral-400 h-4 font-mono">
              {player.frames[9]?.runningTotal || 0}
            </div>
          </div>
        </div>

        {/* Total Column (Fixed to right) */}
        <div className="flex flex-col items-center gap-1 shrink-0 pl-2 border-l border-white/10">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Total</span>
          <div className="min-w-12 min-h-10 flex items-center justify-center bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 font-bold text-lg rounded-md shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            {player.total}
          </div>
          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
