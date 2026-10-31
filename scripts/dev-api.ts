// 本地开发用：用 PGlite 模拟数据库，跑 /api/* 函数（端口 8787），vite 把 /api 代理过来。
// 用法: npx tsx scripts/dev-api.ts   （若设置了 DATABASE_URL 则直接连 Neon）
import { createServer } from 'node:http'
import { PGlite } from '@electric-sql/pglite'
import { setDb, type Db } from '../api/_lib/db.js'
import { importSeason } from './import-2026.js'

process.env.AUTH_SECRET ||= 'dev-secret'
process.env.ADMIN_EMAIL ||= 'admin@example.com'
process.env.ADMIN_PASSWORD ||= 'dev-password'

if (!process.env.DATABASE_URL) {
  const pg = new PGlite({ parsers: { 1082: (v: string) => v } })
  const db: Db = {
    query: async (t, p = []) => (await pg.query(t, p)).rows as Record<string, unknown>[],
    transaction: async stmts => pg.transaction(async tx => {
      const out = []
      for (const [t, p] of stmts) out.push((await tx.query(t, p)).rows as Record<string, unknown>[])
      return out
    }),
  }
  setDb(db)
  await importSeason(db, { log: () => {} })
  console.log('PGlite 已导入 2026 数据')
}

const routes = ['db', 'login', 'record-match', 'kimi', 'backup']
createServer(async (req, res) => {
  const name = (req.url || '').replace(/^\/api\//, '').split('?')[0]
  if (!routes.includes(name)) { res.statusCode = 404; return res.end('not found') }
  let raw = ''
  for await (const c of req) raw += c
  const vreq = Object.assign(req, { body: raw ? JSON.parse(raw) : undefined })
  const vres = Object.assign(res, {
    status(code: number) { res.statusCode = code; return vres },
    json(obj: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return vres },
  })
  const mod = await import(`../api/${name}.ts`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mod.default(vreq as any, vres as any)
}).listen(8787, () => console.log('api on :8787'))
