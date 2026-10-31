// 本地用 PGlite（内存 Postgres）跑一遍：建表、导入、通用查询、录入比赛
import { PGlite } from '@electric-sql/pglite'
import { setDb, type Db } from '../api/_lib/db.js'
import { buildQuery, type QueryDesc } from '../api/_lib/query.js'
import { recordMatch } from '../api/_lib/record.js'
import { importSeason } from './import-2026.js'

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
const q = async (d: QueryDesc) => { const b = buildQuery(d); return db.query(b.text, b.params) }

await importSeason(db, { log: () => {} })
const top = await q({ table: 'player_stats_2026', action: 'select', order: [['goals_total', false]], limit: 5 })
console.log('射手榜', top.map(r => `${r.player_name} ${r.goals_total}球/${r.assists_total}助/${r.attendance_total}场`).join(' | '))
const wr = await q({ table: 'player_winrate_2026', action: 'select', order: [['win_rate', false]], limit: 5 })
console.log('胜率', wr.map(r => `${r.player_name} ${r.win_rate}% (${r.wins}/${r.total_matches})`).join(' | '))
const cnt = await q({ table: 'matches_2026', action: 'select', count: true, head: true })
console.log('比赛场数', cnt[0].count)
const last = await q({ table: 'matches_2026', action: 'select', order: [['match_date', false]], limit: 1 })
console.log('最新', last[0].match_date, last[0].match_number, last[0].white_score, last[0].blue_score, last[0].venue, last[0].match_time)
// 录入测试 + 覆盖
const r = await recordMatch(db, {
  date: '2026-11-07', white: ['小z', '阿曼', '新人甲'], blue: ['井', '扇子', '霏赫'], captains: { white: '老朱' },
  white_score: 2, blue_score: 1,
  goals: [{ team: 'white', scorer: '小z', assist: '阿曼' }, { team: 'white', own_goal: true, by: '霏赫' }, { team: 'blue', scorer: '井' }],
})
console.log('录入', r)
const og = await q({ table: 'matches_2026', action: 'select', columns: 'white_own_goals, blue_own_goals', filters: [['eq', 'id', r.match_id]] })
console.log('乌龙', og[0])
await q({ table: 'matches_2026', action: 'delete', filters: [['eq', 'id', r.match_id]] })
const left = await q({ table: 'match_players_2026', action: 'select', count: true, head: true, filters: [['eq', 'match_id', r.match_id]] })
console.log('删除后残留球员行', left[0].count)
try { buildQuery({ table: 'players; drop', action: 'select' }) } catch (e) { console.log('拦截:', (e as Error).message) }
try { buildQuery({ table: 'players', action: 'delete' }) } catch (e) { console.log('拦截:', (e as Error).message) }
try { buildQuery({ table: 'player_stats_2026', action: 'insert', values: { a: 1 } }) } catch (e) { console.log('拦截:', (e as Error).message) }
