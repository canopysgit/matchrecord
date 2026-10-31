import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from './_lib/db.js'
import { recordMatch, type MatchInput } from './_lib/record.js'
import { body, fail, requireAuth } from './_lib/http.js'

// 一次性录入整场比赛（名单 + 比分 + 进球），供自动录入使用
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!requireAuth(req, res)) return
  try {
    res.json(await recordMatch(getDb(), body<MatchInput>(req)))
  } catch (err) {
    fail(res, err)
  }
}
