import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from './_lib/db.js'
import { fail } from './_lib/http.js'

const TABLES = ['players', 'matches_2026', 'match_players_2026', 'match_stats_2026', 'match_captains_2026']

// 全量导出（数据本来就是公开可读的）
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const db = getDb()
    const out: Record<string, unknown> = { exported_at: new Date().toISOString() }
    for (const t of TABLES) out[t] = await db.query(`select * from "${t}" order by 1`)
    res.setHeader('Cache-Control', 'no-store')
    res.json(out)
  } catch (err) {
    fail(res, err)
  }
}
