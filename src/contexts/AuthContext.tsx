import { createContext, useContext, useState, type ReactNode } from 'react'
import { getToken, setToken } from '../lib/db'

interface Session {
  user: { email: string }
  token: string
}

interface AuthCtx {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

// token 形如 base64url(payload).签名，前端只读取过期时间和邮箱，真正校验在服务端
function sessionFromToken(token: string | null): Session | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return { user: { email: String(payload.sub) }, token }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = sessionFromToken(getToken())
    if (!s) setToken(null)
    return s
  })

  const signIn = async (email: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.token) throw new Error(json.error || '登录失败')
    setToken(json.token)
    setSession(sessionFromToken(json.token))
  }

  const signOut = async () => {
    setToken(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading: false, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
