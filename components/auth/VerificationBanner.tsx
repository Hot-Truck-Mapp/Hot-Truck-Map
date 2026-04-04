'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function VerificationBanner() {
  const [verified, setVerified] = useState(true)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    const checkVerification = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setVerified(!!user.email_confirmed_at)
    }
    checkVerification()
  }, [])

  const resendEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    await supabase.auth.resend({
      type: 'signup',
      email: user.email
    })
    setResent(true)
  }

  if (verified) return null

  return (
    <div style={{
      backgroundColor: '#FFF3CD',
      border: '1px solid #FF6B35',
      borderRadius: '8px',
      padding: '16px',
      margin: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <strong>⚠️ Verify your email</strong>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
          Your truck won't appear on the map until you verify your email
        </p>
      </div>
      <button
        onClick={resendEmail}
        disabled={resent}
        style={{
          backgroundColor: resent ? '#ccc' : '#FF6B35',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: resent ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        {resent ? 'Email Sent ✅' : 'Resend Email'}
      </button>
    </div>
  )
}