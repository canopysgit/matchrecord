import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearer, verifyToken } from './auth.js'

export function requireAuth(req: VercelRequest, res: VercelResponse) {
  const user = verifyToken(bearer(req.headers.authorization))
  if (!user) res.status(401).json({ error: '未登录或登录已过期' })
  return user
}

export function fail(res: VercelResponse, err: unknown) {
  const e = err as { message?: string; status?: number }
  res.status(e.status || 400).json({ error: e.message || String(err) })
}

export function body<T>(req: VercelRequest): T {
  return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as T
}
