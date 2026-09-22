import React, { useEffect, useRef } from 'react'
import { Message } from '@/store/useChatStore'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  currentUserId: string
  partnerLastReadTime?: string | null
}

export function MessageList({ messages, currentUserId, partnerLastReadTime }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#e5ddd5] dark:bg-[#0f172a]">
      <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 my-auto bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg mx-auto text-sm">
            No messages here yet... Send a message!
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.sender_id === currentUserId
            
            let isRead = false
            if (isOwn && partnerLastReadTime) {
              const msgTime = new Date(msg.created_at).getTime()
              const readTime = new Date(partnerLastReadTime).getTime()
              isRead = msgTime <= readTime
            }
            
            return (
              <MessageBubble 
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                isRead={isRead}
              />
            )
          })
        )}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  )
}
