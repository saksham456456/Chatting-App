'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeChat, setActiveChat] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState('')
  
  // Realtime States
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  
  // UI States
  const [showSettings, setShowSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Initial Load
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/')
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        
      setCurrentUser(profile)
      loadConversations(profile.id)
    }
    init()
  }, [])

  // 2. Load Conversations via RPC
  const loadConversations = async (userId: string) => {
    const { data, error } = await supabase
      .rpc('get_conversations', { current_user_id: userId })
    if (data) setConversations(data)
  }

  // 3. Search Users
  useEffect(() => {
    if (!searchQuery.trim() || !currentUser) {
      setSearchResults([])
      return
    }
    const search = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', currentUser.id)
        .limit(20)
      if (data) setSearchResults(data)
    }
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, currentUser])

  // 4. Load Messages for Active Chat
  useEffect(() => {
    if (!activeChat || !currentUser) return
    
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })
      
      if (data) setMessages(data)
      
      // Mark as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', activeChat.id)
        .eq('receiver_id', currentUser.id)
        .eq('read', false)
    }
    loadMessages()
  }, [activeChat])

  // 5. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Refs for Realtime listeners to avoid resubscribing on state change
  const activeChatRef = useRef(activeChat)
  useEffect(() => { activeChatRef.current = activeChat }, [activeChat])

  // 6. Realtime Subscriptions (DB Changes & Presence)
  useEffect(() => {
    if (!currentUser) return

    // Presence Channel (Online Status & Typing)
    const presenceChannel = supabase.channel('chatty_presence')
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const online = new Set<string>()
        const typing = new Set<string>()
        
        for (const [key, presences] of Object.entries(state)) {
          presences.forEach((p: any) => {
            online.add(p.user_id)
            if (p.is_typing) typing.add(p.user_id)
          })
        }
        setOnlineUsers(online)
        setTypingUsers(typing)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: currentUser.id, is_typing: false })
        }
      })

    // Postgres Changes Channel (New Messages)
    const dbChannel = supabase.channel('chatty_db')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const currentActiveChat = activeChatRef.current

          // If it's a new message
          if (payload.eventType === 'INSERT') {
            const msg = payload.new
            // Add to current chat if relevant
            if (
              currentActiveChat &&
              ((msg.sender_id === currentUser.id && msg.receiver_id === currentActiveChat.id) ||
               (msg.sender_id === currentActiveChat.id && msg.receiver_id === currentUser.id))
            ) {
              setMessages(prev => [...prev, msg])
              
              // Mark as read immediately if we received it
              if (msg.sender_id === currentActiveChat.id) {
                supabase.from('messages').update({ read: true }).eq('id', msg.id).then()
              }
            }
            // Reload conversations to update sidebar
            loadConversations(currentUser.id)
          }
          
          // If it's an update (e.g. read receipt)
          if (payload.eventType === 'UPDATE') {
            const msg = payload.new
            setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(dbChannel)
    }
  }, [currentUser]) // activeChat removed to prevent WebSocket re-rendering

  // 7. Handlers
  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value)
    
    // Broadcast typing status
    const presenceChannel = supabase.channel('chatty_presence')
    await presenceChannel.track({ 
      user_id: currentUser.id, 
      is_typing: e.target.value.length > 0 
    })
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !activeChat || !currentUser) return
    
    const text = messageInput.trim()
    setMessageInput('')
    
    // Stop typing
    supabase.channel('chatty_presence').track({ user_id: currentUser.id, is_typing: false })

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: activeChat.id,
      text: text
    })
  }

  const openChat = (user: any) => {
    setActiveChat({
      id: user.id || user.partner_id,
      username: user.username || user.partner_username,
      display_name: user.display_name || user.partner_display_name,
      avatar_url: user.avatar_url || user.partner_avatar
    })
    setSearchQuery('')
  }

  if (!currentUser) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Connecting to Supabase...</div>

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-80 min-w-[320px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
              {currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover"/> : currentUser.display_name[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900 leading-tight">{currentUser.display_name}</div>
              <div className="text-xs text-gray-500">@{currentUser.username}</div>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">⚙️</button>
        </div>
        
        <div className="p-3 border-b border-gray-100">
          <input 
            type="text" 
            placeholder="🔍 Search users..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchQuery ? (
            <div>
              {searchResults.map(user => (
                <div key={user.id} onClick={() => openChat(user)} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover"/> : user.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{user.display_name}</div>
                    <div className="text-sm text-gray-500">@{user.username}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {conversations.map(conv => (
                <div 
                  key={conv.partner_id} 
                  onClick={() => openChat(conv)} 
                  className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-50 transition-colors ${activeChat?.id === conv.partner_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold overflow-hidden">
                      {conv.partner_avatar ? <img src={conv.partner_avatar} alt="" className="w-full h-full object-cover"/> : conv.partner_display_name[0].toUpperCase()}
                    </div>
                    {onlineUsers.has(conv.partner_id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-gray-900 truncate">{conv.partner_display_name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(conv.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm truncate ${conv.unread_count > 0 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                        {conv.last_sender_id === currentUser.id && 'You: '}
                        {typingUsers.has(conv.partner_id) ? <span className="text-blue-500 italic">typing...</span> : conv.last_message}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-50">
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-sm text-sm text-gray-500 font-medium">
              Select a chat to start messaging
            </span>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 bg-white/90 backdrop-blur-md border-b border-gray-200 flex items-center justify-between shrink-0 shadow-sm z-10 relative">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden">
                  {activeChat.avatar_url ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover"/> : activeChat.display_name[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-900 leading-tight">{activeChat.display_name}</div>
                  <div className="text-xs font-medium text-blue-600">
                    {typingUsers.has(activeChat.id) ? 'typing...' : (onlineUsers.has(activeChat.id) ? 'online' : 'offline')}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-0">
              {messages.map(msg => {
                const isMine = msg.sender_id === currentUser.id
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm relative ${isMine ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-900 rounded-tl-sm border border-gray-100'}`}>
                      <p className="text-[15px] leading-relaxed break-words">{msg.text}</p>
                      <div className={`text-[11px] mt-1 text-right flex items-center justify-end gap-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {isMine && (
                          <span className="font-bold tracking-tighter">
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-200 shrink-0 relative z-10">
              <div className="flex gap-2 items-end max-w-4xl mx-auto">
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleTyping}
                  placeholder="Write a message..."
                  className="flex-1 px-4 py-3 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-[15px]"
                />
                <button 
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0"
                >
                  <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-blue-100 text-blue-600 text-4xl font-bold flex items-center justify-center mb-4 overflow-hidden relative group cursor-pointer">
                  {currentUser.avatar_url ? <img src={currentUser.avatar_url} className="w-full h-full object-cover"/> : currentUser.display_name[0].toUpperCase()}
                  <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-sm">
                    Upload
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{currentUser.display_name}</h3>
                <p className="text-sm text-gray-500">@{currentUser.username}</p>
              </div>
              
              <button 
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/')
                }}
                className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
