'use client'

import { useRole } from '../../lib/hooks/useRole'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type Props = {
  allowedRoles: ('customer' | 'operator' | 'admin')[]
  children: React.ReactNode
}

export default function RoleGuard({ allowedRoles, children }: Props) {
  const { role, loading } = useRole()
  const router = useRouter()

  useEffect(() => {
    if (loading) return;
    if (!role) {
      // Not signed in — send to login instead of showing a blank screen
      router.push('/login');
      return;
    }
    if (!allowedRoles.includes(role)) {
      router.push('/');
    }
  }, [role, loading, router, allowedRoles])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" /></div>
  if (!role || !allowedRoles.includes(role)) return null

  return <>{children}</>
}