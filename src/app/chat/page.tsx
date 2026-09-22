'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/store/useChatStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { useSupabaseSync } from '@/hooks/useSupabaseSync'
import { Loader } from '@/components/ui/Loader'

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentUser, setCurrentUser } = useChatStore()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Initialize sync (will only run when currentUser is set)
  const { broadcastTyping } = useSupabaseSync()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.replace('/')
        return
      }

      // Fetch our own profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setCurrentUser(profile)
      }
      setLoading(false)
    }

    checkAuth()
  }, [router, supabase, setCurrentUser])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader className="scale-150" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white dark:bg-[#0f1418] overflow-hidden font-sans">
      <Sidebar onOpenSettings={() => setIsProfileModalOpen(true)} />
      <ChatContainer broadcastTyping={broadcastTyping} />
      
      {isProfileModalOpen && (
        <ProfileModal onClose={() => setIsProfileModalOpen(false)} />
      )}
    </div>
  )
}
