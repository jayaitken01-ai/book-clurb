import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'
import { applyTheme } from './theme.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user) => {
    if (!user?.id) {
      setProfile(null)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      setProfile(data)
      // Your colours follow you between devices.
      applyTheme({ accent: data.theme, mode: data.dark_mode })
      return
    }

    // Signed in, but no profile row. That happens if the database was
    // rebuilt after this account was created — the sign-up trigger only
    // fires for new accounts. Rather than leaving them stuck on a blank
    // app, put the profile back from what Supabase already knows.
    const meta = user.user_metadata ?? {}
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        // Deliberately no email — it lives in the auth session, not here.
        full_name: meta.full_name || user.email?.split('@')[0] || 'New member',
        phone: meta.phone ?? null,
      })
      .select()
      .maybeSingle()

    setProfile(created ?? null)
  }, [])

  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user)
      if (alive) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      // Don't await inside the callback — Supabase warns against it.
      loadProfile(newSession?.user)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: () => loadProfile(session?.user),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
