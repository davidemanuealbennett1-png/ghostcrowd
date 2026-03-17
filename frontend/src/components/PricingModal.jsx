import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
const API_URL = import.meta.env.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL.replace('ws://', 'http://').replace('wss://', 'https://')
  : 'https://ghostcrowd-production.up.railway.app'

export default function PricingModal({ user, currentTier, onClose, onRequestAuth }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/billing/plans`)
      .then(r => r.json())
      .then(data => { setPlans(data.plans); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleUpgrade = async (plan) => {
    if (!user) { onRequestAuth(); return }
    if (plan.id === 'free') return
    setCheckoutLoading(plan.id)

    try {
      const res = await fetch(`${API_URL}/billing/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: plan.id,
          user_id: user.id,
          email: user.email,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e) {
      console.error('Checkout error:', e)
    }
    setCheckoutLoading(null)
  }

  const TIER_ORDER = ['free', 'basic', 'pro', 'max']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 860, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title" style={{ marginBottom: 4 }}>Choose your plan</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Upgrade anytime. Cancel anytime. No hidden fees.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Loading plans...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {plans.sort((a, b) => TIER_ORDER.indexOf(a.id) - TIER_ORDER.indexOf(b.id)).map(plan => (
              <div key={plan.id} style={{
                background: plan.featured ? 'rgba(99,102,241,0.08)' : '#0f1117',
                border: `1px solid ${plan.featured ? '#6366f1' : '#2d3148'}`,
                borderRadius: 12,
                padding: 16,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {plan.featured && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: '#6366f1', color: 'white', fontSize: 10, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 100, whiteSpace: 'nowrap',
                  }}>Most popular</div>
                )}

                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1, marginBottom: 2 }}>
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  {plan.interval && <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>/mo</span>}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>
                  Up to {plan.agents === -1 ? '∞' : plan.agents} agents
                </div>

                <div style={{ flex: 1, marginBottom: 14 }}>
                  {plan.features?.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 5 }}>
                      <span style={{ color: '#4ade80', fontSize: 11, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{f}</span>
                    </div>
                  ))}
                  {plan.missing?.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 5 }}>
                      <span style={{ color: '#475569', fontSize: 11, flexShrink: 0 }}>–</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={checkoutLoading === plan.id || currentTier === plan.id}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 7, border: 'none',
                    background: currentTier === plan.id ? '#2d3148'
                      : plan.featured ? '#6366f1' : '#1e2235',
                    color: currentTier === plan.id ? '#64748b' : 'white',
                    fontSize: 12, fontWeight: 600, cursor: currentTier === plan.id ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {checkoutLoading === plan.id ? '...'
                    : currentTier === plan.id ? 'Current plan'
                    : plan.id === 'free' ? 'Free forever'
                    : plan.cta}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: '#475569', textAlign: 'center' }}>
          All paid plans include a 7-day free trial · Powered by Stripe · Cancel anytime
        </div>
      </div>
    </div>
  )
}
