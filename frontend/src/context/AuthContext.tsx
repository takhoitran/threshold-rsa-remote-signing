import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../api/client'

interface User {
  id: string
  username: string
  email: string
  role: string
  employeeId?: string
  unit?: string
  createdAt?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('jwt'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      authApi.me()
        .then((res) => setUser(res.data))
        .catch(() => { sessionStorage.removeItem('jwt'); setToken(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password })
    const { token: jwt } = res.data
    sessionStorage.setItem('jwt', jwt)
    setToken(jwt)
    const me = await authApi.me()
    setUser(me.data)
  }

  const refreshUser = async () => {
    const me = await authApi.me()
    setUser(me.data)
  }

  const logout = () => {
    sessionStorage.removeItem('jwt')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
