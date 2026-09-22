import React from 'react'
import { format } from 'date-fns'
import { Message } from '@/store/useChatStore'
import { Check, CheckCheck } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  isRead: boolean
}

export function MessageBubble({ message, isOwn, isRead }: MessageBubbleProps) {
  const timeFormatted = format(new Date(message.created_at), 'HH:mm')

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3`}>
      <div 
        className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2 relative group ${
          isOwn 
            ? 'bg-blue-600 text-white rounded-br-sm' 
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-sm shadow-sm'
        }`}
      >
        {message.image_url && (
          <img 
            src={message.image_url} 
            alt="Attachment" 
            className="rounded-lg mb-2 max-w-full h-auto cursor-pointer"
          />
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        
        <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
          <span className="text-[10px]">{timeFormatted}</span>
          {isOwn && (
            isRead ? <CheckCheck size={14} className="text-blue-200" /> : <Check size={14} />
          )}
        </div>
      </div>
    </div>
  )
}
