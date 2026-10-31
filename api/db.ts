import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from './_lib/db.js'
import { buildQuery, isWrite, type QueryDesc } from './_lib/query.js'
import { body, fail, requireAuth } from './_lib/http.js'

// 通用查询接口：读公开，写需要登录
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const desc = body<QueryDesc>(req)
    if (isWrite(desc) && !requireAuth(req, res)) return
    const q = buildQuery(desc)
    const rows = await getDb().query(q.text, q.params)
    if (q.kind === 'count') return res.json({ data: null, count: Number(rows[0]?.count ?? 0) })
    res.json({ data: rows })
  } catch (err) {
    fail(res, err)
  }
}
