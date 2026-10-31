import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkPassword, issueToken } from './_lib/auth.js'
import { body, fail } from './_lib/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { email, password } = body<{ email?: string; password?: string }>(req)
    if (!email || !password || !checkPassword(email, password)) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }
    res.json({ token: issueToken(email.trim().toLowerCase()), email: email.trim().toLowerCase() })
  } catch (err) {
    fail(res, err)
  }
}
