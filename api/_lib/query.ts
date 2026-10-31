// 把前端发来的查询描述（supabase 风格）翻译成参数化 SQL。
// 只允许白名单内的表，列名必须是合法标识符，值一律走参数。

export type FilterOp = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte'

export interface QueryDesc {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  columns?: string
  filters?: [FilterOp, string, unknown][]
  order?: [string, boolean][]
  limit?: number
  count?: boolean
  head?: boolean
  values?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string
  returning?: boolean
}

export interface BuiltQuery {
  text: string
  params: unknown[]
  kind: 'rows' | 'count'
}

// 可写的表
const WRITABLE = new Set([
  'players', 'matches_2026', 'match_players_2026', 'match_stats_2026', 'match_captains_2026',
])
// 只读视图
const READONLY = new Set(['player_stats_2026', 'player_winrate_2026'])

const IDENT = /^[a-z_][a-z0-9_]*$/

function ident(name: string): string {
  const n = name.trim()
  if (!IDENT.test(n)) throw new Error(`非法列名: ${name}`)
  return `"${n}"`
}

const OPS: Record<Exclude<FilterOp, 'in'>, string> = {
  eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=',
}

export function isWrite(desc: QueryDesc) {
  return desc.action !== 'select'
}

export function buildQuery(desc: QueryDesc): BuiltQuery {
  const { table, action } = desc
  if (!WRITABLE.has(table) && !READONLY.has(table)) throw new Error(`未知的表: ${table}`)
  if (action !== 'select' && READONLY.has(table)) throw new Error(`${table} 是只读视图`)

  const params: unknown[] = []
  const p = (v: unknown) => { params.push(v); return `$${params.length}` }
  const tbl = `"${table}"`

  const where = () => {
    const parts = (desc.filters || []).map(([op, col, val]) => {
      if (op === 'in') {
        if (!Array.isArray(val)) throw new Error('in 需要数组')
        if (val.length === 0) return 'false'
        return `${ident(col)} = any(${p(val)})`
      }
      if (!(op in OPS)) throw new Error(`不支持的过滤: ${op}`)
      if (val === null) return op === 'eq' ? `${ident(col)} is null` : `${ident(col)} is not null`
      return `${ident(col)} ${OPS[op]} ${p(val)}`
    })
    return parts.length ? ` where ${parts.join(' and ')}` : ''
  }

  const cols = () => {
    const c = (desc.columns || '*').trim()
    if (c === '*' || c === '') return '*'
    return c.split(',').map(ident).join(', ')
  }

  const returning = desc.returning ? ` returning ${cols()}` : ''

  if (action === 'select') {
    if (desc.count && desc.head) {
      return { text: `select count(*)::int as count from ${tbl}${where()}`, params, kind: 'count' }
    }
    let text = `select ${cols()} from ${tbl}${where()}`
    if (desc.order?.length) {
      text += ' order by ' + desc.order.map(([c, asc]) => `${ident(c)} ${asc ? 'asc' : 'desc'} nulls last`).join(', ')
    }
    if (desc.limit != null) text += ` limit ${p(Math.max(0, Math.floor(Number(desc.limit))))}`
    return { text, params, kind: 'rows' }
  }

  if (action === 'insert' || action === 'upsert') {
    const rows = Array.isArray(desc.values) ? desc.values : [desc.values || {}]
    if (rows.length === 0) throw new Error('没有要插入的数据')
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))]
    if (keys.length === 0) throw new Error('没有要插入的列')
    const colSql = keys.map(ident).join(', ')
    const valuesSql = rows.map(r => `(${keys.map(k => (k in r ? p(r[k]) : 'default')).join(', ')})`).join(', ')
    let text = `insert into ${tbl} (${colSql}) values ${valuesSql}`
    if (action === 'upsert') {
      const conflict = (desc.onConflict || 'id').split(',').map(ident).join(', ')
      const updates = keys.filter(k => !(desc.onConflict || 'id').split(',').map(s => s.trim()).includes(k))
      text += updates.length
        ? ` on conflict (${conflict}) do update set ${updates.map(k => `${ident(k)} = excluded.${ident(k)}`).join(', ')}`
        : ` on conflict (${conflict}) do nothing`
    }
    return { text: text + returning, params, kind: 'rows' }
  }

  // update / delete 必须带条件，防止误删全表
  const w = where()
  if (!w) throw new Error(`${action} 必须带过滤条件`)

  if (action === 'update') {
    const vals = (desc.values || {}) as Record<string, unknown>
    const keys = Object.keys(vals)
    if (keys.length === 0) throw new Error('没有要更新的列')
    // 先放 set 的参数，再放 where 的参数
    params.length = 0
    const setSql = keys.map(k => `${ident(k)} = ${p(vals[k])}`).join(', ')
    return { text: `update ${tbl} set ${setSql}${where()}${returning}`, params, kind: 'rows' }
  }

  if (action === 'delete') {
    return { text: `delete from ${tbl}${w}${returning}`, params, kind: 'rows' }
  }

  throw new Error(`不支持的操作: ${action}`)
}
