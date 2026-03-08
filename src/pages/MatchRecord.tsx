import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getTableNames } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSeason } from '../contexts/SeasonContext'
import { parseResultText } from '../lib/kimi'
import { buildAliasMap } from '../lib/playerMatcher'
import { recalculateStats, recalculateWinRate } from '../lib/statsCalculator'
import { Sparkles, AlertCircle, Check, Edit3, UserPlus } from 'lucide-react'
import type { Match, MatchPlayer, Player, ParsedGoalEvent } from '../lib/types'

export default function MatchRecord() {
  const { session } = useAuth()
  const { season } = useSeason()
  const navigate = useNavigate()
  const [pendingMatches, setPendingMatches] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])

  // AI input
  const [rawText, setRawText] = useState('')
  const [parsing, setParsing] = useState(false)

  // Parsed result
  const [whiteScore, setWhiteScore] = useState(0)
  const [blueScore, setBlueScore] = useState(0)
  const [whiteOwnGoals, setWhiteOwnGoals] = useState(0)
  const [blueOwnGoals, setBlueOwnGoals] = useState(0)
  const [events, setEvents] = useState<ParsedGoalEvent[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Roster editing
  const [editingRoster, setEditingRoster] = useState(false)
  const [editWhiteTeam, setEditWhiteTeam] = useState<string[]>([])
  const [editBlueTeam, setEditBlueTeam] = useState<string[]>([])
  const [rosterSaving, setRosterSaving] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [showNewPlayersConfirm, setShowNewPlayersConfirm] = useState(false)
  const [pendingNewPlayers, setPendingNewPlayers] = useState<string[]>([])
  const [addingNewPlayers, setAddingNewPlayers] = useState(false)

  useEffect(() => {
    if (!session) { navigate('/login'); return }
    loadData()
  }, [session, season])

  async function loadData() {
    const tables = getTableNames(season)
    const { data: matches } = await supabase.from(tables.matches).select('*')
      .eq('status', 'pending').order('match_date', { ascending: false })
    setPendingMatches((matches || []) as Match[])

    const { data: players } = await supabase.from('players').select('*').eq('is_active', true)
    setAllPlayers((players || []) as Player[])
  }

  async function selectMatch(match: Match) {
    setSelectedMatch(match)
    setError('')
    setSuccess('')
    setEvents([])
    setWhiteScore(0)
    setBlueScore(0)
    setWhiteOwnGoals(0)
    setBlueOwnGoals(0)

    const tables = getTableNames(season)
    const { data } = await supabase.from(tables.matchPlayers).select('*')
      .eq('match_id', match.id)
    setMatchPlayers((data || []) as MatchPlayer[])
  }

  function startEditRoster() {
    setEditWhiteTeam(whitePlayers.map(p => p.player_name))
    setEditBlueTeam(bluePlayers.map(p => p.player_name))
    setEditingRoster(true)
    setRosterSearch('')
  }

  async function saveRoster() {
    if (!selectedMatch) return
    setRosterSaving(true)
    setError('')
    try {
      const tables = getTableNames(season)

      // Delete existing match_players rows
      const { error: delErr } = await supabase.from(tables.matchPlayers)
        .delete().eq('match_id', selectedMatch.id)
      if (delErr) throw delErr

      // Detect air-drop players (on both teams)
      const whiteSet = new Set(editWhiteTeam)
      const blueSet = new Set(editBlueTeam)
      const airDropNames = editWhiteTeam.filter(n => blueSet.has(n))

      // Build new rows
      const rows = [
        ...editWhiteTeam.map(name => ({
          match_id: selectedMatch.id, player_name: name, team: 'white',
          is_airdrop: airDropNames.includes(name),
        })),
        ...editBlueTeam.filter(n => !whiteSet.has(n)).map(name => ({
          match_id: selectedMatch.id, player_name: name, team: 'blue',
          is_airdrop: false,
        })),
        // Air-drop players also get a blue team row
        ...airDropNames.map(name => ({
          match_id: selectedMatch.id, player_name: name, team: 'blue',
          is_airdrop: true,
        })),
      ]

      const { error: insErr } = await supabase.from(tables.matchPlayers).insert(rows)
      if (insErr) throw insErr

      // Reload match players
      const { data } = await supabase.from(tables.matchPlayers).select('*')
        .eq('match_id', selectedMatch.id)
      setMatchPlayers((data || []) as MatchPlayer[])
      setEditingRoster(false)
      setSuccess('名单已更新！')
    } catch (err) {
      setError(`名单保存失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setRosterSaving(false)
    }
  }

  async function confirmAddNewPlayers() {
    if (pendingNewPlayers.length === 0) return
    setAddingNewPlayers(true)
    const rows = pendingNewPlayers.map(name => ({
      name, player_type: 'guest' as const, is_active: true, aliases: [],
    }))
    const { error: err } = await supabase.from('players').insert(rows)
    if (err) {
      setError(`添加球员失败: ${err.message}`)
    } else {
      const { data: players } = await supabase.from('players').select('*').eq('is_active', true)
      setAllPlayers((players || []) as Player[])
    }
    setAddingNewPlayers(false)
    setShowNewPlayersConfirm(false)
    setPendingNewPlayers([])
  }

  async function handleAIParse() {
    if (!rawText.trim() || !selectedMatch) return
    setParsing(true)
    setError('')
    try {
      const whitePlayers = matchPlayers.filter(p => p.team === 'white').map(p => p.player_name)
      const bluePlayers = matchPlayers.filter(p => p.team === 'blue').map(p => p.player_name)
      const aliasMap = buildAliasMap(allPlayers)

      const result = await parseResultText(rawText, whitePlayers, bluePlayers, aliasMap)
      const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(jsonStr)

      setWhiteScore(data.whiteScore || 0)
      setBlueScore(data.blueScore || 0)
      setWhiteOwnGoals(data.whiteOwnGoals || 0)
      setBlueOwnGoals(data.blueOwnGoals || 0)
      setEvents(data.events || [])
    } catch (err) {
      setError(`AI解析失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!selectedMatch) return
    setSaving(true)
    setError('')
    try {
      const tables = getTableNames(season)

      // Aggregate goals and assists per player per team
      const statsMap: Record<string, { player_name: string; team: string; goals: number; assists: number }> = {}

      for (const event of events) {
        if (event.isOwnGoal) continue // Skip own goals for player stats

        const scorerKey = `${event.scorer}_${event.team}`
        if (!statsMap[scorerKey]) {
          statsMap[scorerKey] = { player_name: event.scorer, team: event.team, goals: 0, assists: 0 }
        }
        statsMap[scorerKey].goals++

        if (event.assister) {
          const assistKey = `${event.assister}_${event.team}`
          if (!statsMap[assistKey]) {
            statsMap[assistKey] = { player_name: event.assister, team: event.team, goals: 0, assists: 0 }
          }
          statsMap[assistKey].assists++
        }
      }

      // Insert stats
      const statRows = Object.values(statsMap).map(s => ({
        match_id: selectedMatch.id,
        ...s,
      }))

      if (statRows.length > 0) {
        const { error: statsErr } = await supabase.from(tables.matchStats).insert(statRows)
        if (statsErr) throw statsErr
      }

      // Update match score and status
      const { error: matchErr } = await supabase.from(tables.matches)
        .update({
          white_score: whiteScore,
          blue_score: blueScore,
          white_own_goals: whiteOwnGoals,
          blue_own_goals: blueOwnGoals,
          status: 'completed',
        })
        .eq('id', selectedMatch.id)

      if (matchErr) throw matchErr

      // Auto-recalculate stats and winrate
      try {
        await recalculateStats(season)
        await recalculateWinRate(season)
      } catch (calcErr) {
        console.warn('Stats recalculation warning:', calcErr)
      }

      setSuccess('比赛结果已保存，统计数据已自动更新！')
      setSelectedMatch(null)
      setEvents([])
      setRawText('')
      loadData()
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  const whitePlayers = matchPlayers.filter(p => p.team === 'white')
  const bluePlayers = matchPlayers.filter(p => p.team === 'blue')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">比赛记录</h1>

      {/* Match selector */}
      {!selectedMatch && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3">选择待记录的比赛</h2>
          {pendingMatches.length === 0 && (
            <p className="text-gray-400 text-center py-4">没有待记录的比赛，请先去"比赛报名"创建比赛</p>
          )}
          <div className="space-y-2">
            {pendingMatches.map(match => (
              <button
                key={match.id}
                onClick={() => selectMatch(match)}
                className="w-full text-left p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="font-medium">{formatDate(match.match_date)}</div>
                <div className="text-sm text-gray-500">{match.match_time} | {match.venue} | {match.match_type}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected match */}
      {selectedMatch && (
        <>
          {/* Match info */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-blue-800">{formatDate(selectedMatch.match_date)}</div>
                <div className="text-sm text-blue-600">{selectedMatch.match_time} | {selectedMatch.venue} | {selectedMatch.match_type}</div>
              </div>
              <div className="flex items-center gap-2">
                {!editingRoster && (
                  <button onClick={startEditRoster}
                    className="text-sm text-amber-600 hover:text-amber-800 flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5" /> 编辑名单
                  </button>
                )}
                <button onClick={() => { setSelectedMatch(null); setEvents([]); setEditingRoster(false) }}
                  className="text-sm text-blue-600 hover:text-blue-800">返回列表</button>
              </div>
            </div>

            {/* Read-only roster */}
            {!editingRoster && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <div className="text-xs text-blue-600 mb-1">白队（{whitePlayers.length}人）</div>
                  <div className="flex flex-wrap gap-1">
                    {whitePlayers.map(p => (
                      <span key={p.id} className="px-2 py-0.5 bg-white rounded-full text-xs">{p.player_name}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-blue-600 mb-1">蓝队（{bluePlayers.length}人）</div>
                  <div className="flex flex-wrap gap-1">
                    {bluePlayers.map(p => (
                      <span key={p.id} className="px-2 py-0.5 bg-white rounded-full text-xs">{p.player_name}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Editable roster */}
            {editingRoster && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* White team editor */}
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-600 mb-2">白队（{editWhiteTeam.length}人）</div>
                    <div className="flex flex-wrap gap-1 mb-2 min-h-[32px]">
                      {editWhiteTeam.map(name => (
                        <span key={name} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                          {name}
                          <button onClick={() => setEditWhiteTeam(prev => prev.filter(n => n !== name))}
                            className="text-gray-400 hover:text-red-500">&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Blue team editor */}
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xs font-semibold text-blue-600 mb-2">蓝队（{editBlueTeam.length}人）</div>
                    <div className="flex flex-wrap gap-1 mb-2 min-h-[32px]">
                      {editBlueTeam.map(name => (
                        <span key={name} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 rounded-full text-xs">
                          {name}
                          <button onClick={() => setEditBlueTeam(prev => prev.filter(n => n !== name))}
                            className="text-blue-400 hover:text-red-500">&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Player picker */}
                <div className="bg-white rounded-lg p-3">
                  <input type="text" value={rosterSearch} onChange={e => setRosterSearch(e.target.value)}
                    placeholder="搜索球员添加到队伍..." className="w-full px-3 py-1.5 border rounded-lg text-sm mb-2" />
                  <div className="max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {allPlayers
                        .filter(p => !editWhiteTeam.includes(p.name) && !editBlueTeam.includes(p.name))
                        .filter(p => !rosterSearch || p.name.includes(rosterSearch) || (p.aliases || []).some(a => a.includes(rosterSearch)))
                        .map(p => (
                          <span key={p.id} className="inline-flex items-center gap-1 text-xs">
                            <button onClick={() => setEditWhiteTeam(prev => [...prev, p.name])}
                              className="px-2 py-1 bg-gray-50 hover:bg-gray-200 rounded-l-full transition" title="加入白队">
                              白
                            </button>
                            <span className="px-1 py-1 bg-gray-50 text-gray-700">{p.name}</span>
                            <button onClick={() => setEditBlueTeam(prev => [...prev, p.name])}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-200 rounded-r-full transition" title="加入蓝队">
                              蓝
                            </button>
                          </span>
                        ))}
                    </div>
                    {allPlayers.filter(p => !editWhiteTeam.includes(p.name) && !editBlueTeam.includes(p.name)).length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">所有球员已分配</div>
                    )}
                  </div>
                  <button onClick={() => setShowNewPlayersConfirm(true)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" /> 添加新球员到数据库
                  </button>
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-2">
                  <button onClick={() => setEditingRoster(false)}
                    className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition">取消</button>
                  <button onClick={saveRoster} disabled={rosterSaving || editWhiteTeam.length === 0 || editBlueTeam.length === 0}
                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:bg-gray-400 transition">
                    {rosterSaving ? '保存中...' : '保存名单'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Input */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold text-gray-700">AI解析比赛结果</h2>
            </div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={"粘贴比赛结果，例如:\n蓝9:7白\n白\n马指进球\n井助攻，一陶进球\n蓝\n霏赫助攻，小段进球"}
              className="w-full h-40 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            <button
              onClick={handleAIParse}
              disabled={parsing || !rawText.trim()}
              className="mt-3 px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {parsing ? 'AI解析中...' : 'AI智能解析'}
            </button>
          </div>

          {/* Errors / Success */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg flex items-start gap-2">
              <Check className="w-5 h-5 mt-0.5 shrink-0" /> {success}
            </div>
          )}

          {/* Parsed results */}
          {events.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-gray-700">确认比赛结果</h2>

              {/* Score */}
              <div className="flex items-center justify-center gap-6 py-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-500">白队</div>
                  <input type="number" min={0} value={whiteScore} onChange={e => setWhiteScore(+e.target.value)}
                    className="w-20 text-center text-3xl font-bold border-b-2 border-blue-500 bg-transparent outline-none" />
                </div>
                <span className="text-xl text-gray-400 font-bold">VS</span>
                <div className="text-center">
                  <div className="text-sm text-gray-500">蓝队</div>
                  <input type="number" min={0} value={blueScore} onChange={e => setBlueScore(+e.target.value)}
                    className="w-20 text-center text-3xl font-bold border-b-2 border-blue-500 bg-transparent outline-none" />
                </div>
              </div>

              {(whiteOwnGoals > 0 || blueOwnGoals > 0) && (
                <div className="text-center text-sm text-gray-500">
                  {whiteOwnGoals > 0 && <span>白队乌龙 {whiteOwnGoals} 个 </span>}
                  {blueOwnGoals > 0 && <span>蓝队乌龙 {blueOwnGoals} 个</span>}
                </div>
              )}

              {/* Events table */}
              <div className="space-y-1">
                <div className="grid grid-cols-[40px_1fr_1fr_60px] text-xs text-gray-500 font-medium px-2">
                  <div>#</div><div>进球</div><div>助攻</div><div>队伍</div>
                </div>
                {events.map((ev, i) => (
                  <div key={i} className={`grid grid-cols-[40px_1fr_1fr_60px] items-center px-2 py-2 rounded-lg text-sm ${
                    ev.isOwnGoal ? 'bg-red-50' : ev.team === 'white' ? 'bg-gray-50' : 'bg-blue-50'
                  }`}>
                    <div className="text-gray-400">{i + 1}</div>
                    <div className="font-medium">{ev.isOwnGoal ? '乌龙球' : ev.scorer}</div>
                    <div className="text-gray-500">{ev.assister || '-'}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        ev.team === 'white' ? 'bg-gray-200' : 'bg-blue-200'
                      }`}>
                        {ev.team === 'white' ? '白' : '蓝'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                {saving ? '保存中...' : '确认保存比赛结果'}
              </button>
            </div>
          )}

          {/* New player confirmation dialog */}
          {showNewPlayersConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold mb-2">添加新球员</h3>
                <p className="text-sm text-gray-500 mb-3">输入球员名称，将以外援身份添加到数据库</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {pendingNewPlayers.map(name => (
                    <span key={name} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-800">
                      {name}
                      <button onClick={() => setPendingNewPlayers(prev => prev.filter(n => n !== name))}
                        className="text-amber-400 hover:text-red-500 ml-0.5">&times;</button>
                    </span>
                  ))}
                </div>
                <input type="text" placeholder="输入球员名称，回车添加"
                  className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val && !pendingNewPlayers.includes(val)) {
                        setPendingNewPlayers(prev => [...prev, val])
                      }
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }} />
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setShowNewPlayersConfirm(false); setPendingNewPlayers([]) }}
                    className="px-4 py-2 rounded-lg border text-sm">取消</button>
                  <button onClick={confirmAddNewPlayers}
                    disabled={addingNewPlayers || pendingNewPlayers.length === 0}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-400 transition">
                    {addingNewPlayers ? '添加中...' : `确认添加 ${pendingNewPlayers.length} 人`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
