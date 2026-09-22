import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/store/useChatStore'
import { RealtimeChannel } from '@supabase/supabase-js'

export function useSupabaseSync() {
  const { currentUser, setChats, addMessage, setOnlineUsers, setTypingUsers } = useChatStore()
  const supabase = createClient()
  const presenceChannelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!currentUser) return

    // 1. Initial Data Fetch for sidebar
    const fetchChats = async () => {
      const { data } = await supabase.rpc('get_conversations', { current_user_id: currentUser.id })
      if (data) setChats(data)
    }
    fetchChats()

    // 2. Subscribe to Postgres Changes (Messages and Participants)
    const dbChannel = supabase.channel('chatty_db_sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMessage = payload.new as any
          addMessage(newMessage)
          fetchChats()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_participants' },
        (payload) => {
          fetchChats()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_participants' },
        (payload) => {
          fetchChats()
        }
      )
      .subscribe()

    // 3. Presence (Online / Typing Status)
    const presenceChannel = supabase.channel('chatty_presence')
    presenceChannelRef.current = presenceChannel

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const online = new Set<string>()
        const typing: Record<string, Set<string>> = {}

        for (const [key, presences] of Object.entries(state)) {
          for (const p of presences as any[]) {
            if (p.user_id) {
              online.add(p.user_id)
              if (p.typing_in) {
                if (!typing[p.typing_in]) typing[p.typing_in] = new Set()
                typing[p.typing_in].add(p.user_id)
              }
            }
          }
        }

        setOnlineUsers(online)
        
        // Update typing states in Zustand
        const chatStore = useChatStore.getState()
        // Simplistic approach: we just overwrite the ones we found. 
        // A full implementation would carefully merge/remove, 
        // but replacing works for our simple state shape if we iterate over all chats.
        for (const chatId of Object.keys(typing)) {
          chatStore.setTypingUsers(chatId, typing[chatId])
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: currentUser.id })
        }
      })

    return () => {
      supabase.removeChannel(dbChannel)
      supabase.removeChannel(presenceChannel)
      presenceChannelRef.current = null
    }
  }, [currentUser])

  // Return a helper to broadcast typing
  const broadcastTyping = (chatId: string, isTyping: boolean) => {
    if (presenceChannelRef.current && currentUser) {
      presenceChannelRef.current.track({ 
        user_id: currentUser.id, 
        typing_in: isTyping ? chatId : null 
      })
    }
  }

  return { broadcastTyping }
}
