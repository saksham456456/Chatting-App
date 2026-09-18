'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type VaultAccount = {
  id: string
  username: string
  displayName: string
  avatarUrl?: string
  access_token: string
  refresh_token: string
}

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [vault, setVault] = useState<VaultAccount[]>([])
  const [mode, setMode] = useState<'vault' | 'login' | 'register'>('vault')
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Username availability
  const [usernameAvailable, setUsernameAvailable] = useState<null | boolean>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [suggestedUsernames, setSuggestedUsernames] = useState<string[]>([])

  const generateRandomUsername = () => {
    const adjectives = ['swift', 'cool', 'dark', 'bright', 'calm', 'bold', 'keen', 'fast', 'wild', 'warm', 'epic', 'neon', 'nova', 'sky', 'zen']
    const nouns = ['fox', 'wolf', 'hawk', 'lynx', 'panda', 'tiger', 'eagle', 'otter', 'raven', 'cobra', 'pixel', 'byte', 'node', 'spark', 'blaze']
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 999)
    return `${adj}_${noun}${num}`
  }

  const generateSuggestions = (base: string) => {
    const suggestions: string[] = []
    for (let i = 0; i < 3; i++) {
      suggestions.push(`${base}${Math.floor(Math.random() * 9999)}`)
    }
    suggestions.push(generateRandomUsername())
    return suggestions
  }

  // Initialize vault on load
  useEffect(() => {
    const saved = localStorage.getItem('chatty_vault')
    if (saved) {
      const accounts = JSON.parse(saved) as VaultAccount[]
      setVault(accounts)
      if (accounts.length === 0) setMode('login')
    } else {
      setMode('login')
    }
  }, [])

  // Check username availability (debounced)
  useEffect(() => {
    if (mode !== 'register' || !username.trim() || username.trim().length < 3) {
      setUsernameAvailable(null)
      setSuggestedUsernames([])
      return
    }
    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      const clean = username.trim().toLowerCase()
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', clean)
        .limit(1)
      if (data && data.length > 0) {
        setUsernameAvailable(false)
        setSuggestedUsernames(generateSuggestions(clean))
      } else {
        setUsernameAvailable(true)
        setSuggestedUsernames([])
      }
      setCheckingUsername(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [username, mode])

  const saveToVault = async (session: any, user: any) => {
    // Fetch profile to get display name and avatar
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const newAccount: VaultAccount = {
      id: user.id,
      username: profile?.username || user.user_metadata.username,
      displayName: profile?.display_name || user.user_metadata.display_name,
      avatarUrl: profile?.avatar_url,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }

    const saved = localStorage.getItem('chatty_vault')
    let accounts: VaultAccount[] = saved ? JSON.parse(saved) : []
    
    // Remove if exists to update with new tokens
    accounts = accounts.filter(a => a.id !== newAccount.id)
    accounts.push(newAccount)
    
    localStorage.setItem('chatty_vault', JSON.stringify(accounts))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const email = `${username.trim().toLowerCase()}@chatty.local`
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session && data.user) {
      await saveToVault(data.session, data.user)
      router.push('/chat')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const email = `${username.trim().toLowerCase()}@chatty.local`
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim().toLowerCase(),
          display_name: displayName.trim() || username.trim(),
        }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session && data.user) {
      await saveToVault(data.session, data.user)
      router.push('/chat')
    } else {
      // If email confirmation was required (it shouldn't be for this setup)
      setError('Registration successful, but session was not created.')
      setLoading(false)
    }
  }

  const loginWithVaultAccount = async (account: VaultAccount) => {
    setLoading(true)
    const { error } = await supabase.auth.setSession({
      access_token: account.access_token,
      refresh_token: account.refresh_token
    })
    
    if (error) {
      // Token might be expired, fallback to password
      setError('Session expired. Please log in again.')
      setMode('login')
      setUsername(account.username)
      setLoading(false)
      // Remove bad account from vault
      const newVault = vault.filter(a => a.id !== account.id)
      setVault(newVault)
      localStorage.setItem('chatty_vault', JSON.stringify(newVault))
    } else {
      router.push('/chat')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl">💬</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Chatty</h1>
          <p className="text-gray-500 mt-1">Real-time messaging, reimagined.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {mode === 'vault' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Welcome Back</h2>
            <div className="space-y-3 mb-6">
              {vault.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => loginWithVaultAccount(acc)}
                  disabled={loading}
                  className="w-full flex items-center p-3 hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                    {acc.avatarUrl ? (
                      <img src={acc.avatarUrl} alt={acc.displayName} className="w-full h-full object-cover" />
                    ) : (
                      acc.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="ml-4 text-left">
                    <div className="font-medium text-gray-900">{acc.displayName}</div>
                    <div className="text-xs text-gray-500">@{acc.username}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMode('login')}
              className="w-full py-3 text-blue-600 font-medium hover:bg-blue-50 rounded-xl transition-colors"
            >
              + Add another account
            </button>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="alice"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-blue-600 text-sm hover:underline"
              >
                Don't have an account? Sign up
              </button>
            </div>
            {vault.length > 0 && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setMode('vault')}
                  className="text-gray-500 text-sm hover:underline"
                >
                  &larr; Back to accounts
                </button>
              </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <button
                  type="button"
                  onClick={() => setUsername(generateRandomUsername())}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  🎲 Random
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  minLength={3}
                  pattern="^[a-zA-Z0-9_]+$"
                  title="Only letters, numbers, and underscores"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className={`w-full px-4 py-2 pr-10 border rounded-xl focus:ring-2 outline-none ${
                    usernameAvailable === true ? 'border-green-400 focus:ring-green-500/20' :
                    usernameAvailable === false ? 'border-red-400 focus:ring-red-500/20' :
                    'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="choose_a_username"
                />
                {username.trim().length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <span className="text-gray-400 text-xs animate-pulse">...</span>
                    ) : usernameAvailable === true ? (
                      <span className="text-green-500">✓</span>
                    ) : usernameAvailable === false ? (
                      <span className="text-red-500">✗</span>
                    ) : null}
                  </div>
                )}
              </div>
              {username.trim().length >= 3 && !checkingUsername && usernameAvailable === true && (
                <p className="text-xs text-green-600 mt-1">@{username.trim().toLowerCase()} is available!</p>
              )}
              {username.trim().length >= 3 && !checkingUsername && usernameAvailable === false && (
                <div className="mt-2">
                  <p className="text-xs text-red-600">@{username.trim().toLowerCase()} is taken. Try:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {suggestedUsernames.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUsername(s)}
                        className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 px-2 py-1 rounded-lg border border-gray-200"
                      >
                        @{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Bob Smith (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Minimum 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading || usernameAvailable === false || checkingUsername}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-blue-600 text-sm hover:underline"
              >
                Already have an account? Log in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
