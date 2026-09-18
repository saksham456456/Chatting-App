'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuidv4 } from 'uuid'

// --- SVG Icons for Polish ---
const Icons = {
  Settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>,
  Search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>,
  Send: <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>,
  Attach: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>,
  Edit: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>,
  Delete: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>,
  Check: <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>,
  DoubleCheck: <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7M5 18l4-4m10-6l-4 4"></path></svg>,
  Image: <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
  Close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
}

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
  
  // Feature States
  const [editingMessage, setEditingMessage] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileBio, setProfileBio] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

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
      setProfileName(profile.display_name || '')
      setProfileBio(profile.bio || '')
      loadConversations(profile.id)
    }
    init()
  }, [])

  // 2. Load Conversations via RPC
  const loadConversations = async (userId: string) => {
    const { data } = await supabase
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
    setEditingMessage(null) 
    setMessageInput('')
  }, [activeChat])

  // 5. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeChatRef = useRef(activeChat)
  useEffect(() => { activeChatRef.current = activeChat }, [activeChat])

  // 6. Realtime Subscriptions
  useEffect(() => {
    if (!currentUser) return

    const presenceChannel = supabase.channel('chatty_presence')
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const online = new Set<string>()
        const typing = new Set<string>()
        for (const presences of Object.values(state)) {
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

    const dbChannel = supabase.channel('chatty_db')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const currentActiveChat = activeChatRef.current
          
          if (payload.eventType === 'INSERT') {
            const msg = payload.new
            if (
              currentActiveChat &&
              ((msg.sender_id === currentUser.id && msg.receiver_id === currentActiveChat.id) ||
               (msg.sender_id === currentActiveChat.id && msg.receiver_id === currentUser.id))
            ) {
              setMessages(prev => [...prev, msg])
              if (msg.sender_id === currentActiveChat.id) {
                supabase.from('messages').update({ read: true }).eq('id', msg.id).then()
              }
            }
            loadConversations(currentUser.id)
          }
          
          if (payload.eventType === 'UPDATE') {
            const msg = payload.new
            setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
            loadConversations(currentUser.id) 
          }

          if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
            loadConversations(currentUser.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(dbChannel)
    }
  }, [currentUser])

  // 7. Core Handlers
  const handleTyping = (text: string) => {
    setMessageInput(text)
    supabase.channel('chatty_presence').track({ 
      user_id: currentUser.id, 
      is_typing: text.length > 0 
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e as unknown as React.FormEvent)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e?.preventDefault()
    if (!messageInput.trim() || !activeChat || !currentUser) return
    
    const text = messageInput.trim()
    setMessageInput('')
    supabase.channel('chatty_presence').track({ user_id: currentUser.id, is_typing: false })

    if (editingMessage) {
      await supabase.from('messages')
        .update({ text, is_edited: true })
        .eq('id', editingMessage.id)
      setEditingMessage(null)
    } else {
      await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: activeChat.id,
        text: text
      })
    }
  }

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message for everyone?')) return
    await supabase.from('messages').delete().eq('id', id)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChat || !currentUser) return
    
    setIsUploading(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `attachments/${uuidv4()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('chat_media')
      .upload(filePath, file)
      
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setIsUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat_media')
      .getPublicUrl(filePath)

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: activeChat.id,
      text: '', 
      attachment_url: publicUrl
    })
    
    setIsUploading(false)
  }

  const handleProfileUpdate = async () => {
    const updates = {
      display_name: profileName,
      bio: profileBio,
    }
    await supabase.from('profiles').update(updates).eq('id', currentUser.id)
    setCurrentUser({ ...currentUser, ...updates })
    setShowSettings(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileExt = file.name.split('.').pop()
    const filePath = `avatars/${currentUser.id}.${fileExt}`
    
    await supabase.storage
      .from('chat_media')
      .upload(filePath, file, { upsert: true })

    const { data: { publicUrl } } = supabase.storage
      .from('chat_media')
      .getPublicUrl(filePath)

    const finalUrl = `${publicUrl}?t=${Date.now()}`

    await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', currentUser.id)
    setCurrentUser({ ...currentUser, avatar_url: finalUrl })
  }

  if (!currentUser) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Connecting to Supabase...</div>

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-80 min-w-[320px] bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
        <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden cursor-pointer shadow-sm hover:opacity-80 transition-opacity"
              onClick={() => setShowSettings(true)}
            >
              {currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover"/> : currentUser.display_name[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900 leading-tight">{currentUser.display_name}</div>
              <div className="text-xs text-gray-500 font-medium">@{currentUser.username}</div>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
            {Icons.Settings}
          </button>
        </div>
        
        <div className="p-3 border-b border-gray-100 bg-white">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {Icons.Search}
            </div>
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchQuery ? (
            <div>
              {searchResults.map(user => (
                <div key={user.id} onClick={() => { setActiveChat(user); setSearchQuery('') }} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
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
              {conversations.map(conv => {
                const cUser = {
                  id: conv.partner_id,
                  username: conv.partner_username,
                  display_name: conv.partner_display_name,
                  avatar_url: conv.partner_avatar
                }
                
                return (
                  <div 
                    key={conv.partner_id} 
                    onClick={() => setActiveChat(cUser)} 
                    className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-50 transition-colors ${activeChat?.id === conv.partner_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold overflow-hidden shadow-sm">
                        {conv.partner_avatar ? <img src={conv.partner_avatar} alt="" className="w-full h-full object-cover"/> : conv.partner_display_name[0].toUpperCase()}
                      </div>
                      {onlineUsers.has(conv.partner_id) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold text-gray-900 truncate">{conv.partner_display_name}</span>
                        <span className="text-[11px] font-medium text-gray-400 shrink-0">
                          {new Date(conv.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-[13px] truncate flex items-center ${conv.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                          {conv.last_sender_id === currentUser.id && <span className="text-blue-500 mr-1">{conv.unread_count === 0 ? Icons.DoubleCheck : Icons.Check}</span>}
                          {typingUsers.has(conv.partner_id) ? <span className="text-blue-500 italic">typing...</span> : 
                            (conv.last_attachment_url ? <>{Icons.Image} Photo</> : conv.last_message)
                          }
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="bg-blue-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#e5ddd5]">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-40 pointer-events-none mix-blend-overlay"></div>
        
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center z-10">
            <span className="bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-sm text-sm text-gray-600 font-medium border border-gray-200">
              Select a chat to start messaging
            </span>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                  {activeChat.avatar_url ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover"/> : activeChat.display_name[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-900 leading-tight">{activeChat.display_name}</div>
                  <div className="text-[13px] font-medium text-gray-500">
                    {typingUsers.has(activeChat.id) ? <span className="text-blue-600">typing...</span> : (onlineUsers.has(activeChat.id) ? 'online' : 'offline')}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 relative z-10">
              {messages.map(msg => {
                const isMine = msg.sender_id === currentUser.id
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                    
                    {/* Hover Actions (Edit/Delete) */}
                    {isMine && (
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-2 gap-1 bg-white/80 backdrop-blur-sm rounded-lg px-2 shadow-sm border border-gray-100 h-8 mt-1">
                        {!msg.attachment_url && (
                          <button onClick={() => {
                            setEditingMessage(msg)
                            setMessageInput(msg.text)
                          }} className="text-gray-400 hover:text-blue-600 p-1" title="Edit">
                            {Icons.Edit}
                          </button>
                        )}
                        <button onClick={() => deleteMessage(msg.id)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
                          {Icons.Delete}
                        </button>
                      </div>
                    )}

                    <div className={`max-w-[75%] px-3 py-2 shadow-sm relative flex flex-col ${isMine ? 'bg-[#dcf8c6] text-gray-900 rounded-2xl rounded-tr-sm' : 'bg-white text-gray-900 rounded-2xl rounded-tl-sm border border-gray-100'}`}>
                      
                      {msg.attachment_url && (
                        <div className="mb-1 -mx-2 -mt-1 overflow-hidden rounded-t-xl cursor-pointer hover:opacity-95 transition-opacity bg-black/5">
                          <img src={msg.attachment_url} alt="Attachment" className="max-h-72 object-contain w-full" />
                        </div>
                      )}
                      
                      {msg.text && (
                        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap px-1">{msg.text}</p>
                      )}

                      <div className={`text-[11px] mt-1 self-end flex items-center gap-1 text-gray-500 font-medium`}>
                        {msg.is_edited && <span className="italic mr-1">(edited)</span>}
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {isMine && (
                          <span className={msg.read ? 'text-blue-500' : 'text-gray-400'}>
                            {msg.read ? Icons.DoubleCheck : Icons.Check}
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
            <form onSubmit={sendMessage} className="bg-gray-100 border-t border-gray-200 shrink-0 relative z-20">
              {editingMessage && (
                <div className="w-full bg-white px-6 py-3 text-sm flex justify-between items-center border-b border-gray-200 shadow-sm absolute bottom-full left-0">
                  <div className="flex items-center gap-2 text-blue-600 font-medium">
                    {Icons.Edit}
                    <span>Editing message</span>
                  </div>
                  <button type="button" onClick={() => { setEditingMessage(null); setMessageInput('') }} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors">
                    {Icons.Close}
                  </button>
                </div>
              )}
              
              <div className="flex items-end max-w-5xl mx-auto p-4 gap-3">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-50 mb-1"
                  title="Attach Image"
                >
                  {Icons.Attach}
                </button>

                <div className="flex-1 bg-white rounded-2xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm flex items-center min-h-[44px]">
                  {isUploading ? (
                    <div className="flex-1 px-4 py-3 text-gray-400 italic text-sm animate-pulse">Uploading attachment...</div>
                  ) : (
                    <textarea
                      value={messageInput}
                      onChange={e => handleTyping(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 px-4 py-3 bg-transparent border-none focus:ring-0 outline-none text-[15px] resize-none max-h-32"
                      style={{ minHeight: '44px' }}
                    />
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={!messageInput.trim() || isUploading}
                  className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0 shadow-sm mb-1"
                >
                  {Icons.Send}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                {Icons.Close}
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex flex-col items-center mb-6">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={avatarInputRef}
                  onChange={handleAvatarUpload}
                />
                <div 
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-28 h-28 rounded-full bg-blue-100 text-blue-600 text-4xl font-bold flex items-center justify-center mb-4 overflow-hidden relative group cursor-pointer shadow-md border-4 border-white"
                >
                  {currentUser.avatar_url ? <img src={currentUser.avatar_url} className="w-full h-full object-cover"/> : currentUser.display_name[0].toUpperCase()}
                  <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center text-white text-sm font-medium transition-all">
                    Change
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-medium">@{currentUser.username}</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={profileBio}
                    onChange={e => setProfileBio(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Tell everyone a little about yourself..."
                  />
                </div>
                
                <button 
                  onClick={handleProfileUpdate}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm mt-2"
                >
                  Save Changes
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
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
