import { supabase, getTableNames } from './supabase'
import type { Match, MatchPlayer, MatchStat } from './types'

export async function recalculateStats(season: number) {
  const tables = getTableNames(season)
  const yearStart = `${season}-01-01`
  const yearEnd = `${season + 1}-01-01`

  // Get all completed matches
  let matchQuery = supabase.from(tables.matches).select('*').eq('status', 'completed')
  if (season === 2025) {
    matchQuery = matchQuery.gte('match_date', yearStart).lt('match_date', yearEnd)
  }
  const { data: matches, error: matchErr } = await matchQuery
  if (matchErr) throw matchErr
  if (!matches?.length) return

  const matchIds = matches.map((m: Match) => m.id)

  // Get all players and stats
  const { data: allPlayers } = await supabase
    .from(tables.matchPlayers).select('*').in('match_id', matchIds)
  const { data: allStats } = await supabase
    .from(tables.matchStats).select('*').in('match_id', matchIds)

  if (!allPlayers) return

  // Build stats per player
  const statsMap: Record<string, {
    attendance_total: number; attendance_internal: number; attendance_external: number
    goals_total: number; goals_internal: number; goals_external: number
    assists_total: number; assists_internal: number; assists_external: number
  }> = {}

  const matchMap = new Map(matches.map((m: Match) => [m.id, m]))

  // Track which player+match combos we've already counted for attendance
  // This deduplicates air-drop players (those on both teams in one match)
  const attendanceCounted = new Set<string>()

  for (const mp of allPlayers as MatchPlayer[]) {
    const match = matchMap.get(mp.match_id)
    if (!match) continue

    if (!statsMap[mp.player_name]) {
      statsMap[mp.player_name] = {
        attendance_total: 0, attendance_internal: 0, attendance_external: 0,
        goals_total: 0, goals_internal: 0, goals_external: 0,
        assists_total: 0, assists_internal: 0, assists_external: 0,
      }
    }

    // For air-drop players, only count attendance once per match
    const attendanceKey = `${mp.match_id}_${mp.player_name}`
    if (attendanceCounted.has(attendanceKey)) continue
    attendanceCounted.add(attendanceKey)

    const s = statsMap[mp.player_name]
    s.attendance_total++
    if (match.match_type === '内战') s.attendance_internal++
    else s.attendance_external++
  }

  // Add goals and assists
  if (allStats) {
    for (const stat of allStats as MatchStat[]) {
      const match = matchMap.get(stat.match_id)
      if (!match || !statsMap[stat.player_name]) continue

      const s = statsMap[stat.player_name]
      const goals = stat.goals || 0
      const assists = stat.assists || 0

      s.goals_total += goals
      s.assists_total += assists
      if (match.match_type === '内战') {
        s.goals_internal += goals
        s.assists_internal += assists
      } else {
        s.goals_external += goals
        s.assists_external += assists
      }
    }
  }

  // Update player_stats table: clear and re-insert
  await supabase.from(tables.playerStats).delete().neq('player_name', '')

  const rows = Object.entries(statsMap).map(([name, s]) => ({
    player_name: name, ...s,
  }))

  if (rows.length > 0) {
    const { error } = await supabase.from(tables.playerStats).upsert(rows, { onConflict: 'player_name' })
    if (error) throw error
  }
}

export async function recalculateWinRate(season: number) {
  const tables = getTableNames(season)
  const yearStart = `${season}-01-01`
  const yearEnd = `${season + 1}-01-01`

  // Get completed internal matches
  let matchQuery = supabase.from(tables.matches).select('*')
    .eq('status', 'completed').eq('match_type', '内战')
  if (season === 2025) {
    matchQuery = matchQuery.gte('match_date', yearStart).lt('match_date', yearEnd)
  }
  const { data: matches } = await matchQuery
  if (!matches?.length) return

  const matchIds = matches.map((m: Match) => m.id)
  const { data: allPlayers } = await supabase
    .from(tables.matchPlayers).select('*').in('match_id', matchIds)

  // Get player types
  const { data: playersList } = await supabase.from('players').select('name, player_type')
  const playerTypeMap: Record<string, string> = {}
  if (playersList) {
    for (const p of playersList) {
      playerTypeMap[p.name] = p.player_type || 'regular'
    }
  }

  if (!allPlayers) return

  const matchMap = new Map(matches.map((m: Match) => [m.id, m]))
  const winrateMap: Record<string, {
    player_name: string; player_type: string
    total_matches: number; wins: number; draws: number; losses: number; win_rate: number
  }> = {}

  // Detect air-drop players: those who appear on both teams in the same match
  const playerMatchTeams: Record<string, Set<string>> = {}
  for (const mp of allPlayers as MatchPlayer[]) {
    const key = `${mp.match_id}_${mp.player_name}`
    if (!playerMatchTeams[key]) playerMatchTeams[key] = new Set()
    playerMatchTeams[key].add(mp.team)
  }
  const airDropKeys = new Set<string>()
  for (const [key, teams] of Object.entries(playerMatchTeams)) {
    if (teams.size > 1) airDropKeys.add(key)
  }

  for (const mp of allPlayers as MatchPlayer[]) {
    const match = matchMap.get(mp.match_id)
    if (!match) continue

    // Skip air-drop players entirely for win rate calculation
    const adKey = `${mp.match_id}_${mp.player_name}`
    if (airDropKeys.has(adKey)) continue

    const name = mp.player_name
    if (!winrateMap[name]) {
      winrateMap[name] = {
        player_name: name,
        player_type: playerTypeMap[name] || 'regular',
        total_matches: 0, wins: 0, draws: 0, losses: 0, win_rate: 0,
      }
    }

    const wr = winrateMap[name]
    wr.total_matches++

    const ws = match.white_score || 0
    const bs = match.blue_score || 0

    if (ws === bs) {
      wr.draws++
    } else if (
      (mp.team === 'white' && ws > bs) ||
      (mp.team === 'blue' && bs > ws)
    ) {
      wr.wins++
    } else {
      wr.losses++
    }
  }

  // Calculate win rates
  for (const wr of Object.values(winrateMap)) {
    if (wr.total_matches > 0) {
      wr.win_rate = parseFloat(((wr.wins / wr.total_matches) * 100).toFixed(2))
    }
  }

  // Update table
  await supabase.from(tables.playerWinrate).delete().neq('player_name', '')
  const rows = Object.values(winrateMap)
  if (rows.length > 0) {
    await supabase.from(tables.playerWinrate).insert(rows)
  }
}
