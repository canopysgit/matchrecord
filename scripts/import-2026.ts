// 建表 + 导入 2026 赛季数据到 Neon
// 用法: DATABASE_URL='postgres://...' npx tsx scripts/import-2026.ts [--reset]
import { readFileSync } from 'node:fs'
import { getDb, type Db } from '../api/_lib/db.js'
import { recordMatch, type MatchInput } from '../api/_lib/record.js'

interface SeasonFile {
  players: { name: string; player_type: 'regular' | 'guest'; aliases: string[] }[]
  matches: (MatchInput & { type?: string })[]
}

export async function importSeason(db: Db, opts: { reset?: boolean; log?: (s: string) => void } = {}) {
  const log = opts.log || console.log
  const root = new URL('..', import.meta.url)
  const schema = readFileSync(new URL('db/schema.sql', root), 'utf8')
  const data: SeasonFile = JSON.parse(readFileSync(new URL('data/season2026.json', root), 'utf8'))

  if (opts.reset) {
    await db.query('drop view if exists player_stats_2026, player_winrate_2026')
    await db.query('drop table if exists match_captains_2026, match_stats_2026, match_players_2026, matches_2026, players cascade')
  }
  // 逐条执行建表语句（HTTP 驱动一次只能跑一条）
  for (const stmt of splitSql(schema)) await db.query(stmt)
  log('schema ok')

  for (const p of data.players) {
    await db.query(
      `insert into players (name, player_type, aliases) values ($1, $2, $3)
       on conflict (name) do update set aliases = excluded.aliases`,
      [p.name, p.player_type, p.aliases],
    )
  }
  log(`players: ${data.players.length}`)

  for (const m of data.matches) {
    const r = await recordMatch(db, { ...m, match_type: m.match_type || m.type, replace: true })
    log(`${m.date} #${r.match_number} 白${r.white_score}:${r.blue_score}蓝` +
      (r.new_players.length ? ` 新球员:${r.new_players.join(',')}` : '') +
      (r.warnings.length ? ` 警告:${r.warnings.join('; ')}` : ''))
  }
}

export function splitSql(sql: string) {
  return sql
    .replace(/--.*$/gm, '')
    .split(/;\s*(?:\n|$)/)
    .map(s => s.trim())
    .filter(Boolean)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importSeason(getDb(), { reset: process.argv.includes('--reset') })
    .then(() => console.log('done'))
    .catch(e => { console.error(e); process.exit(1) })
}
