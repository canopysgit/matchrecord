import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://obidukxlcgecpooynqnz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWR1a3hsY2dlY3Bvb3lucW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNjAyMDgsImV4cCI6MjA0OTgzNjIwOH0.a4Y-nWWxb8ClbMO2BUXG2vTJMqTJe2rQAXdWyKHZlHs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export function getTableNames(season: number) {
  if (season === 2025) {
    return {
      matches: 'matches',
      matchPlayers: 'match_players',
      matchStats: 'match_stats',
      matchCaptains: 'match_captains',
      playerStats: 'regular_player_stats_2025',
      playerWinrate: 'player_winrate_2025',
    }
  }
  return {
    matches: 'matches_2026',
    matchPlayers: 'match_players_2026',
    matchStats: 'match_stats_2026',
    matchCaptains: 'match_captains_2026',
    playerStats: 'player_stats_2026',
    playerWinrate: 'player_winrate_2026',
  }
}
