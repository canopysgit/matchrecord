import { randomUUID } from 'node:crypto'
import type { Db } from './db.js'

type Team = 'white' | 'blue'

export type GoalInput =
  | { team: Team; scorer: string; assist?: string | null }
  | { team: Team; own_goal: true; by?: string | null } // team = 得分（受益）的一方

export interface MatchInput {
  date: string // YYYY-MM-DD
  time?: string
  venue?: string
  match_type?: string
  opponent_team?: string | null
  white: string[]
  blue: string[]
  airdrop?: string[] // 空降：两队都算
  captains?: Partial<Record<Team, string>>
  white_score?: number
  blue_score?: number
  goals?: GoalInput[]
  replace?: boolean // 同一天已有比赛时覆盖
}

export interface RecordResult {
  match_id: string
  match_number: number
  white_score: number
  blue_score: number
  status: 'pending' | 'completed'
  new_players: string[]
  replaced: boolean
  warnings: string[]
}

const OPP: Record<Team, Team> = { white: 'blue', blue: 'white' }
const UNKNOWN = '未知'

export async function resolver(db: Db) {
  const rows = await db.query('select name, aliases from players')
  const exact = new Map<string, string>()
  const lower = new Map<string, string>()
  for (const r of rows) {
    const name = String(r.name)
    exact.set(name, name)
    lower.set(name.toLowerCase(), name)
    for (const a of (r.aliases as string[]) || []) {
      if (!exact.has(a)) exact.set(a, name)
      if (!lower.has(a.toLowerCase())) lower.set(a.toLowerCase(), name)
    }
  }
  const unknown = new Set<string>()
  const resolve = (raw: string) => {
    const n = raw.trim()
    if (!n || n === UNKNOWN) return UNKNOWN
    const hit = exact.get(n) || lower.get(n.toLowerCase())
    if (hit) return hit
    unknown.add(n)
    return n
  }
  return { resolve, unknown }
}

export async function recordMatch(db: Db, input: MatchInput): Promise<RecordResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) throw new Error('date 必须是 YYYY-MM-DD')
  if (!input.white?.length || !input.blue?.length) throw new Error('白队和蓝队名单不能为空')

  const warnings: string[] = []
  const { resolve, unknown } = await resolver(db)
  const uniq = (xs: string[]) => [...new Set(xs.map(resolve).filter(n => n !== UNKNOWN))]

  const captains: Partial<Record<Team, string>> = {}
  for (const t of ['white', 'blue'] as Team[]) if (input.captains?.[t]) captains[t] = resolve(input.captains[t]!)

  const airdrop = uniq(input.airdrop || [])
  const teams: Record<Team, string[]> = { white: uniq(input.white), blue: uniq(input.blue) }
  for (const t of ['white', 'blue'] as Team[]) {
    const c = captains[t]
    if (c && !teams[t].includes(c)) teams[t].unshift(c)
    for (const a of airdrop) if (!teams[t].includes(a)) teams[t].push(a)
  }
  // 两队都出现的人也视为空降
  for (const n of teams.white) if (teams.blue.includes(n) && !airdrop.includes(n)) airdrop.push(n)

  // 进球 → 每人每队一行
  const stats = new Map<string, { player_name: string; team: Team; goals: number; assists: number }>()
  const bump = (name: string, team: Team, field: 'goals' | 'assists') => {
    const key = `${name}|${team}`
    if (!stats.has(key)) stats.set(key, { player_name: name, team, goals: 0, assists: 0 })
    stats.get(key)![field]++
  }
  const goalCount: Record<Team, number> = { white: 0, blue: 0 }
  const ownGoals: Record<Team, number> = { white: 0, blue: 0 } // 某队球员打进的乌龙
  for (const g of input.goals || []) {
    if (g.team !== 'white' && g.team !== 'blue') throw new Error('goal.team 必须是 white 或 blue')
    goalCount[g.team]++
    if ('own_goal' in g && g.own_goal) {
      bump(`OG:${g.by ? resolve(g.by) : UNKNOWN}`, g.team, 'goals')
      ownGoals[OPP[g.team]]++
      continue
    }
    const sg = g as { team: Team; scorer: string; assist?: string | null }
    const scorer = resolve(sg.scorer || '')
    bump(scorer, g.team, 'goals')
    if (scorer !== UNKNOWN && !teams[g.team].includes(scorer)) warnings.push(`${scorer} 进球但不在${g.team === 'white' ? '白' : '蓝'}队名单`)
    if (sg.assist) {
      const a = resolve(sg.assist)
      bump(a, g.team, 'assists')
      if (!teams[g.team].includes(a)) warnings.push(`${a} 助攻但不在${g.team === 'white' ? '白' : '蓝'}队名单`)
    }
  }

  const hasScore = input.white_score != null && input.blue_score != null
  const hasGoals = (input.goals?.length || 0) > 0
  const white_score = hasScore ? Number(input.white_score) : goalCount.white
  const blue_score = hasScore ? Number(input.blue_score) : goalCount.blue
  if (hasScore && hasGoals && (goalCount.white !== white_score || goalCount.blue !== blue_score)) {
    warnings.push(`进球明细 ${goalCount.white}:${goalCount.blue} 与比分 ${white_score}:${blue_score} 不一致`)
  }
  const status = hasScore || hasGoals ? 'completed' : 'pending'

  const existing = await db.query('select id from matches_2026 where match_date = $1', [input.date])
  if (existing.length && !input.replace) {
    throw Object.assign(new Error(`${input.date} 已有比赛，如需覆盖请传 replace: true`), { status: 409 })
  }

  const id = randomUUID()
  const newPlayers = [...unknown]
  const stmts: [string, unknown[]][] = []
  if (existing.length) stmts.push(['delete from matches_2026 where match_date = $1', [input.date]])
  for (const n of newPlayers) {
    stmts.push(["insert into players (name, player_type) values ($1, 'guest') on conflict (name) do nothing", [n]])
  }
  stmts.push([
    `insert into matches_2026 (id, match_date, match_time, match_type, venue, opponent_team, white_score, blue_score,
       white_own_goals, blue_own_goals, status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, input.date, input.time || '18:00-20:00', input.match_type || '内战', input.venue || '机场南楼',
      input.opponent_team ?? null, white_score, blue_score, ownGoals.white, ownGoals.blue, status],
  ])
  for (const t of ['white', 'blue'] as Team[]) {
    for (const n of teams[t]) {
      stmts.push(['insert into match_players_2026 (match_id, player_name, team, is_airdrop) values ($1,$2,$3,$4)',
        [id, n, t, airdrop.includes(n)]])
    }
    if (captains[t]) {
      stmts.push(['insert into match_captains_2026 (match_id, team, captain_name) values ($1,$2,$3)', [id, t, captains[t]]])
    }
  }
  for (const s of stats.values()) {
    stmts.push(['insert into match_stats_2026 (match_id, player_name, team, goals, assists) values ($1,$2,$3,$4,$5)',
      [id, s.player_name, s.team, s.goals, s.assists]])
  }
  // 场次编号按日期重排
  stmts.push([
    `update matches_2026 m set year_match_number = s.rn, match_number = s.rn
     from (select id, row_number() over (order by match_date, created_at) as rn from matches_2026) s
     where m.id = s.id`, []])
  stmts.push(['select match_number from matches_2026 where id = $1', [id]])

  const results = await db.transaction(stmts)
  const last = results[results.length - 1]
  return {
    match_id: id,
    match_number: Number(last?.[0]?.match_number ?? 0),
    white_score, blue_score, status,
    new_players: newPlayers,
    replaced: existing.length > 0,
    warnings,
  }
}
