import React from 'react'
import { format } from 'date-fns'
import { Avatar } from '../ui/Avatar'
import { Chat } from '@/store/useChatStore'

interface ChatListItemProps {
  chat: Chat
  isActive: boolean
  onClick: () => void
  isOnline?: boolean
}

export function ChatListItem({ chat, isActive, onClick, isOnline }: ChatListItemProps) {
  // Use partner's info for direct chats, or chat info for group chats
  const isDirect = chat.chat_type === 'direct'
  const displayName = isDirect ? (chat.partner_display_name || chat.partner_username) : chat.chat_name
  const avatarUrl = isDirect ? chat.partner_avatar : chat.chat_avatar_url

  const timeFormatted = chat.last_message_time 
    ? format(new Date(chat.last_message_time), 'HH:mm') 
    : ''

  return (
    <div 
      onClick={onClick}
      className={`flex items-center p-3 cursor-pointer transition-colors ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      <div className="relative">
        <Avatar url={avatarUrl} name={displayName} />
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
        )}
      </div>
      
      <div className="ml-3 flex-1 overflow-hidden">
        <div className="flex justify-between items-baseline">
          <h3 className={`font-semibold truncate ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            {displayName}
          </h3>
          <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>
            {timeFormatted}
          </span>
        </div>
        
        <div className="flex justify-between items-center mt-1">
          <p className={`text-sm truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
            {chat.last_message || 'No messages yet'}
          </p>
          {chat.unread_count > 0 && (
            <span className="ml-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
