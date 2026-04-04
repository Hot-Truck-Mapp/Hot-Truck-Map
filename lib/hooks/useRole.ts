'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase/client'

type Role = 'customer' | 'operator' | 'admin' | null

export function useRole() {
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRole(null)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(data?.role ?? 'customer')
      setLoading(false)
    }

    fetchRole()
  }, [])

  return {
    role,
    loading,
    isCustomer: role === 'customer',
    isOperator: role === 'operator',
    isAdmin: role === 'admin',
  }
}