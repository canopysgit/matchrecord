import { useEffect, useState } from 'react'
import { supabase, getTableNames } from '../lib/supabase'
import { useSeason } from '../contexts/SeasonContext'
import { useAuth } from '../contexts/AuthContext'
import { Trash2 } from 'lucide-react'
import type { Match, MatchPlayer, MatchStat, MatchCaptain } from '../lib/types'

export default function Results() {
  const { season } = useSeason()
  const { session } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [playersMap, setPlayersMap] = useState<Record<string, MatchPlayer[]>>({})
  const [statsMap, setStatsMap] = useState<Record<string, MatchStat[]>>({})
  const [captainsMap, setCaptainsMap] = useState<Record<string, MatchCaptain[]>>({})
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [season])

  async function loadData() {
    setLoading(true)
    const tables = getTableNames(season)
    const yearStart = `${season}-01-01`
    const yearEnd = `${season + 1}-01-01`

    let q = supabase.from(tables.matches).select('*')
      .eq('status', 'completed').order('match_date', { ascending: false })
    if (season === 2025) {
      q = q.gte('match_date', yearStart).lt('match_date', yearEnd)
    }
    const { data: matchData } = await q
    const allMatches = (matchData || []) as Match[]
    setMatches(allMatches)

    if (allMatches.length) {
      const ids = allMatches.map(m => m.id)
      const { data: players } = await supabase.from(tables.matchPlayers).select('*').in('match_id', ids)
      const { data: stats } = await supabase.from(tables.matchStats).select('*').in('match_id', ids)
      const { data: captains } = await supabase.from(tables.matchCaptains).select('*').in('match_id', ids)

      const pMap: Record<string, MatchPlayer[]> = {}
      const sMap: Record<string, MatchStat[]> = {}
      const cMap: Record<string, MatchCaptain[]> = {}
      for (const p of (players || []) as MatchPlayer[]) {
        if (!pMap[p.match_id]) pMap[p.match_id] = []
        pMap[p.match_id].push(p)
      }
      for (const s of (stats || []) as MatchStat[]) {
        if (!sMap[s.match_id]) sMap[s.match_id] = []
        sMap[s.match_id].push(s)
      }
      for (const c of (captains || []) as MatchCaptain[]) {
        if (!cMap[c.match_id]) cMap[c.match_id] = []
        cMap[c.match_id].push(c)
      }
      setPlayersMap(pMap)
      setStatsMap(sMap)
      setCaptainsMap(cMap)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const tables = getTableNames(season)
    await supabase.from(tables.matchStats).delete().eq('match_id', deleteId)
    await supabase.from(tables.matchPlayers).delete().eq('match_id', deleteId)
    await supabase.from(tables.matchCaptains).delete().eq('match_id', deleteId)
    await supabase.from(tables.matches).delete().eq('id', deleteId)
    setDeleteId(null)
    loadData()
  }

  if (loading) return <div className="text-center py-20 text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{season}年比赛结果</h1>
      {matches.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl">暂无比赛记录</div>
      )}
      {matches.map((match, idx) => {
        const mPlayers = playersMap[match.id] || []
        const mStats = statsMap[match.id] || []
        const mCaptains = captainsMap[match.id] || []
        const whitePlayers = mPlayers.filter(p => p.team === 'white')
        const bluePlayers = mPlayers.filter(p => p.team === 'blue')
        const whiteStats = mStats.filter(s => s.team === 'white')
        const blueStats = mStats.filter(s => s.team === 'blue')
        const whiteCaptain = mCaptains.find(c => c.team === 'white')?.captain_name
        const blueCaptain = mCaptains.find(c => c.team === 'blue')?.captain_name

        return (
          <div key={match.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">{formatDate(match.match_date)}</div>
                  <div className="text-sm text-blue-200 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{match.year_match_number ? `${season}年第${match.year_match_number}场` : `第${matches.length - idx}场`}</span>
                    <span>{match.match_time}</span>
                    <span>{match.match_type}</span>
                    <span>{match.venue}</span>
                  </div>
                </div>
                {session && (
                  <button
                    onClick={() => setDeleteId(match.id)}
                    className="p-2 hover:bg-white/20 rounded-lg transition"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center justify-center gap-8 py-6 bg-gray-50">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">白队</div>
                <div className="text-4xl font-bold text-blue-600">{match.white_score}</div>
                {whiteCaptain && <div className="text-xs text-gray-400 mt-1">队长: {whiteCaptain}</div>}
              </div>
              <div className="text-xl font-bold text-gray-400">VS</div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">蓝队</div>
                <div className="text-4xl font-bold text-blue-600">{match.blue_score}</div>
                {blueCaptain && <div className="text-xs text-gray-400 mt-1">队长: {blueCaptain}</div>}
              </div>
            </div>

            {/* Players */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50/50">
              <TeamRoster label="白队阵容" players={whitePlayers} captain={whiteCaptain} />
              <TeamRoster label="蓝队阵容" players={bluePlayers} captain={blueCaptain} />
            </div>

            {/* Stats */}
            {(whiteStats.length > 0 || blueStats.length > 0) && (
              <div className="p-4 border-t">
                <h3 className="text-center font-semibold text-blue-600 mb-3">数据统计</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamStats label="白队" stats={whiteStats} />
                  <TeamStats label="蓝队" stats={blueStats} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">确认删除</h3>
            <p className="text-gray-600 mb-4">确定要删除这场比赛记录吗？此操作不可恢复。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamRoster({ label, players, captain }: { label: string; players: MatchPlayer[]; captain?: string }) {
  const sorted = [...players].sort((a, b) => {
    if (a.player_name === captain) return -1
    if (b.player_name === captain) return 1
    return 0
  })
  return (
    <div>
      <h4 className="font-semibold text-blue-600 mb-2 text-sm">{label}</h4>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(p => (
          <span key={p.id} className={`px-3 py-1 rounded-full text-sm shadow-sm border ${
            captain === p.player_name ? 'bg-amber-50 border-amber-300 font-semibold' : 'bg-white'
          }`}>
            {captain === p.player_name && <span className="text-amber-500 font-bold text-xs mr-1">C</span>}
            {p.player_name}
          </span>
        ))}
      </div>
    </div>
  )
}

function TeamStats({ label, stats }: { label: string; stats: MatchStat[] }) {
  const goals = stats.filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals)
  const assists = stats.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists)
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <h4 className="font-semibold text-blue-600 mb-2 text-sm">{label}数据</h4>
      <div className="space-y-2">
        <div>
          <div className="text-xs text-gray-500 mb-1">进球</div>
          {goals.length > 0 ? goals.map(s => (
            <div key={s.id} className="flex justify-between text-sm py-0.5">
              <span>{s.player_name}</span>
              <span className="text-blue-600 font-semibold">{s.goals}球</span>
            </div>
          )) : <div className="text-sm text-gray-400">无</div>}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">助攻</div>
          {assists.length > 0 ? assists.map(s => (
            <div key={s.id} className="flex justify-between text-sm py-0.5">
              <span>{s.player_name}</span>
              <span className="text-blue-600 font-semibold">{s.assists}次</span>
            </div>
          )) : <div className="text-sm text-gray-400">无</div>}
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
