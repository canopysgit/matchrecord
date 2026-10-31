import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_DAYS = 30

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('缺少 AUTH_SECRET 环境变量')
  return s
}

const b64 = (s: string) => Buffer.from(s).toString('base64url')
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function checkPassword(email: string, password: string) {
  const e = process.env.ADMIN_EMAIL || '', p = process.env.ADMIN_PASSWORD || ''
  if (!e || !p) throw new Error('服务器未配置管理员账号')
  return safeEqual(email.trim().toLowerCase(), e.trim().toLowerCase()) && safeEqual(password, p)
}

export function issueToken(email: string) {
  const payload = b64(JSON.stringify({ sub: email, exp: Date.now() + TOKEN_DAYS * 86400_000 }))
  return `${payload}.${sign(payload)}`
}

// 接受登录签发的 token，或 API_KEY（给自动录入用）
export function verifyToken(token: string | undefined | null): { sub: string } | null {
  if (!token) return null
  const apiKey = process.env.API_KEY
  if (apiKey && safeEqual(token, apiKey)) return { sub: 'api' }
  const [payload, sig] = token.split('.')
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return { sub: String(data.sub) }
  } catch {
    return null
  }
}

export function bearer(header: string | string[] | undefined) {
  const h = Array.isArray(header) ? header[0] : header
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}
