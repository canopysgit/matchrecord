# 丛莱梅蔬果足球队 · 比赛记录

React + Vite 前端，Vercel Serverless Functions（`/api`）+ Neon Postgres。

## 目录
- `src/` 前端；`src/lib/db.ts` 是链式查询客户端，请求发到 `/api/db`
- `api/` 服务端函数：`db`（通用查询，读公开、写需登录）、`login`、`record-match`（整场录入）、`kimi`（AI 解析代理）、`backup`（全量导出）
- `db/schema.sql` 表结构；球员统计和胜率是视图，录完即更新
- `data/season2026.json` 2026 赛季原始数据（也是备份）

## 环境变量
见 `.env.example`，在 Vercel 项目里配置。

## 常用命令
```bash
npm run dev:api & npm run dev       # 本地开发（无 NEON_DATABASE_URL 时用内存 Postgres + 2026 数据）
NEON_DATABASE_URL=... npm run db:import  # 建表并导入 2026 数据（加 -- --reset 先清空）
npm run test:local                  # 本地自测
```

## 自动录入一场比赛
```bash
curl -X POST https://clmsg.xiaochaai.com/api/record-match \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"date":"2026-11-07","time":"18:00-20:00","venue":"机场南楼",
       "white":["冯尊","谢先文"],"blue":["井荣山","赵朋"],"captains":{"white":"冯尊","blue":"赵朋"},
       "white_score":1,"blue_score":1,
       "goals":[{"team":"white","scorer":"小z","assist":"阿曼"},{"team":"white","own_goal":true,"by":"井"}]}'
```
昵称会按球员别名自动转成真名；没见过的名字自动建为外援。乌龙球的 `team` 是得分一方。
同一天已有比赛时需加 `"replace": true`。
