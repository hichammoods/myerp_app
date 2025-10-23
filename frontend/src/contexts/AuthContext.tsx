import React, { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'sales'
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('token')
    if (token) {
      // In production, validate token with backend
      // For now, simulate a logged-in user
      setUser({
        id: '1',
        email: 'admin@myerp.fr',
        name: 'Administrateur',
        role: 'admin'
      })
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // In production, make API call to backend
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        // For development, allow demo login
        if (email === 'admin@myerp.fr' && password === 'admin') {
          const demoUser = {
            id: '1',
            email: 'admin@myerp.fr',
            name: 'Administrateur',
            role: 'admin' as const
          }
          setUser(demoUser)
          localStorage.setItem('token', 'demo-token')
          return
        }
        throw new Error('Identifiants invalides')
      }

      const data = await response.json()
      setUser(data.user)
      localStorage.setItem('token', data.token)
    } catch (error) {
      // Allow demo login for testing
      if (email === 'admin@myerp.fr' && password === 'admin') {
        const demoUser = {
          id: '1',
          email: 'admin@myerp.fr',
          name: 'Administrateur',
          role: 'admin' as const
        }
        setUser(demoUser)
        localStorage.setItem('token', 'demo-token')
        return
      }
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}