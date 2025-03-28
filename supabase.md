# Supabase 数据库结构

## SQL 查询语句

### 查看所有表名
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

### 查看特定表的列结构
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = '表名'
ORDER BY 
    ordinal_position;

### 查询结果：所有表列表
    [
  {
    "table_name": "match_captains"
  },
  {
    "table_name": "match_players"
  },
  {
    "table_name": "match_stats"
  },
  {
    "table_name": "matches"
  },
  {
    "table_name": "player_stats_2024"
  },
  {
    "table_name": "player_stats_2025"
  },
  {
    "table_name": "players"
  },
  {
    "table_name": "regular_player_stats_2025"
  }
]

### 查询结果：matches表结构
[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "uuid_generate_v4()"
  },
  {
    "column_name": "match_date",
    "data_type": "date",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "match_time",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "match_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "venue",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "white_score",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "column_name": "blue_score",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'pending'::text"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "timezone('utc'::text, now())"
  },
  {
    "column_name": "year_match_number",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "match_number",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  }
]