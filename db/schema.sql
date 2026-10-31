-- 丛莱梅蔬果足球队 · Neon Postgres schema (2026 赛季)
-- 用法: psql "$DATABASE_URL" -f db/schema.sql   (或 node scripts/import-2026.mjs 会自动执行)

create table if not exists players (
  id serial primary key,
  name text not null unique,
  player_type text not null default 'regular' check (player_type in ('regular', 'guest')),
  is_active boolean not null default true,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists matches_2026 (
  id uuid primary key default gen_random_uuid(),
  match_date date not null,
  match_time text,
  match_type text not null default '内战',
  venue text,
  white_score int not null default 0,
  blue_score int not null default 0,
  white_own_goals int not null default 0,
  blue_own_goals int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  year_match_number int,
  match_number int,
  opponent_team text,
  created_at timestamptz not null default now()
);

create table if not exists match_players_2026 (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches_2026(id) on delete cascade,
  player_name text not null,
  team text not null check (team in ('white', 'blue')),
  is_airdrop boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists match_stats_2026 (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches_2026(id) on delete cascade,
  player_name text not null,
  team text not null check (team in ('white', 'blue')),
  goals int not null default 0,
  assists int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists match_captains_2026 (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches_2026(id) on delete cascade,
  team text not null check (team in ('white', 'blue')),
  captain_name text not null,
  unique (match_id, team)
);

create index if not exists idx_mp2026_match on match_players_2026(match_id);
create index if not exists idx_ms2026_match on match_stats_2026(match_id);

-- 统计改为视图：录完比赛即实时更新，不再需要“重新计算”
create or replace view player_stats_2026 as
with done as (
  select id, match_type from matches_2026 where status = 'completed'
),
att as (
  select distinct mp.match_id, mp.player_name, d.match_type
  from match_players_2026 mp join done d on d.id = mp.match_id
),
a as (
  select player_name,
    count(*)::int as attendance_total,
    count(*) filter (where match_type = '内战')::int as attendance_internal,
    count(*) filter (where match_type <> '内战')::int as attendance_external
  from att group by player_name
),
g as (
  select ms.player_name,
    sum(ms.goals)::int as goals_total,
    coalesce(sum(ms.goals) filter (where d.match_type = '内战'), 0)::int as goals_internal,
    coalesce(sum(ms.goals) filter (where d.match_type <> '内战'), 0)::int as goals_external,
    sum(ms.assists)::int as assists_total,
    coalesce(sum(ms.assists) filter (where d.match_type = '内战'), 0)::int as assists_internal,
    coalesce(sum(ms.assists) filter (where d.match_type <> '内战'), 0)::int as assists_external
  from match_stats_2026 ms join done d on d.id = ms.match_id
  group by ms.player_name
)
select
  (row_number() over (order by a.player_name))::int as id,
  a.player_name,
  a.attendance_total, a.attendance_internal, a.attendance_external,
  coalesce(g.goals_total, 0) as goals_total,
  coalesce(g.goals_internal, 0) as goals_internal,
  coalesce(g.goals_external, 0) as goals_external,
  coalesce(g.assists_total, 0) as assists_total,
  coalesce(g.assists_internal, 0) as assists_internal,
  coalesce(g.assists_external, 0) as assists_external
from a left join g on g.player_name = a.player_name;

-- 胜率：只算已完成的内战；空降（同场两队都有）不计
create or replace view player_winrate_2026 as
with done as (
  select id, white_score, blue_score from matches_2026
  where status = 'completed' and match_type = '内战'
),
pm as (
  select mp.match_id, mp.player_name, min(mp.team) as team, count(distinct mp.team) as n_team
  from match_players_2026 mp join done d on d.id = mp.match_id
  group by mp.match_id, mp.player_name
),
r as (
  select pm.player_name,
    case
      when d.white_score = d.blue_score then 'D'
      when (pm.team = 'white') = (d.white_score > d.blue_score) then 'W'
      else 'L'
    end as res
  from pm join done d on d.id = pm.match_id
  where pm.n_team = 1
),
agg as (
  select player_name,
    count(*)::int as total_matches,
    count(*) filter (where res = 'W')::int as wins,
    count(*) filter (where res = 'D')::int as draws,
    count(*) filter (where res = 'L')::int as losses
  from r group by player_name
)
select
  (row_number() over (order by agg.player_name))::int as id,
  agg.player_name,
  coalesce(p.player_type, 'regular') as player_type,
  agg.total_matches, agg.wins, agg.draws, agg.losses,
  round(agg.wins * 100.0 / agg.total_matches, 2)::float8 as win_rate
from agg left join players p on p.name = agg.player_name;
