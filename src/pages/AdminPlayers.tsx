import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Search, UserPlus, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import type { Player } from '../lib/types'

export default function AdminPlayers() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'guest'>('all')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // New player form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'regular' | 'guest'>('guest')
  const [addError, setAddError] = useState('')

  // Alias form
  const [aliasInput, setAliasInput] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    if (!session) { navigate('/login'); return }
    loadPlayers()
  }, [session])

  async function loadPlayers() {
    setLoading(true)
    const { data } = await supabase.from('players').select('*').eq('is_active', true).order('name')
    setPlayers((data || []) as Player[])
    setLoading(false)
  }

  async function togglePlayerType(player: Player) {
    const newType = player.player_type === 'regular' ? 'guest' : 'regular'
    setSaving(player.id)
    const { error } = await supabase.from('players')
      .update({ player_type: newType })
      .eq('id', player.id)
    if (!error) {
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, player_type: newType } : p))
    }
    setSaving(null)
  }

  async function addAlias(player: Player) {
    const alias = (aliasInput[player.id] || '').trim()
    if (!alias) return
    const newAliases = [...(player.aliases || []), alias]
    setSaving(player.id)
    const { error } = await supabase.from('players')
      .update({ aliases: newAliases })
      .eq('id', player.id)
    if (!error) {
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, aliases: newAliases } : p))
      setAliasInput(prev => ({ ...prev, [player.id]: '' }))
    }
    setSaving(null)
  }

  async function addNewPlayer() {
    const name = newName.trim()
    if (!name) return
    setAddError('')
    const existing = players.find(p => p.name === name)
    if (existing) {
      setAddError('该球员已存在')
      return
    }
    const { error } = await supabase.from('players').insert({
      name, player_type: newType, is_active: true, aliases: [],
    })
    if (error) {
      setAddError(`添加失败: ${error.message}`)
      return
    }
    await loadPlayers()
    setNewName('')
    setShowAddForm(false)
  }

  const filtered = players
    .filter(p => filterType === 'all' || p.player_type === filterType)
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) ||
        (p.aliases || []).some(a => a.toLowerCase().includes(q))
    })

  const regularCount = players.filter(p => p.player_type === 'regular').length
  const guestCount = players.filter(p => p.player_type === 'guest').length

  if (loading) return <div className="text-center py-20 text-gray-500">加载中...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">球员管理</h1>
        <button onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5">
          <UserPlus className="w-4 h-4" /> 新增球员
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xs text-gray-500">总球员</div>
          <div className="text-xl font-bold text-blue-600">{players.length}</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xs text-gray-500">主力</div>
          <div className="text-xl font-bold text-blue-600">{regularCount}</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xs text-gray-500">外援</div>
          <div className="text-xl font-bold text-amber-600">{guestCount}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索球员或别名..." className="flex-1 text-sm outline-none" />
        </div>
        <div className="flex gap-1.5">
          {([['all', '全部'], ['regular', '主力'], ['guest', '外援']] as ['all' | 'regular' | 'guest', string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilterType(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterType === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Player list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_1fr_40px] bg-gray-50 border-b px-4 py-3">
          <div className="text-xs font-semibold text-gray-500">球员</div>
          <div className="text-xs font-semibold text-gray-500 text-center">类型</div>
          <div className="text-xs font-semibold text-gray-500">别名</div>
          <div />
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">无匹配球员</div>
        )}

        {filtered.map(player => {
          const isExpanded = expandedId === player.id
          return (
            <div key={player.id} className="border-b last:border-0">
              {/* Main row */}
              <div className="grid grid-cols-[1fr_80px_1fr_40px] items-center px-4 py-3 hover:bg-gray-50 transition">
                <div className="text-sm font-medium text-gray-800">{player.name}</div>
                <div className="text-center">
                  <button
                    onClick={() => togglePlayerType(player)}
                    disabled={saving === player.id}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      player.player_type === 'regular'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {player.player_type === 'regular' ? '主力' : '外援'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(player.aliases || []).map(alias => (
                    <span key={alias} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{alias}</span>
                  ))}
                  {(!player.aliases || player.aliases.length === 0) && (
                    <span className="text-xs text-gray-300">无别名</span>
                  )}
                </div>
                <button onClick={() => setExpandedId(isExpanded ? null : player.id)}
                  className="text-gray-400 hover:text-gray-600">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded area: add alias */}
              {isExpanded && (
                <div className="px-4 pb-3 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={aliasInput[player.id] || ''}
                      onChange={e => setAliasInput(prev => ({ ...prev, [player.id]: e.target.value }))}
                      placeholder="输入新别名..."
                      className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                      onKeyDown={e => { if (e.key === 'Enter') addAlias(player) }}
                    />
                    <button onClick={() => addAlias(player)}
                      disabled={saving === player.id}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-1">
                      <Plus className="w-3 h-3" /> 添加别名
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add new player dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">新增球员</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">球员名称</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="输入球员名称" className="w-full px-3 py-2 border rounded-lg text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') addNewPlayer() }} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">球员类型</label>
                <select value={newType} onChange={e => setNewType(e.target.value as 'regular' | 'guest')}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="guest">外援</option>
                  <option value="regular">主力</option>
                </select>
              </div>
              {addError && <div className="text-sm text-red-600">{addError}</div>}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setShowAddForm(false); setAddError('') }}
                className="px-4 py-2 rounded-lg border text-sm">取消</button>
              <button onClick={addNewPlayer}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
