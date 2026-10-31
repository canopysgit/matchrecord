import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getTableNames } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { useSeason } from '../contexts/SeasonContext'
import { parseRosterText } from '../lib/kimi'
import { buildAliasMap } from '../lib/playerMatcher'
import { Sparkles, AlertCircle, Check, UserPlus, Search, Users } from 'lucide-react'
import type { Player, ParsedRoster } from '../lib/types'

type Tab = 'manual' | 'ai'

export default function MatchSignup() {
  const { session } = useAuth()
  const { season } = useSeason()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [tab, setTab] = useState<Tab>('manual')

  // Shared state for both modes
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00-20:00')
  const [venue, setVenue] = useState('机场南楼')
  const [matchType, setMatchType] = useState('内战')
  const [whiteTeam, setWhiteTeam] = useState<string[]>([])
  const [blueTeam, setBlueTeam] = useState<string[]>([])
  const [whiteCaptain, setWhiteCaptain] = useState('')
  const [blueCaptain, setBlueCaptain] = useState('')

  // AI mode state
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedRoster | null>(null)
  const [unknownPlayers, setUnknownPlayers] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)

  // Shared state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New player dialogs
  const [showNewPlayer, setShowNewPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerType, setNewPlayerType] = useState<'regular' | 'guest'>('guest')
  const [showNewPlayersConfirm, setShowNewPlayersConfirm] = useState(false)
  const [pendingNewPlayers, setPendingNewPlayers] = useState<string[]>([])
  const [addingNewPlayers, setAddingNewPlayers] = useState(false)

  useEffect(() => {
    if (!session) { navigate('/login'); return }
    loadPlayers()
  }, [session])

  async function loadPlayers() {
    const { data } = await db.from('players').select('*').eq('is_active', true).order('name')
    setPlayers((data || []) as Player[])
  }

  // --- Manual mode: simple text parse (no AI) ---
  function handleManualParse(text: string) {
    // Try to parse format like:
    // 20260516：晚上南楼
    // 袁祎（白）：旭东 广文 王磊 ...
    // 邵林（蓝）：朱瑞 井 阿曼 ...
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return

    // Line 1: date + venue
    const firstLine = lines[0]
    const dateMatch = firstLine.match(/(\d{8})/)
    if (dateMatch) {
      const d = dateMatch[1]
      setDate(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)
    }
    // Detect time
    if (firstLine.includes('晚')) setTime('18:00-20:00')
    else if (firstLine.includes('下午')) setTime('14:00-16:00')
    // Detect venue
    if (firstLine.includes('南楼')) setVenue('机场南楼')

    // Remaining lines: team rosters
    const aliasMap = buildAliasMap(players)
    const playerNames = players.map(p => p.name)
    const allKnown = new Set(playerNames)
    // Also add aliases
    for (const [alias, realName] of Object.entries(aliasMap)) {
      allKnown.add(alias)
    }

    let white: string[] = []
    let blue: string[] = []
    let wCaptain = ''
    let bCaptain = ''
    const unknown: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      // Detect team color
      const isWhite = /白/.test(line)
      const isBlue = /蓝/.test(line)
      if (!isWhite && !isBlue) continue

      // Extract captain from pattern like 袁祎（白）or 邵林（蓝）
      const captainMatch = line.match(/^(\S+?)[\s（(]*(白|蓝)/)
      const captainName = captainMatch ? captainMatch[1] : ''

      // Get all names: split by space, colon, comma etc
      const afterColon = line.replace(/^[^：:]*[：:]/, '').trim()
      const names = afterColon.split(/[\s,，、]+/).filter(Boolean)

      // Add captain to front if not already in list
      const allNames = captainName && !names.includes(captainName) ? [captainName, ...names] : names

      // Resolve aliases
      const resolved = allNames.map(n => aliasMap[n] || n)

      // Detect unknowns
      for (const n of resolved) {
        if (!playerNames.includes(n) && !unknown.includes(n)) {
          unknown.push(n)
        }
      }

      if (isWhite) {
        white = resolved
        if (captainName) wCaptain = aliasMap[captainName] || captainName
      } else {
        blue = resolved
        if (captainName) bCaptain = aliasMap[captainName] || captainName
      }
    }

    if (white.length > 0) setWhiteTeam(white)
    if (blue.length > 0) setBlueTeam(blue)
    if (wCaptain) setWhiteCaptain(wCaptain)
    if (bCaptain) setBlueCaptain(bCaptain)

    if (unknown.length > 0) {
      setUnknownPlayers(unknown)
      setPendingNewPlayers(unknown)
      setShowNewPlayersConfirm(true)
    }
  }

  // --- AI mode ---
  async function handleAIParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setError('')
    try {
      const aliasMap = buildAliasMap(players)
      const playerNames = players.map(p => p.name)
      const result = await parseRosterText(rawText, playerNames, aliasMap)
      const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(jsonStr)

      setParsed(data)
      setDate(data.date || '')
      setTime(data.time || '18:00-20:00')
      setVenue(data.venue || '机场南楼')
      setMatchType(data.matchType || '内战')
      setWhiteTeam(data.whiteTeam || [])
      setBlueTeam(data.blueTeam || [])
      setWhiteCaptain(data.whiteCaptain || '')
      setBlueCaptain(data.blueCaptain || '')

      const unknown = data.unknownPlayers || []
      setUnknownPlayers(unknown)

      const wt = data.whiteTeam || []
      const bt = data.blueTeam || []
      const allTeamNames = new Set([...wt, ...bt])
      const missingFromTeams = unknown.filter((n: string) => !allTeamNames.has(n))
      if (missingFromTeams.length > 0) {
        setWhiteTeam(prev => [...prev, ...missingFromTeams])
      }

      if (unknown.length > 0) {
        setPendingNewPlayers(unknown)
        setShowNewPlayersConfirm(true)
      }
    } catch (err) {
      setError(`AI解析失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setParsing(false)
    }
  }

  async function addNewPlayer() {
    if (!newPlayerName.trim()) return
    const { error } = await db.from('players').insert({
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

  async function confirmAddNewPlayers() {
    if (pendingNewPlayers.length === 0) return
    setAddingNewPlayers(true)
    const rows = pendingNewPlayers.map(name => ({
      name, player_type: 'guest' as const, is_active: true, aliases: [],
    }))
    const { error } = await db.from('players').insert(rows)
    if (error) {
      setError(`批量添加球员失败: ${error.message}`)
    } else {
      await loadPlayers()
      setUnknownPlayers([])
    }
    setAddingNewPlayers(false)
    setShowNewPlayersConfirm(false)
    setPendingNewPlayers([])
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
      const { count } = await db.from(tables.matches)
        .select('*', { count: 'exact', head: true })
      const matchNumber = (count || 0) + 1

      const { data: match, error: matchErr } = await db.from(tables.matches).insert({
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

      const airDropSet = new Set(whiteTeam.filter(n => blueTeam.includes(n)))
      const playerRows = [
        ...whiteTeam.map(name => ({
          match_id: match.id, player_name: name, team: 'white',
          is_airdrop: airDropSet.has(name),
        })),
        ...blueTeam.filter(n => !airDropSet.has(n)).map(name => ({
          match_id: match.id, player_name: name, team: 'blue',
          is_airdrop: false,
        })),
        // Airdrop players get a blue team row too
        ...[...airDropSet].map(name => ({
          match_id: match.id, player_name: name, team: 'blue',
          is_airdrop: true,
        })),
      ]

      const { error: playerErr } = await db.from(tables.matchPlayers).insert(playerRows)
      if (playerErr) throw playerErr

      const captainRows = []
      if (whiteCaptain) captainRows.push({ match_id: match.id, team: 'white', captain_name: whiteCaptain })
      if (blueCaptain) captainRows.push({ match_id: match.id, team: 'blue', captain_name: blueCaptain })
      if (captainRows.length) {
        await db.from(tables.matchCaptains).insert(captainRows)
      }

      setSuccess('比赛报名已创建！现在可以去"比赛记录"页面录入比赛结果。')
      setRawText('')
      setParsed(null)
      setWhiteTeam([])
      setBlueTeam([])
      setWhiteCaptain('')
      setBlueCaptain('')
      setDate('')
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  const showForm = tab === 'manual' || parsed || date

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">比赛报名</h1>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'manual' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          手工录入
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'ai' ? 'bg-white shadow text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Sparkles className="w-4 h-4 inline mr-1.5" />
          AI智能解析
        </button>
      </div>

      {/* Manual Mode: Quick Paste */}
      {tab === 'manual' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-2">快速粘贴分组</h2>
          <p className="text-sm text-gray-500 mb-3">粘贴分组文本后点击"解析"，自动填充下方表单。也可跳过直接手动选人。</p>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder={"例如:\n20260516：晚上南楼\n袁祎（白）：旭东 广文 王磊 刘杰...\n邵林（蓝）：朱瑞 井 阿曼 赵之宇..."}
            className="w-full h-28 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            onClick={() => handleManualParse(rawText)}
            disabled={!rawText.trim()}
            className="mt-3 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 transition"
          >
            解析文本
          </button>
        </div>
      )}

      {/* AI Mode */}
      {tab === 'ai' && (
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
      )}

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

      {/* Editable Form - always show in manual mode, or after AI parse */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">比赛信息</h2>

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
                <option value="14:00-16:00">14:00-16:00</option>
                <option value="16:00-18:00">16:00-18:00</option>
                <option value="18:00-20:00">18:00-20:00</option>
                <option value="20:00-22:00">20:00-22:00</option>
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
          {(() => {
            const airDropComputed = whiteTeam.filter(n => blueTeam.includes(n))
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamEditor
                    label="白队"
                    team={whiteTeam}
                    setTeam={setWhiteTeam}
                    captain={whiteCaptain}
                    setCaptain={setWhiteCaptain}
                    players={players}
                    season={season}
                    airDropNames={airDropComputed}
                    defaultOpen={tab === 'manual'}
                  />
                  <TeamEditor
                    label="蓝队"
                    team={blueTeam}
                    setTeam={setBlueTeam}
                    captain={blueCaptain}
                    setCaptain={setBlueCaptain}
                    players={players}
                    season={season}
                    airDropNames={airDropComputed}
                    defaultOpen={tab === 'manual'}
                  />
                </div>
                {airDropComputed.length > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-purple-700">空降球员（蓝白各踢一节，出勤计算、进球助攻计算，胜率不计）：</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {airDropComputed.map(n => (
                        <span key={n} className="px-3 py-1 bg-purple-100 rounded-full text-sm text-purple-800">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {saving ? '保存中...' : '确认创建比赛'}
          </button>
        </div>
      )}

      {/* Single new player dialog */}
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

      {/* Batch new players confirmation dialog */}
      {showNewPlayersConfirm && pendingNewPlayers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">发现新球员</h3>
            <p className="text-sm text-gray-500 mb-4">以下球员不在数据库中，确认添加为外援？</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {pendingNewPlayers.map(name => (
                <span key={name} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-800">
                  {name}
                  <button onClick={() => setPendingNewPlayers(prev => prev.filter(n => n !== name))}
                    className="text-amber-400 hover:text-red-500 ml-0.5">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowNewPlayersConfirm(false); setPendingNewPlayers([]) }}
                className="px-4 py-2 rounded-lg border text-sm">跳过</button>
              <button onClick={confirmAddNewPlayers} disabled={addingNewPlayers}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                {addingNewPlayers ? '添加中...' : `确认添加 ${pendingNewPlayers.length} 名球员`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamEditor({ label, team, setTeam, captain, setCaptain, players, season, airDropNames = [], defaultOpen = false }: {
  label: string; team: string[]; setTeam: (t: string[]) => void
  captain: string; setCaptain: (c: string) => void
  players: Player[]; season: number; airDropNames?: string[]
  defaultOpen?: boolean
}) {
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(defaultOpen)
  const [attendance, setAttendance] = useState<Record<string, number>>({})

  useEffect(() => {
    loadAttendance()
  }, [season])

  async function loadAttendance() {
    const tables = getTableNames(season)
    const { data } = await db.from(tables.playerStats).select('player_name, attendance_total')
    if (data) {
      const map: Record<string, number> = {}
      for (const row of data) map[row.player_name] = row.attendance_total || 0
      setAttendance(map)
    }
  }

  const sortedPlayers = [...players].sort((a, b) => {
    const aAtt = attendance[a.name] || 0
    const bAtt = attendance[b.name] || 0
    if (aAtt > 0 && bAtt === 0) return -1
    if (aAtt === 0 && bAtt > 0) return 1
    if (aAtt !== bAtt) return bAtt - aAtt
    return a.name.localeCompare(b.name)
  })

  const filteredPlayers = sortedPlayers
    .filter(p => !team.includes(p.name))
    .filter(p => !search || p.name.includes(search) || (p.aliases || []).some(a => a.includes(search)))

  const activeRegulars = filteredPlayers.filter(p => p.player_type === 'regular' && (attendance[p.name] || 0) > 0)
  const activeGuests = filteredPlayers.filter(p => p.player_type === 'guest' && (attendance[p.name] || 0) > 0)
  const inactiveRegulars = filteredPlayers.filter(p => p.player_type === 'regular' && (attendance[p.name] || 0) === 0)
  const inactiveGuests = filteredPlayers.filter(p => p.player_type === 'guest' && (attendance[p.name] || 0) === 0)

  const isWhite = label.includes('白')

  return (
    <div className={`border-2 rounded-lg p-3 ${isWhite ? 'border-gray-300' : 'border-blue-300'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-semibold ${isWhite ? 'text-gray-700' : 'text-blue-600'}`}>{label}（{team.length}人）</h3>
        <button onClick={() => setShowPicker(!showPicker)}
          className="text-sm text-blue-600 hover:text-blue-800">
          {showPicker ? '收起选人' : '+ 选人'}
        </button>
      </div>

      {/* Current team */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px]">
        {team.length === 0 && <span className="text-sm text-gray-400">点击下方球员添加到此队</span>}
        {team.map(name => {
          const isAirDrop = airDropNames.includes(name)
          return (
            <span key={name} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm ${isAirDrop ? 'bg-purple-100' : isWhite ? 'bg-gray-100' : 'bg-blue-50'}`}>
              {captain === name && <span className="text-amber-500 font-bold text-xs">C</span>}
              {isAirDrop && <span className="text-purple-600 font-semibold text-[10px]">空降</span>}
              {name}
              <button onClick={() => { setTeam(team.filter(n => n !== name)); if (captain === name) setCaptain('') }}
                className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
            </span>
          )
        })}
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
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索球员..." className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm" />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2">
            {activeRegulars.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">常规球员（本赛季活跃）</div>
                <div className="flex flex-wrap gap-1">
                  {activeRegulars.map(p => (
                    <button key={p.id} onClick={() => setTeam([...team, p.name])}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-full text-xs transition">
                      {p.name} <span className="text-gray-400">({attendance[p.name]})</span>
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
                      {p.name} <span className="text-gray-400">({attendance[p.name]})</span>
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
            {filteredPlayers.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-2">没有找到球员</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
