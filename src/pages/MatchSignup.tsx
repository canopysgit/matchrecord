import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getTableNames } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSeason } from '../contexts/SeasonContext'
import { parseRosterText } from '../lib/kimi'
import { buildAliasMap } from '../lib/playerMatcher'
import { Sparkles, AlertCircle, Check, UserPlus } from 'lucide-react'
import type { Player, ParsedRoster } from '../lib/types'

export default function MatchSignup() {
  const { session } = useAuth()
  const { season } = useSeason()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedRoster | null>(null)
  const [unknownPlayers, setUnknownPlayers] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Editable fields (can override AI result)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('2-4')
  const [venue, setVenue] = useState('机场南楼')
  const [matchType, setMatchType] = useState('内战')
  const [whiteTeam, setWhiteTeam] = useState<string[]>([])
  const [blueTeam, setBlueTeam] = useState<string[]>([])
  const [whiteCaptain, setWhiteCaptain] = useState('')
  const [blueCaptain, setBlueCaptain] = useState('')
  const [airDropPlayers, setAirDropPlayers] = useState<string[]>([])

  // New player dialog
  const [showNewPlayer, setShowNewPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerType, setNewPlayerType] = useState<'regular' | 'guest'>('guest')

  useEffect(() => {
    if (!session) { navigate('/login'); return }
    loadPlayers()
  }, [session])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').eq('is_active', true).order('name')
    setPlayers((data || []) as Player[])
  }

  async function handleAIParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setError('')
    try {
      const aliasMap = buildAliasMap(players)
      const playerNames = players.map(p => p.name)
      const result = await parseRosterText(rawText, playerNames, aliasMap)

      // Parse JSON from AI response
      const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(jsonStr)

      setParsed(data)
      setDate(data.date || '')
      setTime(data.time || '2-4')
      setVenue(data.venue || '机场南楼')
      setMatchType(data.matchType || '内战')
      setWhiteTeam(data.whiteTeam || [])
      setBlueTeam(data.blueTeam || [])
      setWhiteCaptain(data.whiteCaptain || '')
      setBlueCaptain(data.blueCaptain || '')
      setAirDropPlayers(data.airDropPlayers || [])
      setUnknownPlayers(data.unknownPlayers || [])
    } catch (err) {
      setError(`AI解析失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setParsing(false)
    }
  }

  async function addNewPlayer() {
    if (!newPlayerName.trim()) return
    const { error } = await supabase.from('players').insert({
      name: newPlayerName.trim(),
      player_type: newPlayerType,
      is_active: true,
      aliases: [],
    })
    if (error) {
      setError(`添加球员失败: ${error.message}`)
      return
    }
    await loadPlayers()
    setShowNewPlayer(false)
    setNewPlayerName('')
  }

  async function handleSave() {
    if (!date || whiteTeam.length === 0 || blueTeam.length === 0) {
      setError('请确保日期、白队和蓝队信息完整')
      return
    }
    setSaving(true)
    setError('')
    try {
      const tables = getTableNames(season)

      // Count existing matches for match number
      const { count } = await supabase.from(tables.matches)
        .select('*', { count: 'exact', head: true })
      const matchNumber = (count || 0) + 1

      // Create match
      const { data: match, error: matchErr } = await supabase.from(tables.matches).insert({
        match_date: date,
        match_time: time,
        match_type: matchType,
        venue: venue,
        white_score: 0,
        blue_score: 0,
        status: 'pending',
        year_match_number: matchNumber,
        match_number: matchNumber,
      }).select().single()

      if (matchErr) throw matchErr

      // Insert players
      const airDropSet = new Set(airDropPlayers)
      const playerRows = [
        ...whiteTeam.map(name => ({
          match_id: match.id, player_name: name, team: 'white',
          is_airdrop: airDropSet.has(name),
        })),
        ...blueTeam.map(name => ({
          match_id: match.id, player_name: name, team: 'blue',
          is_airdrop: airDropSet.has(name),
        })),
      ]
      // Add air-drop players to the team they're not already in
      for (const name of airDropPlayers) {
        if (!whiteTeam.includes(name)) {
          playerRows.push({ match_id: match.id, player_name: name, team: 'white', is_airdrop: true })
        }
        if (!blueTeam.includes(name)) {
          playerRows.push({ match_id: match.id, player_name: name, team: 'blue', is_airdrop: true })
        }
      }

      const { error: playerErr } = await supabase.from(tables.matchPlayers).insert(playerRows)
      if (playerErr) throw playerErr

      // Insert captains
      const captainRows = []
      if (whiteCaptain) captainRows.push({ match_id: match.id, team: 'white', captain_name: whiteCaptain })
      if (blueCaptain) captainRows.push({ match_id: match.id, team: 'blue', captain_name: blueCaptain })
      if (captainRows.length) {
        await supabase.from(tables.matchCaptains).insert(captainRows)
      }

      setSuccess('比赛报名已创建！现在可以去"比赛记录"页面录入比赛结果。')
      setRawText('')
      setParsed(null)
      setWhiteTeam([])
      setBlueTeam([])
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">比赛报名</h1>

      {/* AI Input */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="font-semibold text-gray-700">AI智能解析</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">粘贴分组名单文字，AI自动识别日期、场地、两队球员、队长</p>
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder={"例如:\n20260110：下午南楼\n蓝 霏赫 广文 张健 孙路...\n白 罗霄 尚枫 井 小鹤..."}
          className="w-full h-32 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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

      {/* Unknown players warning */}
      {unknownPlayers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="font-medium text-amber-700 mb-2">以下球员无法识别，请处理：</div>
          <div className="flex flex-wrap gap-2">
            {unknownPlayers.map(name => (
              <span key={name} className="px-3 py-1 bg-amber-100 rounded-full text-sm text-amber-800">{name}</span>
            ))}
          </div>
          <button onClick={() => setShowNewPlayer(true)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <UserPlus className="w-4 h-4" /> 添加为新球员
          </button>
        </div>
      )}

      {/* Editable form */}
      {(parsed || date) && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">确认比赛信息</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">日期</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">时间段</label>
              <select value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="2-4">下午 2-4</option>
                <option value="4-6">下午 4-6</option>
                <option value="8-10">晚上 8-10</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">场地</label>
              <input type="text" value={venue} onChange={e => setVenue(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" list="venue-options" />
              <datalist id="venue-options">
                <option value="机场南楼" />
              </datalist>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">比赛性质</label>
              <select value={matchType} onChange={e => setMatchType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="内战">内战</option>
                <option value="外战">外战</option>
              </select>
            </div>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamEditor
              label="白队"
              team={whiteTeam}
              setTeam={setWhiteTeam}
              captain={whiteCaptain}
              setCaptain={setWhiteCaptain}
              players={players}
              season={season}
            />
            <TeamEditor
              label="蓝队"
              team={blueTeam}
              setTeam={setBlueTeam}
              captain={blueCaptain}
              setCaptain={setBlueCaptain}
              players={players}
              season={season}
            />
          </div>

          {airDropPlayers.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-sm font-medium text-amber-700">空降球员（两队都打）：</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {airDropPlayers.map(n => (
                  <span key={n} className="px-3 py-1 bg-amber-100 rounded-full text-sm">{n}</span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {saving ? '保存中...' : '确认创建比赛'}
          </button>
        </div>
      )}

      {/* New player dialog */}
      {showNewPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">添加新球员</h3>
            <div className="space-y-3">
              <input type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
                placeholder="球员名称" className="w-full px-3 py-2 border rounded-lg" />
              <select value={newPlayerType} onChange={e => setNewPlayerType(e.target.value as 'regular' | 'guest')}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="guest">外援</option>
                <option value="regular">常规球员</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowNewPlayer(false)} className="px-4 py-2 rounded-lg border">取消</button>
              <button onClick={addNewPlayer} className="px-4 py-2 rounded-lg bg-blue-600 text-white">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamEditor({ label, team, setTeam, captain, setCaptain, players, season }: {
  label: string; team: string[]; setTeam: (t: string[]) => void
  captain: string; setCaptain: (c: string) => void
  players: Player[]; season: number
}) {
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [attendance, setAttendance] = useState<Record<string, number>>({})

  useEffect(() => {
    loadAttendance()
  }, [season])

  async function loadAttendance() {
    const tables = getTableNames(season)
    const { data } = await supabase.from(tables.playerStats).select('player_name, attendance_total')
    if (data) {
      const map: Record<string, number> = {}
      for (const row of data) map[row.player_name] = row.attendance_total || 0
      setAttendance(map)
    }
  }

  // Sort: active season players first (by attendance desc), then rest
  const sortedPlayers = [...players].sort((a, b) => {
    const aAtt = attendance[a.name] || 0
    const bAtt = attendance[b.name] || 0
    // Players with attendance this season come first
    if (aAtt > 0 && bAtt === 0) return -1
    if (aAtt === 0 && bAtt > 0) return 1
    // Then by attendance desc
    if (aAtt !== bAtt) return bAtt - aAtt
    return a.name.localeCompare(b.name)
  })

  const filteredPlayers = sortedPlayers
    .filter(p => !team.includes(p.name))
    .filter(p => !search || p.name.includes(search) || (p.aliases || []).some(a => a.includes(search)))

  const regularPlayers = filteredPlayers.filter(p => p.player_type === 'regular')
  const guestPlayers = filteredPlayers.filter(p => p.player_type === 'guest')

  // Only show regulars who have attendance this season, or all if no season data
  const activeRegulars = regularPlayers.filter(p => (attendance[p.name] || 0) > 0)
  const inactiveRegulars = regularPlayers.filter(p => (attendance[p.name] || 0) === 0)
  const activeGuests = guestPlayers.filter(p => (attendance[p.name] || 0) > 0)
  const inactiveGuests = guestPlayers.filter(p => (attendance[p.name] || 0) === 0)

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-blue-600">{label}（{team.length}人）</h3>
        <button onClick={() => setShowPicker(!showPicker)}
          className="text-sm text-blue-600 hover:text-blue-800">
          {showPicker ? '收起' : '+ 添加球员'}
        </button>
      </div>

      {/* Current team */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {team.map(name => (
          <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 rounded-full text-sm">
            {captain === name && <span className="text-amber-500 font-bold text-xs">C</span>}
            {name}
            <button onClick={() => { setTeam(team.filter(n => n !== name)); if (captain === name) setCaptain('') }}
              className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
          </span>
        ))}
      </div>

      {/* Captain selector */}
      {team.length > 0 && (
        <div className="mb-2">
          <label className="text-xs text-gray-500">队长：</label>
          <select value={captain} onChange={e => setCaptain(e.target.value)}
            className="ml-1 px-2 py-1 border rounded text-xs">
            <option value="">未指定</option>
            {team.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {/* Player picker */}
      {showPicker && (
        <div className="border-t pt-2 mt-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索球员..." className="w-full px-3 py-1.5 border rounded-lg text-sm mb-2" />
          <div className="max-h-48 overflow-y-auto space-y-2">
            {activeRegulars.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">常规球员（本赛季活跃）</div>
                <div className="flex flex-wrap gap-1">
                  {activeRegulars.map(p => (
                    <button key={p.id} onClick={() => setTeam([...team, p.name])}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-full text-xs transition">
                      {p.name} <span className="text-gray-400">({attendance[p.name]}场)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeGuests.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">外援（本赛季活跃）</div>
                <div className="flex flex-wrap gap-1">
                  {activeGuests.map(p => (
                    <button key={p.id} onClick={() => setTeam([...team, p.name])}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 rounded-full text-xs transition">
                      {p.name} <span className="text-gray-400">({attendance[p.name]}场)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inactiveRegulars.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">常规球员（本赛季未出勤）</div>
                <div className="flex flex-wrap gap-1">
                  {inactiveRegulars.map(p => (
                    <button key={p.id} onClick={() => setTeam([...team, p.name])}
                      className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded-full text-xs transition text-gray-500">
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inactiveGuests.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">外援（本赛季未出勤）</div>
                <div className="flex flex-wrap gap-1">
                  {inactiveGuests.map(p => (
                    <button key={p.id} onClick={() => setTeam([...team, p.name])}
                      className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded-full text-xs transition text-gray-500">
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

