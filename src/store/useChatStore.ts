import { create } from 'zustand'

export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  last_seen: string | null
}

export type Chat = {
  chat_id: string
  chat_type: 'direct' | 'group'
  chat_name: string | null
  chat_avatar_url: string | null
  partner_id: string | null
  partner_username: string | null
  partner_display_name: string | null
  partner_avatar: string | null
  last_message: string | null
  last_message_time: string | null
  last_sender_id: string | null
  unread_count: number
  partner_last_read_time: string | null
}

export type Message = {
  id: string
  chat_id: string
  sender_id: string
  text: string
  image_url: string | null
  created_at: string
  isOptimistic?: boolean
  error?: boolean
}

interface ChatState {
  currentUser: Profile | null
  chats: Chat[]
  activeChatId: string | null
  messages: Record<string, Message[]> // chat_id -> Message[]
  onlineUsers: Set<string>
  typingUsers: Record<string, Set<string>> // chat_id -> Set of user_ids

  // Actions
  setCurrentUser: (user: Profile | null) => void
  setChats: (chats: Chat[]) => void
  updateChat: (chatId: string, updates: Partial<Chat>) => void
  setActiveChatId: (id: string | null) => void
  setMessages: (chatId: string, messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void
  setOnlineUsers: (users: Set<string>) => void
  setTypingUsers: (chatId: string, users: Set<string>) => void
  setAllTypingUsers: (typingData: Record<string, Set<string>>) => void
}

export const useChatStore = create<ChatState>((set) => ({
  currentUser: null,
  chats: [],
  activeChatId: null,
  messages: {},
  onlineUsers: new Set(),
  typingUsers: {},

  setCurrentUser: (user) => set({ currentUser: user }),
  
  setChats: (chats) => set({ chats }),
  
  updateChat: (chatId, updates) => set((state) => ({
    chats: state.chats.map(c => c.chat_id === chatId ? { ...c, ...updates } : c)
  })),

  setActiveChatId: (id) => set({ activeChatId: id }),

  setMessages: (chatId, msgs) => set((state) => ({
    messages: { ...state.messages, [chatId]: msgs }
  })),

  addMessage: (message) => set((state) => {
    const chatMessages = state.messages[message.chat_id] || []
    if (chatMessages.some(m => m.id === message.id && !m.isOptimistic)) return state
    
    // If it exists as optimistic, replace it. Otherwise append.
    const exists = chatMessages.some(m => m.id === message.id)
    const newMessages = exists 
      ? chatMessages.map(m => m.id === message.id ? { ...m, ...message, isOptimistic: false } : m)
      : [...chatMessages, message]
      
    return {
      messages: {
        ...state.messages,
        [message.chat_id]: newMessages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }
    }
  }),

  updateMessage: (chatId, messageId, updates) => set((state) => {
    const chatMessages = state.messages[chatId] || []
    return {
      messages: {
        ...state.messages,
        [chatId]: chatMessages.map(m => m.id === messageId ? { ...m, ...updates } : m)
      }
    }
  }),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setTypingUsers: (chatId, users) => set((state) => ({
    typingUsers: { ...state.typingUsers, [chatId]: users }
  })),
  
  setAllTypingUsers: (typingData) => set({ typingUsers: typingData })
}))
