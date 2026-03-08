import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, getTableNames } from '../lib/supabase'
import { useSeason } from '../contexts/SeasonContext'
import { Target, Handshake, Users, TrendingUp } from 'lucide-react'
import type { Match, MatchPlayer, MatchStat, MatchCaptain, PlayerStatRow, WinRateRow } from '../lib/types'

export default function Home() {
  const { season } = useSeason()
  const [latestMatch, setLatestMatch] = useState<Match | null>(null)
  const [latestPlayers, setLatestPlayers] = useState<MatchPlayer[]>([])
  const [latestStats, setLatestStats] = useState<MatchStat[]>([])
  const [latestCaptains, setLatestCaptains] = useState<MatchCaptain[]>([])
  const [topScorers, setTopScorers] = useState<PlayerStatRow[]>([])
  const [topAssists, setTopAssists] = useState<PlayerStatRow[]>([])
  const [topAttendance, setTopAttendance] = useState<PlayerStatRow[]>([])
  const [topWinRate, setTopWinRate] = useState<WinRateRow[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [season])

  async function loadData() {
    setLoading(true)
    const tables = getTableNames(season)

    try {
      // Latest match
      const yearStart = `${season}-01-01`
      const yearEnd = `${season + 1}-01-01`
      let matchQ = supabase.from(tables.matches).select('*')
        .eq('status', 'completed').order('match_date', { ascending: false }).limit(1)
      if (season === 2025) {
        matchQ = matchQ.gte('match_date', yearStart).lt('match_date', yearEnd)
      }
      const { data: matches } = await matchQ
      if (matches?.length) {
        const match = matches[0] as Match
        setLatestMatch(match)
        // Load players, stats, captains for the latest match
        const [{ data: mp }, { data: ms }, { data: mc }] = await Promise.all([
          supabase.from(tables.matchPlayers).select('*').eq('match_id', match.id),
          supabase.from(tables.matchStats).select('*').eq('match_id', match.id),
          supabase.from(tables.matchCaptains).select('*').eq('match_id', match.id),
        ])
        setLatestPlayers((mp || []) as MatchPlayer[])
        setLatestStats((ms || []) as MatchStat[])
        setLatestCaptains((mc || []) as MatchCaptain[])
      } else {
        setLatestMatch(null)
        setLatestPlayers([])
        setLatestStats([])
        setLatestCaptains([])
      }

      // Match count
      let countQ = supabase.from(tables.matches).select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
      if (season === 2025) {
        countQ = countQ.gte('match_date', yearStart).lt('match_date', yearEnd)
      }
      const { count } = await countQ
      setMatchCount(count || 0)

      // Player stats + player types for filtering
      const [{ data: stats }, { data: playersList }] = await Promise.all([
        supabase.from(tables.playerStats).select('*'),
        supabase.from('players').select('name, player_type'),
      ])
      const guestNames = new Set(
        (playersList || []).filter(p => p.player_type === 'guest').map(p => p.name)
      )
      if (stats?.length) {
        const sorted = stats as PlayerStatRow[]
        const regularsOnly = sorted.filter(p => !guestNames.has(p.player_name))
        setTopScorers([...regularsOnly].sort((a, b) => b.goals_total - a.goals_total).slice(0, 5))
        setTopAssists([...regularsOnly].sort((a, b) => b.assists_total - a.assists_total).slice(0, 5))
        setTopAttendance([...regularsOnly].sort((a, b) => b.attendance_total - a.attendance_total).slice(0, 5))
      } else {
        setTopScorers([])
        setTopAssists([])
        setTopAttendance([])
      }

      // Win rate (only regular players on homepage)
      const { data: winrate } = await supabase.from(tables.playerWinrate).select('*')
        .eq('player_type', 'regular')
        .gte('total_matches', 3)
        .order('win_rate', { ascending: false }).limit(5)
      setTopWinRate((winrate as WinRateRow[]) || [])
    } catch (err) {
      console.error('Failed to load home data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* Season header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">{season}赛季</h1>
        <p className="text-gray-500 mt-1">已完成 {matchCount} 场比赛</p>
      </div>

      {/* Latest match card */}
      {latestMatch && (() => {
        const whitePlayers = latestPlayers.filter(p => p.team === 'white')
        const bluePlayers = latestPlayers.filter(p => p.team === 'blue')
        const whiteStats = latestStats.filter(s => s.team === 'white')
        const blueStats = latestStats.filter(s => s.team === 'blue')
        const whiteCaptain = latestCaptains.find(c => c.team === 'white')?.captain_name
        const blueCaptain = latestCaptains.find(c => c.team === 'blue')?.captain_name

        const sortRoster = (players: MatchPlayer[], captain?: string) =>
          [...players].sort((a, b) => {
            if (a.player_name === captain) return -1
            if (b.player_name === captain) return 1
            return 0
          })

        const renderGoals = (stats: MatchStat[], score: number) => {
          const regularStats = stats.filter(s => !s.player_name.startsWith('OG:'))
          const ogStats = stats.filter(s => s.player_name.startsWith('OG:'))
          const goals = regularStats.filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals)
          const recordedGoals = goals.reduce((sum, s) => sum + s.goals, 0) + ogStats.reduce((sum, s) => sum + s.goals, 0)
          const ownGoalsDiff = score - recordedGoals
          return (
            <>
              {goals.map(s => (
                <span key={s.id} className="text-xs text-blue-100">{s.player_name} {s.goals}球</span>
              ))}
              {ogStats.map(s => (
                <span key={s.id} className="text-xs text-orange-300">乌龙球({s.player_name.replace('OG:', '')}) {s.goals}球</span>
              ))}
              {ownGoalsDiff > 0 && ogStats.length === 0 && (
                <span className="text-xs text-orange-300">乌龙球 {ownGoalsDiff}球</span>
              )}
            </>
          )
        }

        const renderAssists = (stats: MatchStat[]) => {
          const regularStats = stats.filter(s => !s.player_name.startsWith('OG:'))
          const assists = regularStats.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)
          return assists.map(s => (
            <span key={s.id} className="text-xs text-blue-100">{s.player_name} {s.assists}次</span>
          ))
        }

        return (
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl text-white shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="text-sm text-blue-200 mb-2">最新比赛</div>
              <div className="text-sm text-blue-200 mb-4">
                {formatDate(latestMatch.match_date)} | {latestMatch.match_time} | {latestMatch.venue} | {latestMatch.match_type}
              </div>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-lg font-medium">白队</div>
                  <div className="text-4xl font-bold mt-1">{latestMatch.white_score}</div>
                  {whiteCaptain && <div className="text-xs text-blue-300 mt-1">队长: {whiteCaptain}</div>}
                </div>
                <div className="text-2xl font-bold text-blue-300">VS</div>
                <div className="text-center">
                  <div className="text-lg font-medium">蓝队</div>
                  <div className="text-4xl font-bold mt-1">{latestMatch.blue_score}</div>
                  {blueCaptain && <div className="text-xs text-blue-300 mt-1">队长: {blueCaptain}</div>}
                </div>
              </div>
            </div>

            {/* Divider: 阵容 */}
            <div className="flex items-center gap-3 px-6">
              <div className="flex-1 h-px bg-blue-500/50" />
              <span className="text-xs text-blue-300">阵容</span>
              <div className="flex-1 h-px bg-blue-500/50" />
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 py-4">
              <div>
                <div className="text-xs text-blue-300 mb-1.5">白队 ({whitePlayers.length}人)</div>
                <div className="flex flex-wrap gap-1">
                  {sortRoster(whitePlayers, whiteCaptain).map(p => (
                    <span key={p.id} className={`px-2 py-0.5 rounded-full text-xs ${
                      p.player_name === whiteCaptain ? 'bg-amber-500/30 text-amber-200 font-semibold' : 'bg-white/15 text-blue-100'
                    }`}>
                      {p.player_name === whiteCaptain && <span className="text-amber-300 font-bold mr-0.5">C</span>}
                      {p.player_name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-300 mb-1.5">蓝队 ({bluePlayers.length}人)</div>
                <div className="flex flex-wrap gap-1">
                  {sortRoster(bluePlayers, blueCaptain).map(p => (
                    <span key={p.id} className={`px-2 py-0.5 rounded-full text-xs ${
                      p.player_name === blueCaptain ? 'bg-amber-500/30 text-amber-200 font-semibold' : 'bg-white/15 text-blue-100'
                    }`}>
                      {p.player_name === blueCaptain && <span className="text-amber-300 font-bold mr-0.5">C</span>}
                      {p.player_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            {(whiteStats.length > 0 || blueStats.length > 0) && (
              <>
                <div className="flex items-center gap-3 px-6">
                  <div className="flex-1 h-px bg-blue-500/50" />
                  <span className="text-xs text-blue-300">数据</span>
                  <div className="flex-1 h-px bg-blue-500/50" />
                </div>
                <div className="grid grid-cols-2 gap-4 px-6 py-4">
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-blue-300 mb-1">进球</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {renderGoals(whiteStats, latestMatch.white_score)}
                      </div>
                    </div>
                    {renderAssists(whiteStats).length > 0 && (
                      <div>
                        <div className="text-xs text-blue-300 mb-1">助攻</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {renderAssists(whiteStats)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-blue-300 mb-1">进球</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {renderGoals(blueStats, latestMatch.blue_score)}
                      </div>
                    </div>
                    {renderAssists(blueStats).length > 0 && (
                      <div>
                        <div className="text-xs text-blue-300 mb-1">助攻</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {renderAssists(blueStats)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Top 5 boards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankCard title="出勤榜 TOP5" icon={<Users className="w-5 h-5" />} link="/stats">
          {topAttendance.map((p, i) => (
            <RankRow key={p.player_name} rank={i + 1} name={p.player_name} value={`${p.attendance_total}场`} />
          ))}
          {topAttendance.length === 0 && <EmptyRank />}
        </RankCard>

        <RankCard title="射手榜 TOP5" icon={<Target className="w-5 h-5" />} link="/stats">
          {topScorers.map((p, i) => (
            <RankRow key={p.player_name} rank={i + 1} name={p.player_name} value={`${p.goals_total}球`} />
          ))}
          {topScorers.length === 0 && <EmptyRank />}
        </RankCard>

        <RankCard title="助攻榜 TOP5" icon={<Handshake className="w-5 h-5" />} link="/stats">
          {topAssists.map((p, i) => (
            <RankRow key={p.player_name} rank={i + 1} name={p.player_name} value={`${p.assists_total}次`} />
          ))}
          {topAssists.length === 0 && <EmptyRank />}
        </RankCard>

        <RankCard title="胜率榜 TOP5（3场以上）" icon={<TrendingUp className="w-5 h-5" />} link="/winrate">
          {topWinRate.map((p, i) => (
            <RankRow key={p.player_name} rank={i + 1} name={p.player_name} value={`${p.win_rate}%`} />
          ))}
          {topWinRate.length === 0 && <EmptyRank />}
        </RankCard>
      </div>
    </div>
  )
}

function RankCard({ title, icon, link, children }: {
  title: string; icon: React.ReactNode; link: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          {icon} {title}
        </div>
        <Link to={link} className="text-sm text-blue-600 hover:text-blue-800">查看全部</Link>
      </div>
      <div className="divide-y divide-gray-100">
        {children}
      </div>
    </div>
  )
}

function RankRow({ rank, name, value }: { rank: number; name: string; value: string }) {
  const rankColors = ['', 'text-amber-500', 'text-gray-400', 'text-amber-700']
  return (
    <div className="flex items-center px-4 py-2.5">
      <span className={`w-8 font-bold ${rankColors[rank] || 'text-gray-400'}`}>{rank}</span>
      <span className="flex-1 font-medium text-gray-700">{name}</span>
      <span className="font-semibold text-blue-600">{value}</span>
    </div>
  )
}

function EmptyRank() {
  return <div className="text-center py-6 text-gray-400 text-sm">暂无数据</div>
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
