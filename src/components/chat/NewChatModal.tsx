import React, { useState, useEffect } from 'react'
import { X, Search, Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '../ui/Avatar'
import { useChatStore } from '@/store/useChatStore'

export function NewChatModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)
  
  const supabase = createClient()
  const { setActiveChatId, chats } = useChatStore()

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
  }, [query])

  const handleStartChat = async (partnerId: string) => {
    setStartingChat(partnerId)
    const { data: chatId, error } = await supabase.rpc('start_direct_chat', { partner_id: partnerId })
    setStartingChat(null)

    if (chatId) {
      // It might take a moment for the realtime subscription to pull down the chat data.
      // But we can eagerly select it so when it appears, we are on it.
      // Wait, we need the chat to exist in the store. 
      // If the chat doesn't exist yet, we trigger a manual refresh.
      
      const chatExists = chats.find(c => c.chat_id === chatId)
      if (!chatExists) {
        // Fetch manually just in case realtime is slow
        const { data } = await supabase.rpc('get_conversations', { current_user_id: (await supabase.auth.getSession()).data.session?.user.id })
        if (data) useChatStore.getState().setChats(data)
      }
      
      setActiveChatId(chatId)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Chat</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search users by username..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              autoFocus
            />
            <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : query.trim() && results.length === 0 ? (
            <div className="text-center text-slate-500 p-4 text-sm">No users found matching "{query}"</div>
          ) : (
            results.map(user => (
              <div 
                key={user.id} 
                onClick={() => handleStartChat(user.id)}
                className="flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar url={user.avatar_url} name={user.display_name || user.username} />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white leading-none">
                      {user.display_name || user.username}
                    </h3>
                    <span className="text-xs text-slate-500">@{user.username}</span>
                  </div>
                </div>
                {startingChat === user.id ? (
                  <Loader2 size={18} className="animate-spin text-blue-500" />
                ) : (
                  <UserPlus size={18} className="text-slate-400" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
