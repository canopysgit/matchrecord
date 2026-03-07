const KIMI_API_KEY = 'sk-k8rA168bRacxAM8aDbOZGpcke0jPsX2SgRwV5i0DzCqMDkpj'
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1'

interface KimiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callKimi(messages: KimiMessage[]): Promise<string> {
  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Kimi API error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function parseRosterText(
  text: string,
  playerNames: string[],
  aliasMap: Record<string, string>
): Promise<string> {
  const aliasInfo = Object.entries(aliasMap)
    .map(([alias, canonical]) => `"${alias}" -> "${canonical}"`)
    .join(', ')

  const messages: KimiMessage[] = [
    {
      role: 'system',
      content: `你是一个足球比赛数据解析助手。你需要从用户提供的非标准文本中提取比赛报名信息。

已知球员标准名: ${playerNames.join(', ')}
已知别名映射: ${aliasInfo}

请严格按照以下JSON格式返回，不要包含其他文字：
{
  "date": "YYYY-MM-DD",
  "time": "时间段，如2-4、4-6、8-10",
  "venue": "场地名称",
  "matchType": "内战或外战",
  "whiteTeam": ["球员标准名1", "球员标准名2"],
  "blueTeam": ["球员标准名1", "球员标准名2"],
  "whiteCaptain": "白队队长标准名或null",
  "blueCaptain": "蓝队队长标准名或null",
  "airDropPlayers": ["空降球员标准名"],
  "unknownPlayers": ["无法匹配的球员原始名称"]
}

规则:
1. 球员名称必须转换为标准名（通过别名映射）
2. 如果球员名称无法匹配任何已知球员或别名，放入unknownPlayers
3. 队长通常标注在队名旁边，如"一陶（白）"表示一陶是白队队长
4. 日期格式可能是20260110这样的，转成2026-01-10
5. 场地如"南楼"应理解为"机场南楼"
6. 空降球员（如"空降：毛毛"）要特别标注
7. 没有明确标注队长的返回null`,
    },
    {
      role: 'user',
      content: text,
    },
  ]

  return callKimi(messages)
}

export async function parseResultText(
  text: string,
  whitePlayers: string[],
  bluePlayers: string[],
  aliasMap: Record<string, string>
): Promise<string> {
  const aliasInfo = Object.entries(aliasMap)
    .map(([alias, canonical]) => `"${alias}" -> "${canonical}"`)
    .join(', ')

  const messages: KimiMessage[] = [
    {
      role: 'system',
      content: `你是一个足球比赛数据解析助手。你需要从用户提供的非标准文本中提取比赛结果数据。

白队球员: ${whitePlayers.join(', ')}
蓝队球员: ${bluePlayers.join(', ')}
已知别名映射: ${aliasInfo}

请严格按照以下JSON格式返回，不要包含其他文字：
{
  "whiteScore": 数字,
  "blueScore": 数字,
  "whiteOwnGoals": 数字,
  "blueOwnGoals": 数字,
  "events": [
    {
      "scorer": "进球球员标准名",
      "assister": "助攻球员标准名或null",
      "team": "white或blue",
      "isOwnGoal": false
    }
  ]
}

规则:
1. 球员名称必须转换为标准名
2. 根据球员所在队伍确定team字段
3. 进球助攻格式多变，可能是"马指进球"、"井助攻，一陶进球"、"小z进球 马指助攻"等
4. 乌龙球标注isOwnGoal为true，scorer填"乌龙球"，team填被乌龙的队伍（即实际得分的队伍的对手）
5. "白队乌龙"意味着白队球员踢进自己球门，蓝队得分，对应blueOwnGoals+1
6. 比分通常是"蓝9:7白"或"白5:4蓝"这样的格式
7. 每个进球事件只代表1个进球（不管球员进了几球，每球一条记录）`,
    },
    {
      role: 'user',
      content: text,
    },
  ]

  return callKimi(messages)
}
