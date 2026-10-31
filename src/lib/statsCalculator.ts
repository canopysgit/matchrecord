// 出勤/进球/助攻统计和胜率现在由数据库视图实时计算
// （见 db/schema.sql 中的 player_stats_2026 / player_winrate_2026），
// 保留这两个函数是为了兼容原有调用，不再需要手动重算。

export async function recalculateStats(_season: number) {}

export async function recalculateWinRate(_season: number) {}
