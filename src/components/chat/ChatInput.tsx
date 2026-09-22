import React, { useState, useRef } from 'react'
import { Send, Paperclip, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (text: string, file: File | null) => Promise<void>
  onTyping: () => void
}

export function ChatInput({ onSendMessage, onTyping }: ChatInputProps) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!text.trim() && !file) return

    setIsSending(true)
    try {
      await onSendMessage(text, file)
      setText('')
      setFile(null)
    } finally {
      setIsSending(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value)
    onTyping()
  }

  return (
    <div className="p-3 bg-white dark:bg-[#212121] border-t border-slate-200 dark:border-slate-800">
      {file && (
        <div className="mb-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-between text-sm">
          <span className="truncate text-slate-700 dark:text-slate-300">
            📎 {file.name}
          </span>
          <button 
            onClick={() => setFile(null)}
            className="text-red-500 hover:text-red-700 ml-2"
          >
            Remove
          </button>
        </div>
      )}
      <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-500 hover:text-blue-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          disabled={isSending}
        >
          <Paperclip size={20} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept="image/*"
        />
        
        <input
          type="text"
          value={text}
          onChange={handleChange}
          placeholder="Write a message..."
          disabled={isSending}
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full py-2.5 px-4 text-sm focus:outline-none text-slate-900 dark:text-white"
        />
        
        {text.trim() || file ? (
          <button
            type="submit"
            disabled={isSending}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        ) : null}
      </form>
    </div>
  )
}
