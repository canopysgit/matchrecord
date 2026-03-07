import { useEffect, useState } from 'react'
import { supabase, getTableNames } from '../lib/supabase'
import { useSeason } from '../contexts/SeasonContext'
import type { WinRateRow } from '../lib/types'

type SortField = 'win_rate' | 'total_matches' | 'wins'

export default function WinRate() {
  const { season } = useSeason()
  const [data, setData] = useState<WinRateRow[]>([])
  const [minMatches, setMinMatches] = useState(3)
  const [playerType, setPlayerType] = useState<'all' | 'regular' | 'guest'>('regular')
  const [sortField, setSortField] = useState<SortField>('win_rate')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [season])

  async function loadData() {
    setLoading(true)
    const tables = getTableNames(season)
    const { data: rows } = await supabase.from(tables.playerWinrate).select('*')
    setData((rows || []) as WinRateRow[])
    setLoading(false)
  }

  const filtered = data
    .filter(p => p.total_matches >= minMatches)
    .filter(p => playerType === 'all' || p.player_type === playerType)
    .sort((a, b) => {
      const va = a[sortField] as number
      const vb = b[sortField] as number
      return sortDir === 'desc' ? vb - va : va - vb
    })

  const totalPlayers = data.length
  const totalInternal = data.reduce((max, p) => Math.max(max, p.total_matches), 0)

  const winRateClass = (rate: number) =>
    rate >= 60 ? 'text-green-600' : rate >= 40 ? 'text-amber-500' : 'text-red-500'

  if (loading) return <div className="text-center py-20 text-gray-500">加载中...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">{season}年球员胜率统计</h1>
        <p className="text-gray-500 text-sm mt-1">仅统计内战数据</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="参赛球员" value={totalPlayers} />
        <SummaryCard label="主力球员" value={data.filter(p => p.player_type === 'regular').length} />
        <SummaryCard label="外援" value={data.filter(p => p.player_type === 'guest').length} />
        <SummaryCard label="最高出场" value={totalInternal} suffix="场" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
        <label className="text-sm text-gray-600">最少场次:</label>
        <select value={minMatches} onChange={e => setMinMatches(+e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm">
          <option value={0}>不限</option>
          <option value={3}>3场+</option>
          <option value={5}>5场+</option>
          <option value={10}>10场+</option>
        </select>
        <label className="text-sm text-gray-600">类型:</label>
        <select value={playerType} onChange={e => setPlayerType(e.target.value as typeof playerType)}
          className="px-3 py-1.5 border rounded-lg text-sm">
          <option value="all">全部</option>
          <option value="regular">主力</option>
          <option value="guest">外援</option>
        </select>
        <label className="text-sm text-gray-600">排序:</label>
        <select value={`${sortField}_${sortDir}`} onChange={e => {
          const [f, d] = e.target.value.split('_') as [SortField, 'desc' | 'asc']
          setSortField(f); setSortDir(d)
        }} className="px-3 py-1.5 border rounded-lg text-sm">
          <option value="win_rate_desc">胜率 高→低</option>
          <option value="win_rate_asc">胜率 低→高</option>
          <option value="total_matches_desc">场次 多→少</option>
          <option value="wins_desc">胜场 多→少</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[50px_1fr_70px_70px_70px_70px_90px_80px] bg-gray-700 text-white text-sm font-medium">
          <div className="px-3 py-3">排名</div>
          <div className="px-3 py-3">球员</div>
          <div className="px-3 py-3 text-center">总场次</div>
          <div className="px-3 py-3 text-center">胜</div>
          <div className="px-3 py-3 text-center">平</div>
          <div className="px-3 py-3 text-center">负</div>
          <div className="px-3 py-3 text-center">胜率</div>
          <div className="px-3 py-3 text-center">类型</div>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">无符合条件的数据</div>
        )}
        {filtered.map((p, i) => (
          <div key={p.player_name}
            className={`grid grid-cols-[50px_1fr_70px_70px_70px_70px_90px_80px] text-sm border-b last:border-0 hover:bg-blue-50 transition ${
              i % 2 === 1 ? 'bg-gray-50' : ''
            }`}>
            <div className="px-3 py-3 font-bold text-gray-500">{i + 1}</div>
            <div className="px-3 py-3 font-medium">{p.player_name}</div>
            <div className="px-3 py-3 text-center">{p.total_matches}</div>
            <div className="px-3 py-3 text-center">{p.wins}</div>
            <div className="px-3 py-3 text-center">{p.draws}</div>
            <div className="px-3 py-3 text-center">{p.losses}</div>
            <div className={`px-3 py-3 text-center font-bold ${winRateClass(p.win_rate)}`}>{p.win_rate}%</div>
            <div className="px-3 py-3 text-center">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                p.player_type === 'regular' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {p.player_type === 'regular' ? '主力' : '外援'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((p, i) => (
          <div key={p.player_name} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">{i + 1}</span>
                <span className="font-bold text-gray-800">{p.player_name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                p.player_type === 'regular' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {p.player_type === 'regular' ? '主力' : '外援'}
              </span>
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

function SummaryCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-blue-600 mt-1">{value}{suffix}</div>
    </div>
  )
}
