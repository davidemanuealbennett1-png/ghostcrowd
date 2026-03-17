import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Tier limits
export const TIER_LIMITS = {
  free: { agents: 50, floor_plans: 1, pdf: false, share: true, bottlenecks: true },
  basic: { agents: 100, floor_plans: 3, pdf: false, share: false, bottlenecks: false },
  premium: { agents: 500, floor_plans: Infinity, pdf: true, share: true, bottlenecks: true },
  max: { agents: 2000, floor_plans: Infinity, pdf: true, share: true, bottlenecks: true },
}

export function useSubscription(user) {
  const [tier, setTier] = useState('free')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { setTier('free'); return }

    // Check user metadata for tier
    // In a full implementation this would query a subscriptions table
    // For now we read from user metadata set by webhook
    const userTier = user.user_metadata?.tier || 'free'
    setTier(userTier)
  }, [user])

  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free

  const canUse = (feature, value = null) => {
    if (feature === 'agents') return value <= limits.agents
    if (feature === 'pdf') return limits.pdf
    if (feature === 'share') return limits.share
    if (feature === 'bottlenecks') return limits.bottlenecks
    return true
  }

  return { tier, limits, canUse, loading }
}
