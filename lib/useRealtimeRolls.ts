'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { Roll, Player } from './bowling'

export interface PlayerWithFrames extends Player {
  frames: FrameData[]
  total: number
}

export interface FrameData {
  frameNumber: number
  rolls: Array<{ rollNumber: number; pins: number }>
  frameTotal: number
  runningTotal: number
}

/**
 * Gets the next roll's pins for spare bonus calculation
 * Looks ahead to the next frame(s) to find the first roll
 */
function getNextRoll(frames: FrameData[], currentFrameIndex: number): number {
  // Look through subsequent frames to find the first roll
  for (let i = currentFrameIndex + 1; i < frames.length && i < 10; i++) {
    const frame = frames[i]
    if (frame.rolls.length > 0) {
      // Sort rolls to ensure we get the first one
      const sortedRolls = [...frame.rolls].sort((a, b) => a.rollNumber - b.rollNumber)
      return sortedRolls[0]?.pins || 0
    }
  }
  return 0 // No next roll available yet
}

/**
 * Gets the next two rolls' pins for strike bonus calculation
 * Looks ahead to the next frame(s) to find the first two rolls
 */
function getNextTwoRolls(frames: FrameData[], currentFrameIndex: number): number {
  let total = 0
  let rollsFound = 0

  // Look through subsequent frames to find the first two rolls
  for (let i = currentFrameIndex + 1; i < frames.length && i < 10 && rollsFound < 2; i++) {
    const frame = frames[i]
    if (frame.rolls.length > 0) {
      // Sort rolls to ensure correct order
      const sortedRolls = [...frame.rolls].sort((a, b) => a.rollNumber - b.rollNumber)
      
      for (const roll of sortedRolls) {
        if (rollsFound < 2) {
          total += roll.pins
          rollsFound++
          if (rollsFound >= 2) break
        }
      }
    }
  }

  return total
}

/**
 * Hook that subscribes to realtime rolls updates and processes them into player frame data
 * Updates players state via setPlayers callback whenever rolls change
 */
