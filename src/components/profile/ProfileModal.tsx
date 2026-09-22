import React, { useState, useRef } from 'react'
import { X, Camera, Loader2, LogOut } from 'lucide-react'
import { useChatStore } from '@/store/useChatStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { currentUser, setCurrentUser } = useChatStore()
  const supabase = createClient()
  const router = useRouter()
  
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '')
  const [bio, setBio] = useState(currentUser?.bio || '')
  const [isSaving, setIsSaving] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    if (!currentUser) return
    setIsSaving(true)
    
    const updates = {
      display_name: displayName,
      bio: bio,
      updated_at: new Date().toISOString()
    }
    
    await supabase.from('profiles').update(updates).eq('id', currentUser.id)
    setCurrentUser({ ...currentUser, ...updates })
    setIsSaving(false)
    onClose()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentUser) return
    
    setIsSaving(true)
    const file = e.target.files[0]
    const ext = file.name.split('.').pop()
    const filePath = `${currentUser.id}/avatar.${ext}`
    
    // We upsert in case they already have one
    const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
    
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      // Force refresh by appending timestamp
      const finalUrl = `${publicUrl}?t=${new Date().getTime()}`
      
      await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', currentUser.id)
      setCurrentUser({ ...currentUser, avatar_url: finalUrl })
    }
    setIsSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-blue-100 cursor-pointer group overflow-hidden border-2 border-slate-200 dark:border-slate-700"
            >
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-blue-500 font-bold bg-blue-100 dark:bg-blue-900/30">
                  {currentUser?.display_name?.charAt(0) || currentUser?.username?.charAt(0)}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs gap-1">
                <Camera size={24} />
                <span>Change</span>
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
            
            <p className="mt-3 font-semibold text-slate-900 dark:text-white">@{currentUser?.username}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-blue-500 mb-1">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3 outline-none text-slate-900 dark:text-white border border-transparent focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-blue-500 mb-1">Bio</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3 outline-none text-slate-900 dark:text-white border border-transparent focus:border-blue-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
