import { neon, types } from '@neondatabase/serverless'

// date 列原样返回 'YYYY-MM-DD'，不转成 JS Date（前端按字符串用）
types.setTypeParser(1082, (v: string) => v)

export interface Db {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>
  // 一组语句放在同一个事务里执行
  transaction(stmts: [string, unknown[]][]): Promise<Record<string, unknown>[][]>
}

let cached: Db | null = null

export function getDb(): Db {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('缺少 DATABASE_URL 环境变量')
  const sql = neon(url)
  cached = {
    query: (text, params = []) => sql.query(text, params) as Promise<Record<string, unknown>[]>,
    transaction: stmts =>
      sql.transaction(stmts.map(([t, p]) => sql.query(t, p))) as Promise<Record<string, unknown>[][]>,
  }
  return cached
}

// 测试时注入别的实现（例如 PGlite）
export function setDb(db: Db) {
  cached = db
}