export function useRealtimeRolls(
  gameId: string,
  setPlayers: (players: PlayerWithFrames[]) => void
) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchDataRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (!gameId) {
      setLoading(false)
      return
    }

    let playersData: Player[] = []
    let rollsData: Roll[] = []

    // Process rolls into player frame data
    const processRollsIntoPlayers = (
      players: Player[],
      rolls: Roll[]
    ): PlayerWithFrames[] => {
      return players.map((player) => {
        const playerRolls = rolls.filter((roll) => roll.player_id === player.id)
        const frames: FrameData[] = Array.from({ length: 10 }, (_, i) => ({
          frameNumber: i,
          rolls: [],
          frameTotal: 0,
          runningTotal: 0,
        }))

        // Group rolls by frame and sort by roll number
        // Note: Database stores frames as 1-10, convert to 0-indexed for array access
        playerRolls
          .sort((a, b) => {
            // Sort by frame first, then by roll number
            if (a.frame !== b.frame) return a.frame - b.frame
            return a.roll - b.roll
          })
          .forEach((roll) => {
            const frameIndex = roll.frame - 1 // Convert 1-indexed to 0-indexed
            const frame = frames[frameIndex]
            if (frame) {
              frame.rolls.push({
                rollNumber: roll.roll - 1, // Convert 1-indexed to 0-indexed
                pins: roll.pins,
              })
            }
          })

        // Calculate frame totals and running totals with proper strike/spare logic
        let runningTotal = 0
        frames.forEach((frame, frameIndex) => {
          // Sort rolls by rollNumber to ensure correct order
          frame.rolls.sort((a, b) => a.rollNumber - b.rollNumber)

          if (frame.rolls.length === 0) {
            frame.frameTotal = 0
            frame.runningTotal = runningTotal
            return
          }

          const roll1 = frame.rolls[0]?.pins || 0
          const roll2 = frame.rolls[1]?.pins || 0
          const roll3 = frame.rolls[2]?.pins || 0

          if (frameIndex === 9) {
            // Frame 10: Special scoring rules
            // - Strike in first roll → two extra rolls (sum all 3)
            // - Spare in first 2 rolls → one extra roll (sum all 3)
            // - Otherwise → sum of two rolls
            if (roll1 === 10) {
              // Strike in first roll: sum all 3 rolls
              frame.frameTotal = roll1 + roll2 + roll3
            } else if (roll1 + roll2 === 10) {
              // Spare in first 2 rolls: sum all 3 rolls
              frame.frameTotal = roll1 + roll2 + roll3
            } else {
              // Open frame: sum of two rolls
              frame.frameTotal = roll1 + roll2
            }
          } else {
            // Frames 1-9: Calculate with strike/spare logic
            if (roll1 === 10) {
              // Strike: 10 + next two rolls
              frame.frameTotal = 10 + getNextTwoRolls(frames, frameIndex)
            } else if (roll1 + roll2 === 10) {
              // Spare: 10 + next roll
              frame.frameTotal = 10 + getNextRoll(frames, frameIndex)
            } else {
              // Open frame: sum of two rolls
              frame.frameTotal = roll1 + roll2
            }
          }

          runningTotal += frame.frameTotal
          frame.runningTotal = runningTotal
        })

        return {
          ...player,
          frames,
          total: runningTotal,
        }
      })
    }

    // Update function that processes current state
    const updatePlayersFromRolls = () => {
      const processedPlayers = processRollsIntoPlayers(playersData, rollsData)
      setPlayers(processedPlayers)
    }

    // Supabase query: Fetch initial players and rolls
    const fetchInitialData = async () => {
      try {
        setLoading(true)

        // Supabase query: Fetch players for this game
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true })

        if (playersError) throw playersError

        // Supabase query: Fetch rolls for this game
        const { data: rolls, error: rollsError } = await supabase
          .from('rolls')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true })

        if (rollsError) throw rollsError

        playersData = players || []
        rollsData = rolls || []

        // Process and update state
        const processedPlayers = processRollsIntoPlayers(playersData, rollsData)
        setPlayers(processedPlayers)
        setError(null)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch game data')
        setError(error)
        console.error('Error fetching initial data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
    
    // Store fetch function in ref for manual refetch
    fetchDataRef.current = fetchInitialData

    // Supabase realtime subscription: Listen for rolls changes
    const rollsChannel = supabase
      .channel(`rolls:game_id=eq.${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rolls',
          filter: `game_id=eq.${gameId}`,
        },
        (payload: RealtimePostgresChangesPayload<Roll>) => {
          if (payload.eventType === 'INSERT') {
            rollsData = [...rollsData, payload.new as Roll]
            updatePlayersFromRolls()
          } else if (payload.eventType === 'UPDATE') {
            const updatedRoll = payload.new as Roll
            console.log('UPDATE event received for roll:', updatedRoll.id, 'frame:', updatedRoll.frame, 'pins:', updatedRoll.pins)
            const existingIndex = rollsData.findIndex((roll) => roll.id === updatedRoll.id)
            if (existingIndex >= 0) {
              // Update existing roll
              rollsData[existingIndex] = updatedRoll
            } else {
              // Roll doesn't exist in local data, add it
              rollsData = [...rollsData, updatedRoll]
            }
            updatePlayersFromRolls()
          } else if (payload.eventType === 'DELETE') {
            const deletedRoll = payload.old as Roll
            console.log('DELETE event received for roll:', deletedRoll.id, 'frame:', deletedRoll.frame)
            rollsData = rollsData.filter((roll) => roll.id !== deletedRoll.id)
            updatePlayersFromRolls()
          }
        }
      )
      .subscribe()

    // Supabase realtime subscription: Listen for players changes
    const playersChannel = supabase
      .channel(`players:game_id=eq.${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Player>) => {
          if (payload.eventType === 'INSERT') {
            // Supabase query: Refetch players to get full list
            const { data: players } = await supabase
              .from('players')
              .select('*')
              .eq('game_id', gameId)
              .order('created_at', { ascending: true })
            if (players) {
              playersData = players
              updatePlayersFromRolls()
            }
          } else if (payload.eventType === 'UPDATE') {
            playersData = playersData.map((player) =>
              player.id === payload.new.id ? (payload.new as Player) : player
            )
            updatePlayersFromRolls()
          } else if (payload.eventType === 'DELETE') {
            playersData = playersData.filter((player) => player.id !== payload.old.id)
            updatePlayersFromRolls()
          }
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(rollsChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [gameId, setPlayers])

  // Function to manually trigger a refetch (doesn't re-subscribe)
  const refetch = useCallback(async () => {
    if (fetchDataRef.current) {
      await fetchDataRef.current()
    }
  }, [])

  return { loading, error, refetch }
}
