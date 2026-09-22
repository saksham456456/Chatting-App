import React from 'react'
import { ArrowLeft, MoreVertical } from 'lucide-react'
import { Chat } from '@/store/useChatStore'
import { Avatar } from '../ui/Avatar'

interface ChatHeaderProps {
  chat: Chat
  isOnline: boolean
  isTyping: boolean
  onBack: () => void
}

export function ChatHeader({ chat, isOnline, isTyping, onBack }: ChatHeaderProps) {
  const isDirect = chat.chat_type === 'direct'
  const displayName = isDirect ? (chat.partner_display_name || chat.partner_username) : chat.chat_name
  const avatarUrl = isDirect ? chat.partner_avatar : chat.chat_avatar_url

  return (
    <div className="h-[60px] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#212121] flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
        >
          <ArrowLeft size={24} />
        </button>
        
        <Avatar url={avatarUrl} name={displayName} />
        
        <div className="flex flex-col">
          <h2 className="font-semibold text-slate-900 dark:text-white leading-tight">
            {displayName}
          </h2>
          <span className="text-xs text-blue-500 font-medium">
            {isTyping ? 'typing...' : (isOnline ? 'online' : (isDirect ? 'last seen recently' : ''))}
          </span>
        </div>
      </div>
      
      <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
        <MoreVertical size={20} />
      </button>
    </div>
  )
}
