import type { VercelRequest, VercelResponse } from '@vercel/node'
import { body, fail, requireAuth } from './_lib/http.js'

// Kimi 代理：key 只放在服务端环境变量里
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!requireAuth(req, res)) return
  try {
    const key = process.env.KIMI_API_KEY
    if (!key) throw new Error('服务器未配置 KIMI_API_KEY')
    const { messages } = body<{ messages: unknown[] }>(req)
    const r = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'moonshot-v1-8k', messages, temperature: 0.1 }),
    })
    const data = await r.json()
    if (!r.ok) throw Object.assign(new Error(data?.error?.message || `Kimi ${r.status}`), { status: 502 })
    res.json({ content: data.choices?.[0]?.message?.content ?? '' })
  } catch (err) {
    fail(res, err)
  }
}
