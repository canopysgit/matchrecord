import { useEffect, useState } from 'react'
import { supabase, getTableNames } from '../lib/supabase'
import { useSeason } from '../contexts/SeasonContext'
import type { PlayerStatRow } from '../lib/types'

type Board = 'attendance' | 'goals' | 'assists'
type SubType = 'total' | 'internal' | 'external'

type PlayerFilter = 'regular' | 'guest' | 'all'

export default function Stats() {
  const { season } = useSeason()
  const [allPlayers, setAllPlayers] = useState<PlayerStatRow[]>([])
  const [guestNames, setGuestNames] = useState<Set<string>>(new Set())
  const [board, setBoard] = useState<Board>('attendance')
  const [subType, setSubType] = useState<SubType>('total')
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('regular')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
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
    setAllPlayers((data || []) as PlayerStatRow[])
    setLoading(false)
  }

  const getValue = (p: PlayerStatRow) => {
    const key = `${board}_${subType}` as keyof PlayerStatRow
    return (p[key] as number) || 0
  }

  const filtered = allPlayers.filter(p => {
    if (playerFilter === 'regular') return !guestNames.has(p.player_name)
    if (playerFilter === 'guest') return guestNames.has(p.player_name)
    return true
  })

  const sorted = [...filtered]
    .filter(p => getValue(p) > 0 || board === 'attendance')
    .sort((a, b) => sortDir === 'desc' ? getValue(b) - getValue(a) : getValue(a) - getValue(b))

  const boardLabels: Record<Board, string> = { attendance: '出勤榜', goals: '射手榜', assists: '助攻榜' }
  const subLabels: Record<SubType, string> = { total: '总计', internal: '内战', external: '外战' }
  const unitLabels: Record<Board, string> = { attendance: '场', goals: '球', assists: '次' }

  if (loading) return <div className="text-center py-20 text-gray-500">加载中...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">{season}年数据统计</h1>

      {/* Board tabs */}
      <div className="flex justify-center gap-2">
        {(Object.keys(boardLabels) as Board[]).map(b => (
          <button
            key={b}
            onClick={() => { setBoard(b); setSortDir('desc') }}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              board === b ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {boardLabels[b]}
          </button>
        ))}
      </div>

      {/* Sub-type tabs + player filter */}
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(subLabels) as SubType[]).map(st => (
          <button
            key={st}
            onClick={() => setSubType(st)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              subType === st ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {subLabels[st]}
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {([['regular', '主力'], ['guest', '外援'], ['all', '全部']] as [PlayerFilter, string][]).map(([key, label]) => (
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_80px_80px_80px] bg-gray-50 border-b">
          <div className="px-3 py-3 text-xs font-semibold text-gray-500">排名</div>
          <div className="px-3 py-3 text-xs font-semibold text-gray-500">球员</div>
          {(Object.keys(subLabels) as SubType[]).map(st => (
            <button
              key={st}
              onClick={() => { setSubType(st); setSortDir(subType === st && sortDir === 'desc' ? 'asc' : 'desc') }}
              className={`px-3 py-3 text-xs font-semibold text-center cursor-pointer hover:text-blue-600 ${
                subType === st ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {subLabels[st]} {subType === st && (sortDir === 'desc' ? '↓' : '↑')}
            </button>
          ))}
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-400">暂无数据</div>
        )}
        {sorted.map((p, i) => (
          <div key={p.player_name} className="grid grid-cols-[60px_1fr_80px_80px_80px] border-b last:border-0 hover:bg-gray-50 transition">
            <div className="px-3 py-3 text-sm font-medium text-gray-400">{i + 1}</div>
            <div className="px-3 py-3 text-sm font-medium text-gray-800">{p.player_name}</div>
            <div className="px-3 py-3 text-sm text-center font-semibold text-blue-600">
              {p[`${board}_total` as keyof PlayerStatRow] as number}{unitLabels[board]}
            </div>
            <div className="px-3 py-3 text-sm text-center text-gray-600">
              {p[`${board}_internal` as keyof PlayerStatRow] as number}
            </div>
            <div className="px-3 py-3 text-sm text-center text-gray-600">
              {p[`${board}_external` as keyof PlayerStatRow] as number}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
