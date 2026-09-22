import React, { useState } from 'react'
import { Menu, Search, Edit } from 'lucide-react'
import { useChatStore } from '@/store/useChatStore'
import { ChatListItem } from './ChatListItem'
import { NewChatModal } from '../chat/NewChatModal'

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { chats, activeChatId, setActiveChatId, onlineUsers } = useChatStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true
    const name = (chat.chat_type === 'direct' ? chat.partner_display_name || chat.partner_username : chat.chat_name) || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full">
      {/* Header */}
      <div className="p-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
        <button 
          onClick={onOpenSettings}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 shrink-0"
        >
          <Menu size={24} />
        </button>
        
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
        
        <button 
          onClick={() => setIsNewChatOpen(true)}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shrink-0"
        >
          <Edit size={20} />
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="text-center text-slate-500 mt-10 text-sm">
            No chats found
          </div>
        ) : (
          filteredChats.map(chat => (
            <ChatListItem
              key={chat.chat_id}
              chat={chat}
              isActive={activeChatId === chat.chat_id}
              onClick={() => setActiveChatId(chat.chat_id)}
              isOnline={chat.partner_id ? onlineUsers.has(chat.partner_id) : false}
            />
          ))
        )}
      </div>

      {isNewChatOpen && <NewChatModal onClose={() => setIsNewChatOpen(false)} />}
    </div>
  )
}
