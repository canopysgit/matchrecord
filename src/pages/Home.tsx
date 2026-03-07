import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, getTableNames } from '../lib/supabase'
import { useSeason } from '../contexts/SeasonContext'
import { Target, Handshake, Users, TrendingUp } from 'lucide-react'
import type { Match, PlayerStatRow, WinRateRow } from '../lib/types'

export default function Home() {
  const { season } = useSeason()
  const [latestMatch, setLatestMatch] = useState<Match | null>(null)
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
      if (matches?.length) setLatestMatch(matches[0] as Match)
      else setLatestMatch(null)

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
      {latestMatch && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg">
          <div className="text-sm text-blue-200 mb-2">最新比赛</div>
          <div className="text-sm text-blue-200 mb-4">
            {formatDate(latestMatch.match_date)} | {latestMatch.match_time} | {latestMatch.venue} | {latestMatch.match_type}
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-lg font-medium">白队</div>
              <div className="text-4xl font-bold mt-1">{latestMatch.white_score}</div>
            </div>
            <div className="text-2xl font-bold text-blue-300">VS</div>
            <div className="text-center">
              <div className="text-lg font-medium">蓝队</div>
              <div className="text-4xl font-bold mt-1">{latestMatch.blue_score}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top 5 boards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <RankCard title="出勤榜 TOP5" icon={<Users className="w-5 h-5" />} link="/stats">
          {topAttendance.map((p, i) => (
            <RankRow key={p.player_name} rank={i + 1} name={p.player_name} value={`${p.attendance_total}场`} />
          ))}
          {topAttendance.length === 0 && <EmptyRank />}
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
