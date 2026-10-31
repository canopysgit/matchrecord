// 轻量查询客户端：保持和原来 supabase-js 相同的链式写法，
// 实际请求发到 /api/db（Vercel 函数 → Neon Postgres）。

const TOKEN_KEY = 'matchrecord_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

type FilterOp = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte'
type Action = 'select' | 'insert' | 'update' | 'delete' | 'upsert'
type Row = Record<string, unknown>

export interface DbError { message: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DbResult<T = any[]> { data: T; error: DbError | null; count: number | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Query<T = any[]> implements PromiseLike<DbResult<T>> {
  private action: Action = 'select'
  private columns = '*'
  private filters: [FilterOp, string, unknown][] = []
  private orders: [string, boolean][] = []
  private limitN?: number
  private isSingle = false
  private countMode = false
  private head = false
  private values?: Row | Row[]
  private onConflict?: string
  private returning = false

  private table: string

  constructor(table: string) { this.table = table }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (this.action === 'select') {
      this.columns = columns
      this.countMode = opts?.count === 'exact'
      this.head = !!opts?.head
    } else {
      this.returning = true
      this.columns = columns
    }
    return this
  }
  insert(values: Row | Row[]) { this.action = 'insert'; this.values = values; return this }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.action = 'upsert'; this.values = values; this.onConflict = opts?.onConflict; return this
  }
  update(values: Row) { this.action = 'update'; this.values = values; return this }
  delete() { this.action = 'delete'; return this }

  private f(op: FilterOp, col: string, val: unknown) { this.filters.push([op, col, val]); return this }
  eq(col: string, val: unknown) { return this.f('eq', col, val) }
  neq(col: string, val: unknown) { return this.f('neq', col, val) }
  in(col: string, vals: unknown[]) { return this.f('in', col, vals) }
  gt(col: string, val: unknown) { return this.f('gt', col, val) }
  gte(col: string, val: unknown) { return this.f('gte', col, val) }
  lt(col: string, val: unknown) { return this.f('lt', col, val) }
  lte(col: string, val: unknown) { return this.f('lte', col, val) }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push([col, opts?.ascending ?? true]); return this
  }
  limit(n: number) { this.limitN = n; return this }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single(): Query<any> {
    this.isSingle = true
    if (this.action !== 'select') this.returning = true
    return this
  }

  private async run(): Promise<DbResult<T>> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          table: this.table, action: this.action, columns: this.columns, filters: this.filters,
          order: this.orders, limit: this.isSingle && this.action === 'select' ? 1 : this.limitN,
          count: this.countMode, head: this.head, values: this.values,
          onConflict: this.onConflict, returning: this.returning,
        }),
      })
      const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      if (!res.ok || json.error) return this.result(null, json.error || `HTTP ${res.status}`)
      if (this.countMode && this.head) return { ...this.result(null), count: json.count }
      const rows: Row[] = json.data || []
      if (this.isSingle) {
        if (rows.length !== 1) return this.result(null, '未找到记录')
        return this.result(rows[0])
      }
      return { ...this.result(rows), count: this.countMode ? rows.length : null }
    } catch (e) {
      return this.result(null, e instanceof Error ? e.message : '网络错误')
    }
  }

  private result(data: unknown, error?: string): DbResult<T> {
    return { data: data as T, error: error ? { message: error } : null, count: null }
  }

  then<A = DbResult<T>, B = never>(
    onfulfilled?: ((value: DbResult<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected)
  }
}

export const db = {
  from: (table: string) => new Query(table),
}

export function getTableNames(_season: number) {
  return {
    matches: 'matches_2026',
    matchPlayers: 'match_players_2026',
    matchStats: 'match_stats_2026',
    matchCaptains: 'match_captains_2026',
    playerStats: 'player_stats_2026',
    playerWinrate: 'player_winrate_2026',
  }
}
