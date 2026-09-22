import React, { useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuidv4 } from 'uuid'

export function ChatContainer() {
  const { 
    currentUser, 
    chats, 
    activeChatId, 
    messages, 
    setActiveChatId,
    onlineUsers,
    typingUsers,
    addMessage
  } = useChatStore()
  
  const supabase = createClient()

  // This prevents us from showing "Select a chat" if mobile user presses back
  const chat = chats.find(c => c.chat_id === activeChatId)
  const chatMessages = activeChatId ? (messages[activeChatId] || []) : []

  useEffect(() => {
    // When a chat becomes active, load its messages if we haven't
    if (!activeChatId || !currentUser) return
    
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: true })
        
      if (data) {
        useChatStore.getState().setMessages(activeChatId, data)
      }
      
      // Update our last read receipt
      if (data && data.length > 0) {
        const lastMsgId = data[data.length - 1].id
        await supabase
          .from('chat_participants')
          .update({ last_read_message_id: lastMsgId })
          .eq('chat_id', activeChatId)
          .eq('user_id', currentUser.id)
      }
    }
    
    // Always fetch latest just in case
    fetchMessages()
  }, [activeChatId, currentUser])

  if (!chat || !currentUser) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5] dark:bg-slate-950">
        <div className="bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-full text-slate-500 text-sm">
          Select a chat to start messaging
        </div>
      </div>
    )
  }
  const isOnline = chat.partner_id ? onlineUsers.has(chat.partner_id) : false
  const isTyping = chat.partner_id && activeChatId ? (typingUsers[activeChatId]?.has(chat.partner_id) || false) : false

  const handleSendMessage = async (text: string, file: File | null) => {
    if (!currentUser || !activeChatId) return

    let image_url = null
    if (file) {
      const ext = file.name.split('.').pop()
      const filePath = `${currentUser.id}/${uuidv4()}.${ext}`
      const { error } = await supabase.storage.from('chat_attachments').upload(filePath, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('chat_attachments').getPublicUrl(filePath)
        image_url = publicUrl
      }
    }

    const newMessage = {
      id: uuidv4(),
      chat_id: activeChatId,
      sender_id: currentUser.id,
      text,
      image_url,
      created_at: new Date().toISOString()
    }

    // Optimistic UI update
    addMessage(newMessage)

    // Actually insert to DB
    await supabase.from('messages').insert({
      id: newMessage.id,
      chat_id: activeChatId,
      text,
      image_url
    })
  }

  const handleTyping = () => {
    const channel = supabase.channel('chatty_presence')
    channel.track({ user_id: currentUser.id, typing_in: activeChatId })
  }

  return (
    <div className={`flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 absolute md:static top-0 left-0 right-0 bottom-0 z-10 transition-transform ${activeChatId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
      <ChatHeader 
        chat={chat} 
        isOnline={isOnline}
        isTyping={isTyping}
        onBack={() => setActiveChatId(null)}
      />
      <MessageList 
        messages={chatMessages} 
        currentUserId={currentUser.id} 
        partnerLastReadTime={chat.partner_last_read_time}
      />
      <ChatInput 
        onSendMessage={handleSendMessage} 
        onTyping={handleTyping}
      />
    </div>
  )
}
