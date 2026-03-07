export interface Player {
  id: number
  name: string
  player_type: 'regular' | 'guest'
  is_active: boolean
  aliases: string[]
  created_at: string
}

export interface Match {
  id: string
  match_date: string
  match_time: string
  match_type: string
  venue: string
  white_score: number
  blue_score: number
  status: 'pending' | 'completed'
  created_at: string
  year_match_number: number | null
  match_number: number | null
  opponent_team: string | null
  white_own_goals: number
  blue_own_goals: number
}

export interface MatchPlayer {
  id: string | number
  match_id: string
  player_name: string
  team: 'white' | 'blue'
  is_airdrop?: boolean
  created_at: string
}

export interface MatchStat {
  id: string | number
  match_id: string
  player_name: string
  team: string
  goals: number
  assists: number
  created_at: string
}

export interface MatchCaptain {
  id: string | number
  match_id: string
  team: string
  captain_name: string
}

export interface PlayerStatRow {
  player_name: string
  attendance_total: number
  attendance_internal: number
  attendance_external: number
  goals_total: number
  goals_internal: number
  goals_external: number
  assists_total: number
  assists_internal: number
  assists_external: number
}

export interface WinRateRow {
  id: string | number
  player_name: string
  player_type: string
  total_matches: number
  wins: number
  draws: number
  losses: number
  win_rate: number
}

export interface ParsedRoster {
  date: string
  time: string
  venue: string
  matchType: string
  whiteTeam: string[]
  blueTeam: string[]
  whiteCaptain: string | null
  blueCaptain: string | null
  airDropPlayers: string[]
}

export interface ParsedGoalEvent {
  scorer: string
  assister: string | null
  team: 'white' | 'blue'
  isOwnGoal: boolean
}

export interface ParsedResult {
  whiteScore: number
  blueScore: number
  events: ParsedGoalEvent[]
  whiteOwnGoals: number
  blueOwnGoals: number
}
