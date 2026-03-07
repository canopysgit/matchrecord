import { useEffect, useState } from 'react'
import { supabase, getTableNames } from '../lib/supabase'
import type { Match, MatchPlayer, MatchStat, PlayerStatRow, WinRateRow } from '../lib/types'

type Tab = 'results' | 'stats' | 'winrate'

const archivedSeasons = [2025]

export default function Archive() {
  const [season, setSeason] = useState(2025)
  const [tab, setTab] = useState<Tab>('results')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">历史赛季</h1>
        <select
          value={season}
          onChange={e => setSeason(+e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {archivedSeasons.map(s => (
            <option key={s} value={s}>{s}赛季</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          ['results', '比赛结果'],
          ['stats', '球员统计'],
          ['winrate', '胜率统计'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              tab === key ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'results' && <ArchiveResults season={season} />}
      {tab === 'stats' && <ArchiveStats season={season} />}
      {tab === 'winrate' && <ArchiveWinRate season={season} />}
    </div>
  )
}

/* ─── Results Tab ─── */
function ArchiveResults({ season }: { season: number }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [playersMap, setPlayersMap] = useState<Record<string, MatchPlayer[]>>({})
  const [statsMap, setStatsMap] = useState<Record<string, MatchStat[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [season])

  async function loadData() {
    setLoading(true)
    const tables = getTableNames(season)
    const yearStart = `${season}-01-01`
    const yearEnd = `${season + 1}-01-01`

    const { data: matchData } = await supabase.from(tables.matches).select('*')
      .eq('status', 'completed')
      .gte('match_date', yearStart).lt('match_date', yearEnd)
      .order('match_date', { ascending: false })
    const allMatches = (matchData || []) as Match[]
    setMatches(allMatches)

    if (allMatches.length) {
      const ids = allMatches.map(m => m.id)
      const { data: players } = await supabase.from(tables.matchPlayers).select('*').in('match_id', ids)
      const { data: stats } = await supabase.from(tables.matchStats).select('*').in('match_id', ids)

      const pMap: Record<string, MatchPlayer[]> = {}
      const sMap: Record<string, MatchStat[]> = {}
      for (const p of (players || []) as MatchPlayer[]) {
        if (!pMap[p.match_id]) pMap[p.match_id] = []
        pMap[p.match_id].push(p)
      }
      for (const s of (stats || []) as MatchStat[]) {
        if (!sMap[s.match_id]) sMap[s.match_id] = []
        sMap[s.match_id].push(s)
      }
      setPlayersMap(pMap)
      setStatsMap(sMap)
    }
    setLoading(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{season}赛季共 {matches.length} 场比赛</p>
      {matches.map(match => {
        const mPlayers = playersMap[match.id] || []
        const mStats = statsMap[match.id] || []
        const whitePlayers = mPlayers.filter(p => p.team === 'white')
        const bluePlayers = mPlayers.filter(p => p.team === 'blue')
        const whiteStats = mStats.filter(s => s.team === 'white')
        const blueStats = mStats.filter(s => s.team === 'blue')

        return (
          <div key={match.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-gray-600 to-gray-800 text-white p-4">
              <div className="text-lg font-bold">{formatDate(match.match_date)}</div>
              <div className="text-sm text-gray-300 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>{match.match_time}</span>
                <span>{match.match_type}</span>
                <span>{match.venue}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-8 py-5 bg-gray-50">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">白队</div>
                <div className="text-3xl font-bold text-gray-700">{match.white_score}</div>
              </div>
              <div className="text-xl font-bold text-gray-400">VS</div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">蓝队</div>
                <div className="text-3xl font-bold text-gray-700">{match.blue_score}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50/50">
              <div>
                <h4 className="font-semibold text-gray-600 mb-2 text-sm">白队阵容</h4>
                <div className="flex flex-wrap gap-1.5">
                  {whitePlayers.map(p => (
                    <span key={p.id} className="bg-white px-3 py-1 rounded-full text-sm shadow-sm border">{p.player_name}</span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-600 mb-2 text-sm">蓝队阵容</h4>
                <div className="flex flex-wrap gap-1.5">
                  {bluePlayers.map(p => (
                    <span key={p.id} className="bg-white px-3 py-1 rounded-full text-sm shadow-sm border">{p.player_name}</span>
                  ))}
                </div>
              </div>
            </div>
            {(whiteStats.length > 0 || blueStats.length > 0) && (
              <div className="p-4 border-t">
                <h3 className="text-center font-semibold text-gray-600 mb-3">数据统计</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ArchiveTeamStats label="白队" stats={whiteStats} />
                  <ArchiveTeamStats label="蓝队" stats={blueStats} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ArchiveTeamStats({ label, stats }: { label: string; stats: MatchStat[] }) {
  const goals = stats.filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals)
  const assists = stats.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <h4 className="font-semibold text-gray-600 mb-2 text-sm">{label}数据</h4>
      <div className="space-y-2">
        <div>
          <div className="text-xs text-gray-500 mb-1">进球</div>
          {goals.length > 0 ? goals.map(s => (
            <div key={s.id} className="flex justify-between text-sm py-0.5">
              <span>{s.player_name}</span>
              <span className="text-gray-600 font-semibold">{s.goals}球</span>
            </div>
          )) : <div className="text-sm text-gray-400">无</div>}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">助攻</div>
          {assists.length > 0 ? assists.map(s => (
            <div key={s.id} className="flex justify-between text-sm py-0.5">
              <span>{s.player_name}</span>
              <span className="text-gray-600 font-semibold">{s.assists}次</span>
            </div>
          )) : <div className="text-sm text-gray-400">无</div>}
        </div>
      </div>
    </div>
  )
}

/* ─── Stats Tab ─── */
type ArchivePlayerFilter = 'regular' | 'guest' | 'all'

function ArchiveStats({ season }: { season: number }) {
  const [players, setPlayers] = useState<PlayerStatRow[]>([])
  const [guestNames, setGuestNames] = useState<Set<string>>(new Set())
  const [board, setBoard] = useState<'attendance' | 'goals' | 'assists'>('goals')
  const [playerFilter, setPlayerFilter] = useState<ArchivePlayerFilter>('regular')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [season])

  async function loadData() {
    setLoading(true)
    const tables = getTableNames(season)
    const [{ data }, { data: playersList }] = await Promise.all([
      supabase.from(tables.playerStats).select('*'),
      supabase.from('players').select('name, player_type'),
    ])
    const guests = new Set(
      (playersList || []).filter(p => p.player_type === 'guest').map(p => p.name)
    )
    setGuestNames(guests)
    setPlayers((data || []) as PlayerStatRow[])
    setLoading(false)
  }

  const getValue = (p: PlayerStatRow) => {
    const key = `${board}_total` as keyof PlayerStatRow
    return (p[key] as number) || 0
  }

  const filtered = players.filter(p => {
    if (playerFilter === 'regular') return !guestNames.has(p.player_name)
    if (playerFilter === 'guest') return guestNames.has(p.player_name)
    return true
  })

  const sorted = [...filtered]
    .filter(p => getValue(p) > 0)
    .sort((a, b) => getValue(b) - getValue(a))

  const boardLabels = { attendance: '出勤榜', goals: '射手榜', assists: '助攻榜' }
  const unitLabels = { attendance: '场', goals: '球', assists: '次' }

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(boardLabels) as (keyof typeof boardLabels)[]).map(b => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              board === b ? 'bg-gray-700 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {boardLabels[b]}
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {([['regular', '主力'], ['guest', '外援'], ['all', '全部']] as [ArchivePlayerFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPlayerFilter(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              playerFilter === key ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_80px] bg-gray-50 border-b">
          <div className="px-3 py-3 text-xs font-semibold text-gray-500">排名</div>
          <div className="px-3 py-3 text-xs font-semibold text-gray-500">球员</div>
          <div className="px-3 py-3 text-xs font-semibold text-gray-500 text-center">{boardLabels[board]}</div>
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-400">暂无数据</div>
        )}
        {sorted.map((p, i) => (
          <div key={p.player_name} className="grid grid-cols-[60px_1fr_80px] border-b last:border-0 hover:bg-gray-50 transition">
            <div className="px-3 py-3 text-sm font-medium text-gray-400">{i + 1}</div>
            <div className="px-3 py-3 text-sm font-medium text-gray-800">{p.player_name}</div>
            <div className="px-3 py-3 text-sm text-center font-semibold text-gray-700">
              {getValue(p)}{unitLabels[board]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Win Rate Tab ─── */
function ArchiveWinRate({ season }: { season: number }) {
  const [data, setData] = useState<WinRateRow[]>([])
  const [playerType, setPlayerType] = useState<'all' | 'regular' | 'guest'>('regular')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [season])

  async function loadData() {
    setLoading(true)
    const tables = getTableNames(season)
    const { data: rows } = await supabase.from(tables.playerWinrate).select('*')
    setData((rows || []) as WinRateRow[])
    setLoading(false)
  }

  const sorted = [...data]
    .filter(p => playerType === 'all' || p.player_type === playerType)
    .sort((a, b) => b.win_rate - a.win_rate)

  const winRateClass = (rate: number) =>
    rate >= 60 ? 'text-green-600' : rate >= 40 ? 'text-amber-500' : 'text-red-500'

  if (loading) return <div className="text-center py-12 text-gray-500">加载中...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center items-center gap-2">
        <p className="text-sm text-gray-500">仅统计内战数据</p>
        <span className="text-gray-300 mx-1">|</span>
        {([['regular', '主力'], ['guest', '外援'], ['all', '全部']] as ['regular' | 'guest' | 'all', string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPlayerType(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              playerType === key ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[50px_1fr_70px_70px_70px_70px_90px] bg-gray-700 text-white text-sm font-medium">
          <div className="px-3 py-3">排名</div>
          <div className="px-3 py-3">球员</div>
          <div className="px-3 py-3 text-center">场次</div>
          <div className="px-3 py-3 text-center">胜</div>
          <div className="px-3 py-3 text-center">平</div>
          <div className="px-3 py-3 text-center">负</div>
          <div className="px-3 py-3 text-center">胜率</div>
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-400">无符合条件的数据</div>
        )}
        {sorted.map((p, i) => (
          <div key={p.player_name}
            className={`grid grid-cols-[50px_1fr_70px_70px_70px_70px_90px] text-sm border-b last:border-0 ${
              i % 2 === 1 ? 'bg-gray-50' : ''
            }`}>
            <div className="px-3 py-3 font-bold text-gray-500">{i + 1}</div>
            <div className="px-3 py-3 font-medium">{p.player_name}</div>
            <div className="px-3 py-3 text-center">{p.total_matches}</div>
            <div className="px-3 py-3 text-center">{p.wins}</div>
            <div className="px-3 py-3 text-center">{p.draws}</div>
            <div className="px-3 py-3 text-center">{p.losses}</div>
            <div className={`px-3 py-3 text-center font-bold ${winRateClass(p.win_rate)}`}>{p.win_rate}%</div>
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {sorted.map((p, i) => (
          <div key={p.player_name} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-gray-400">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">{i + 1}</span>
              <span className="font-bold text-gray-800">{p.player_name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                <div className="text-xs text-gray-500">胜率</div>
                <div className={`text-lg font-bold ${winRateClass(p.win_rate)}`}>{p.win_rate}%</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">总场次</div>
                <div className="text-lg font-bold">{p.total_matches}</div>
              </div>
            </div>
            <div className="flex justify-around bg-gray-50 rounded-lg p-2 text-center">
              <div><div className="text-xs text-gray-500">胜</div><div className="font-bold">{p.wins}</div></div>
              <div><div className="text-xs text-gray-500">平</div><div className="font-bold">{p.draws}</div></div>
              <div><div className="text-xs text-gray-500">负</div><div className="font-bold">{p.losses}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
