"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api, clearAuth, setToken, setRefreshToken, setUserCookie, type User } from "@/lib/api"

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.auth.me()
      setUser(u)
      setUserCookie(u)
    } catch {
      clearAuth()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem("flowmind_user")
    if (stored) {
      try {
        setUser(JSON.parse(stored))
        setIsLoading(false)
        refreshUser()
      } catch {
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password })
    setToken(res.token)
    setRefreshToken(res.refreshToken)
    setUserCookie(res.user)
    localStorage.setItem("flowmind_user", JSON.stringify(res.user))
    setUser(res.user)
  }, [])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await api.auth.register({ email, password, name })
    setToken(res.token)
    setRefreshToken(res.refreshToken)
    setUserCookie(res.user)
    localStorage.setItem("flowmind_user", JSON.stringify(res.user))
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
