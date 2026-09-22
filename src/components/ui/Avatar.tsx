import React from 'react'

interface AvatarProps {
  url?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Avatar({ url, name, size = 'md', className = '' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-24 h-24 text-2xl',
  }

  const initial = name ? name.charAt(0).toUpperCase() : '?'

  return (
    <div className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-blue-600 text-white font-semibold ${sizeClasses[size]} ${className}`}>
      {url ? (
        <img src={url} alt={name || 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
