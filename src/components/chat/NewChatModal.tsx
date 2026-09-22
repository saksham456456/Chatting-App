import React, { useState, useEffect } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '../ui/Avatar'
import { useChatStore } from '@/store/useChatStore'

export function NewChatModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; username: string; display_name: string; avatar_url: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)
  
  const supabase = createClient()
  const { setActiveChatId } = useChatStore()

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      const { data, error } = await supabase.rpc('search_users', { search_query: query })
      if (!error && data) {
        setResults(data)
      }
      setLoading(false)
    }

    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleStartChat = async (userId: string) => {
    setStartingChat(userId)
    const { data, error } = await supabase.rpc('start_direct_chat', { partner_id: userId })
    if (error) {
      console.error('Failed to start chat:', error)
      setStartingChat(null)
      return
    }
    
    // Switch to new chat
    if (data) {
      setActiveChatId(data)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <X size={20} />
          </button>
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">New Chat</h2>
        </div>
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search by username or name..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              autoFocus
            />
            <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin text-blue-500" />
            </div>
          ) : results.length > 0 ? (
            results.map(user => (
              <button
                key={user.id}
                onClick={() => handleStartChat(user.id)}
                disabled={startingChat === user.id}
                className="w-full flex items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
              >
                <Avatar url={user.avatar_url} name={user.display_name || user.username} />
                <div className="ml-3 flex-1">
                  <div className="font-medium text-slate-900 dark:text-white">{user.display_name || user.username}</div>
                  <div className="text-sm text-slate-500">@{user.username}</div>
                </div>
                {startingChat === user.id && <Loader2 size={18} className="animate-spin text-blue-500" />}
              </button>
            ))
          ) : query.trim().length >= 2 ? (
            <div className="text-center text-slate-500 p-8">
              No users found matching &quot;{query}&quot;
            </div>
          ) : (
            <div className="text-center text-slate-500 p-8">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
