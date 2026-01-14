'use client'

import { useState, useCallback, useEffect } from 'react'
import { use } from 'react'
import { PlayerRow } from "@/components/PlayerRow"
import { PinKeypad } from "@/components/PinKeypad"
import { useRealtimeRolls, PlayerWithFrames } from "@/lib/useRealtimeRolls"
import { addPlayer, insertRoll, resetFrame, resetPlayer, updatePlayerName } from "@/lib/bowling"

interface GamePageProps {
  params: Promise<{ id: string }>
}

interface SelectedCell {
  playerId: string
  frameIndex: number
  rollNumber: number
}

export default function GamePage({ params }: GamePageProps) {
  const { id: gameId } = use(params)
  const [players, setPlayers] = useState<PlayerWithFrames[]>([])
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)

  // Supabase realtime subscription
  const { loading, error, refetch } = useRealtimeRolls(gameId, setPlayers)

  // Determine max pins for the selected cell
  const getMaxPinsForSelection = useCallback(() => {
    if (!selectedCell) return 10

    // Find the player
    const player = players.find(p => p.id === selectedCell.playerId)
    if (!player) return 10

    const { frameIndex, rollNumber } = selectedCell
    const frame = player.frames[frameIndex]

    if (rollNumber === 0) return 10 // First roll always max 10

    // Frame 1-9 Second Roll
    if (frameIndex < 9 && rollNumber === 1) {
      if (!frame || frame.rolls.length === 0) return 10 // Should be covered by roll 0 logic but safe fallback
      const roll1 = frame.rolls.find(r => r.rollNumber === 0)
      return roll1 ? 10 - roll1.pins : 10
    }

    // Frame 10 Logic
    if (frameIndex === 9) {
      const rolls = frame?.rolls || []
      const roll1 = rolls.find(r => r.rollNumber === 0)
      const roll2 = rolls.find(r => r.rollNumber === 1)

      // Roll 2
      if (rollNumber === 1) {
        if (!roll1) return 10
        // If Roll 1 was Strike (10), pins reset to 10.
        // If Roll 1 was < 10, max pins is 10 - Roll 1.
        return roll1.pins === 10 ? 10 : 10 - roll1.pins
      }

      // Roll 3
      if (rollNumber === 2) {
        if (!roll2) return 10 // Should not happen if strictly sequential
        // Logic for Roll 3 depends on Roll 2
        // If Roll 2 was a Strike (10), or Roll 2 completed a Spare (pins=10-Prev), then new pins are 10.
        // BUT wait. 
        // Case: X, X, ? -> Max 10.
        // Case: X, 5, ? -> Max 10-5 = 5 (Spare attempt for 2nd/3rd balls of frame).
        // Case: 5, /, ? -> Max 10 (Fresh extra ball).

        if (roll2.pins === 10) return 10 // X, X, ? -> 10.
        if (roll1 && roll1.pins + roll2.pins === 10 && roll1.pins !== 10) return 10 // Spare -> 10. (5, /, X)

        // If Roll 1 was X, and Roll 2 was < 10. (X, 5, ?) -> Max is 5 (to complete spare).
        // Actually, wait. X followed by open frame?
        // In 10th frame:
        // 10, 5 ... Next is spare attempt? Yes. 
        if (roll1 && roll1.pins === 10 && roll2.pins < 10) {
          return 10 - roll2.pins
        }

        return 10
      }
    }

    return 10
  }, [selectedCell, players])

  // Logic to move to next cell automatically
  const advanceTurn = useCallback((playerId: string, frameIndex: number, rollNumber: number, pins: number) => {
    // 1. Find current player index
    const pIndex = players.findIndex(p => p.id === playerId)
    if (pIndex === -1) return

    let nextPlayerIndex = pIndex
    let nextFrameIndex = frameIndex
    let nextRollNumber = rollNumber + 1

    // Determine Logic
    // Standard Frame (0-8)
    if (frameIndex < 9) {
      const isStrike = rollNumber === 0 && pins === 10

      if (isStrike || nextRollNumber > 1) {
        // Turn Ended -> Next Player
        nextPlayerIndex = (pIndex + 1) % players.length
        nextRollNumber = 0

        // If we wrapped around to first player, next frame
        if (nextPlayerIndex === 0 && pIndex === players.length - 1) {
          nextFrameIndex = frameIndex + 1
        } else {
          // Same frame, next player
          nextFrameIndex = frameIndex
        }
      } else {
        // Stay with same player, next roll (Open frame attempt)
        // nextRollNumber is already incremented
      }
    }
    // Frame 10
    else {
      // Logic:
      // Roll 0 -> Always Roll 1
      // Roll 1:
      //   If Roll 0 + Roll 1 < 10 (Open) -> End Turn (Next Player or Game Over)
      //   If Roll 0 + Roll 1 >= 10 (X or /) -> Roll 2
      // Roll 2 -> End Turn (Next Player or Game Over)

      const player = players[pIndex]
      const frame = player.frames[9]
      // We need current state of frame 10 but we only have input.
      // We can approximate or optimistically calculate.
      // Actually, we are predicting the NEXT step.

      let turnEnded = false

      if (rollNumber === 0) {
        // Always goes to roll 1
        nextRollNumber = 1
      } else if (rollNumber === 1) {
        // Check if earned 3rd roll
        // Case 1: Roll 0 was X -> Earned.
        // Case 2: Roll 0 + Roll 1 = 10 (Spare) -> Earned.

        // Need Roll 0 value.
        const roll0 = frame?.rolls.find(r => r.rollNumber === 0)?.pins || 0
        // Note: If this is the *input* event, state `players` might not have updated yet with the new roll?
        // YES. This is critical. `players` is stale here relative to the input just made.
        // BUT we know `pins` is the input for `rollNumber`.

        if (roll0 === 10 || roll0 + pins === 10) {
          nextRollNumber = 2
        } else {
          turnEnded = true
        }
      } else if (rollNumber === 2) {
        turnEnded = true
      }

      if (turnEnded) {
        nextPlayerIndex = (pIndex + 1) % players.length
        nextRollNumber = 0
        if (nextPlayerIndex === 0 && pIndex === players.length - 1) {
          // Game Over potentially? Or just deselect.
          setSelectedCell(null)
          return
        }
      }
    }

    const nextPlayer = players[nextPlayerIndex]
    if (nextPlayer) {
      setSelectedCell({
        playerId: nextPlayer.id,
        frameIndex: nextFrameIndex,
        rollNumber: nextRollNumber
      })
    } else {
      setSelectedCell(null)
    }

  }, [players])

  // Supabase mutation: Insert roll
  const handleRollInput = useCallback(
    async (pins: number) => {
      if (!selectedCell) return

      const { playerId, frameIndex, rollNumber } = selectedCell

      try {
        // Optimistically advance turn? Or wait? 
        // User asked for "automatically changed after inputting".
        // Better to advance immediately for UI responsiveness.
        advanceTurn(playerId, frameIndex, rollNumber, pins)

        await insertRoll({
          game_id: gameId,
          player_id: playerId,
          frame: frameIndex + 1, // Convert 0-indexed to 1-indexed
          roll: rollNumber + 1, // Convert 0-indexed to 1-indexed
          pins,
        })
      } catch (err) {
        console.error('Failed to insert roll:', err)
        alert('Failed to insert roll. Please try again.')
      }
    },
    [gameId, selectedCell, advanceTurn]
  )

  const handleCellSelect = (playerId: string, frameIndex: number, rollNumber: number) => {
    setSelectedCell({ playerId, frameIndex, rollNumber })
  }

  // Supabase mutation: Update player name
  const handlePlayerNameUpdate = useCallback(
    async (playerId: string, newName: string) => {
      try {
        await updatePlayerName(playerId, newName)
      } catch (err) {
        console.error('Failed to update player name:', err)
        alert('Failed to update player name. Please try again.')
      }
    },
    []
  )

  // Supabase mutation: Reset frame (delete rolls for a frame)
  const handleResetFrame = useCallback(
    async (playerId: string, frameNumber: number) => {
      try {
        const frameDbIndex = frameNumber + 1
        await resetFrame(gameId, playerId, frameDbIndex)
        refetch()
        // If we reset, maybe maintain selection or clear it? 
        // Clearing is safer.
        setSelectedCell(null)
      } catch (err) {
        console.error('Failed to reset frame:', err)
        alert(`Failed to reset frame: ${(err as Error).message}`)
      }
    },
    [gameId, refetch]
  )

  // Supabase mutation: Reset ALL frames for a player
  const handleResetPlayer = useCallback(
    async (playerId: string) => {
      try {
        await resetPlayer(gameId, playerId)
        refetch()
        setSelectedCell(null)
      } catch (err) {
        console.error('Failed to reset player:', err)
        alert(`Failed to reset player: ${(err as Error).message}`)
      }
    },
    [gameId, refetch]
  )

  // Auto-Select First Available Frame on Load
  useEffect(() => {
    if (players.length > 0 && !selectedCell) {
      // Find the first player and frame that isn't complete?
      // For simplicity, just select the first player, first frame if nothing else.
      // Or smarter: iterate players, then frames 0-9. Find first frame with missing rolls.

      for (const player of players) {
        for (let f = 0; f < 10; f++) {
          const frame = player.frames[f]
          const rolls = frame?.rolls || []
          // Check if frame is complete
          if (f < 9) {
            // Frames 1-9: Complete if Strike (roll 0 is 10) or 2 rolls exist
            const isStrike = rolls.some(r => r.rollNumber === 0 && r.pins === 10)
            if (isStrike) continue;
            if (rolls.length >= 2) continue;

            // Found incomplete frame
            // Determine next roll number
            const nextRoll = rolls.length // 0 or 1
            setSelectedCell({ playerId: player.id, frameIndex: f, rollNumber: nextRoll })
            return
          } else {
            // Frame 10
            // Logic: 
            // X, X, X (3 rolls)
            // X, 5, / (3 rolls)
            // 5, /, X (3 rolls)
            // 5, 4 (2 rolls) -> Complete

            // If 3 rolls, complete
            if (rolls.length >= 3) continue;

            // If 2 rolls:
            // If Roll 0 + Roll 1 < 10 (Open), complete.
            // If Roll 0 + Roll 1 >= 10, Needs 3rd roll.
            if (rolls.length === 2) {
              const r0 = rolls.find(r => r.rollNumber === 0)?.pins || 0
              const r1 = rolls.find(r => r.rollNumber === 1)?.pins || 0
              if (r0 + r1 < 10 && r0 !== 10) continue; // Open frame, complete
            }

            const nextRoll = rolls.length
            setSelectedCell({ playerId: player.id, frameIndex: f, rollNumber: nextRoll })
            return
          }
        }
      }
    }
  }, [players, selectedCell])

  // Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return

      const maxPins = getMaxPinsForSelection()
      let pins: number | null = null

      if (e.key >= '0' && e.key <= '9') {
        pins = parseInt(e.key, 10)
      } else if (e.key.toLowerCase() === 'x') {
        pins = 10
      } else if (e.key === '/') {
        pins = 10 // Logic handled by maxPins mainly? 
        // Wait, if I type '/', it usually means "Spare". 
        // Pins should be calculated as (10 - previous).
        // MaxPins logic ALREADY returns (10 - previous) for spares situation.
        // So hitting '/' should basically input `maxPins`.
        if (maxPins < 10) pins = maxPins
      } else if (e.key === '-') {
        pins = 0
      }

      // If we got a valid pin input
      if (pins !== null) {
        if (pins <= maxPins) {
          handleRollInput(pins)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell, getMaxPinsForSelection, handleRollInput])

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-400 animate-pulse">Loading game...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-red-500">Error loading game: {error.message}</p>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans p-4 md:p-6 pb-96 overflow-x-hidden">
      {/* Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <main className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
              Bowling Scorecard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-neutral-400">Game ID:</span>
              <span className="font-mono text-cyan-400 font-bold tracking-widest bg-white/5 py-0.5 px-2 rounded border border-white/5">
                {gameId}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <a
              href="/"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg border border-white/10 transition-colors inline-flex items-center"
            >
              Exit Game
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-sm font-medium rounded-lg border border-cyan-500/20 transition-colors"
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Scorecard Container */}
        <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-4 shadow-xl backdrop-blur-sm min-h-[500px]">
          {/* Player Rows */}
          <div className="flex flex-col gap-3">
            {players.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 bg-white/5 rounded-full">
                  <span className="text-4xl">🎳</span>
                </div>
                <h3 className="text-xl font-semibold text-white">Waiting for Players</h3>
                <p className="text-neutral-400 max-w-sm mx-auto">
                  Share the Game ID <span className="text-cyan-400 font-mono font-bold">{gameId}</span> with the other alley/device to join.
                </p>
                <div className="animate-pulse text-xs text-neutral-500 uppercase tracking-widest mt-8">
                  Listening for updates...
                </div>
              </div>
            ) : (
              players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  playerIndex={index}
                  onRollClick={() => { }} // Not used directly anymore
                  onNameUpdate={handlePlayerNameUpdate}
                  onResetFrame={handleResetFrame}
                  onResetPlayer={handleResetPlayer}
                  selectedCell={selectedCell}
                  onCellSelect={handleCellSelect}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Pin Keypad (Sticky Bottom) */}
      {selectedCell && (
        <PinKeypad
          maxPins={getMaxPinsForSelection()}
          onPinClick={handleRollInput}
          onClose={() => setSelectedCell(null)}
          isStrikePossible={selectedCell.rollNumber === 0} // Basic heuristic
        />
      )}
    </div>
  )
}
