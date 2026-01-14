import { supabase } from './supabase'

export interface InsertRollParams {
  game_id: string
  player_id: string
  frame: number
  roll: number
  pins: number
}

export interface Roll {
  id: string
  game_id: string
  player_id: string
  frame: number
  roll: number
  pins: number
  created_at?: string
}

export interface Player {
  id: string
  game_id: string
  display_name: string
  created_at?: string
  updated_at?: string
}

/**
 * Supabase mutation: Creates a new game record
 * Required to satisfy foreign key constraints before adding players
 */
export async function createGame(gameId: string): Promise<void> {
  const { error } = await supabase
    .from('games')
    .insert({ id: gameId })

  if (error) {
    // If game already exists (unlikely with UUID but possible on retry), ignore error 23505
    if (error.code === '23505') return
    throw new Error(`Failed to create game: ${error.message}`)
  }
}

/**
 * Supabase mutation: Inserts or updates a roll in the rolls table (upsert)
 * If a roll already exists for the same game_id, player_id, frame, and roll, it updates it
 * Otherwise, it inserts a new roll
 * @param params - Roll parameters including game_id, player_id, frame, roll, and pins
 * @returns The inserted/updated roll data
 * @throws Error if the operation fails
 */
export async function insertRoll(params: InsertRollParams): Promise<Roll> {
  const { game_id, player_id, frame, roll, pins } = params

  // First, check if a roll already exists for this combination
  const { data: existingRolls, error: checkError } = await supabase
    .from('rolls')
    .select('*')
    .eq('game_id', game_id)
    .eq('player_id', player_id)
    .eq('frame', frame)
    .eq('roll', roll)
    .maybeSingle()

  if (checkError) {
    throw new Error(`Failed to check existing roll: ${checkError.message}`)
  }

  if (existingRolls) {
    // Update existing roll
    const { data, error } = await supabase
      .from('rolls')
      .update({ pins })
      .eq('id', existingRolls.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update roll: ${error.message}`)
    }

    if (!data) {
      throw new Error('Failed to update roll: No data returned')
    }

    return data as Roll
  } else {
    // Insert new roll
    const { data, error } = await supabase
      .from('rolls')
      .insert({
        game_id,
        player_id,
        frame,
        roll,
        pins,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to insert roll: ${error.message}`)
    }

    if (!data) {
      throw new Error('Failed to insert roll: No data returned')
    }

    return data as Roll
  }
}

/**
 * Supabase mutation: Adds a new player to a game
 * @param gameId - The game ID
 * @param name - The player's name
 * @returns The inserted player data
 * @throws Error if the insertion fails
 */
export async function addPlayer(gameId: string, name: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      display_name: name || `Player ${Date.now()}`,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add player: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to add player: No data returned')
  }

  return data as Player
}

/**
 * Supabase mutation: Updates a player's name
 * @param playerId - The player ID
 * @param name - The new player name
 * @returns The updated player data
 * @throws Error if the update fails
 */
export async function updatePlayerName(playerId: string, name: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update({ display_name: name })
    .eq('id', playerId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update player name: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to update player name: No data returned')
  }

  return data as Player
}

/**
 * Supabase mutation: Resets a frame for a player by deleting all rolls for that frame
 * @param gameId - The game ID
 * @param playerId - The player ID
 * @param frame - The frame number to reset (1-10, 1-indexed)
 * @throws Error if the deletion fails
 */
export async function resetFrame(gameId: string, playerId: string, frame: number): Promise<void> {
  const { data, error } = await supabase
    .from('rolls')
    .delete()
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .eq('frame', frame)
    .select()

  if (error) {
    throw new Error(`Failed to reset frame: ${error.message}`)
  }

  // Return the deleted data for debugging/logging if needed
  return
}

/**
 * Supabase mutation: Resets ALL frames for a player
 * @param gameId - The game ID
 * @param playerId - The player ID
 * @throws Error if the deletion fails
 */
export async function resetPlayer(gameId: string, playerId: string): Promise<void> {
  const { error } = await supabase
    .from('rolls')
    .delete()
    .eq('game_id', gameId)
    .eq('player_id', playerId)

  if (error) {
    throw new Error(`Failed to reset player: ${error.message}`)
  }
}
