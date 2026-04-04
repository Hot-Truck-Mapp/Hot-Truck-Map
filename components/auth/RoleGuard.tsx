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
  }, [role, loading])

  if (loading) return <div>Loading...</div>
  if (!role || !allowedRoles.includes(role)) return null

  return <>{children}</>
}