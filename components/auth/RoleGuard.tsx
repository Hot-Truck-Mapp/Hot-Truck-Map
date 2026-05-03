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
    if (!loading && role && !allowedRoles.includes(role)) {
      router.push('/')
    }
  }, [role, loading, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" /></div>
  if (!role || !allowedRoles.includes(role)) return null

  return <>{children}</>
}