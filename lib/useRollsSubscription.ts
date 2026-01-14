'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface Roll {
  id: string
  game_id: string
  player_id: string
  frame: number
  roll: number
  pins: number
  created_at?: string
}

export function useRollsSubscription(gameId: string) {
  const [rolls, setRolls] = useState<Roll[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!gameId) {
      setLoading(false)
      return
    }

    // Initial fetch
    const fetchInitialRolls = async () => {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('rolls')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true })

        if (fetchError) {
          throw fetchError
        }

        setRolls(data || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch rolls'))
        console.error('Error fetching initial rolls:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialRolls()

    // Set up realtime subscription
    const channel = supabase
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
            setRolls((prev) => [...prev, payload.new as Roll])
          } else if (payload.eventType === 'UPDATE') {
            setRolls((prev) =>
              prev.map((roll) =>
                roll.id === payload.new.id ? (payload.new as Roll) : roll
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setRolls((prev) =>
              prev.filter((roll) => roll.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to rolls updates for game:', gameId)
        } else if (status === 'CHANNEL_ERROR') {
          setError(new Error('Failed to subscribe to rolls updates'))
          console.error('Channel subscription error')
        }
      })

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return { rolls, loading, error }
}
