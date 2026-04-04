'use client'

import { useRole } from '../../lib/hooks/useRole'

export default function Navbar() {
  const { isAdmin, isOperator, isCustomer } = useRole()

  return (
    <nav style={{
      display: 'flex',
      gap: '16px',
      padding: '16px',
      backgroundColor: '#FF6B35',
      color: 'white'
    }}>
      <span style={{ fontWeight: 'bold' }}>🚚 HotTruckMap</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
        {isCustomer && <a href="/map" style={{ color: 'white' }}>Find Trucks</a>}
        {isOperator && <a href="/dashboard" style={{ color: 'white' }}>My Truck</a>}
        {isAdmin && <a href="/admin" style={{ color: 'white' }}>Admin Panel</a>}
      </div>
    </nav>
  )
}