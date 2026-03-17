import { useState } from 'react'
import { supabase } from '../utils/supabase'

function generateShareId() {
  return Math.random().toString(36).substring(2, 10)
}

export default function ShareButton({ user, floorPlan, floorPlanName, onRequestAuth }) {
  const [status, setStatus] = useState(null) // null | 'loading' | 'copied' | 'error'
  const [shareUrl, setShareUrl] = useState(null)

  const handleShare = async () => {
    if (!user) { onRequestAuth(); return }
    setStatus('loading')

    const shareId = generateShareId()

    // Save as public plan
    const { data, error } = await supabase
      .from('floor_plans')
      .insert({
        user_id: user.id,
        name: floorPlanName,
        data: floorPlan,
        is_public: true,
        share_id: shareId,
      })
      .select()
      .single()

    if (error) {
      setStatus('error')
      setTimeout(() => setStatus(null), 2000)
      return
    }

    const url = `${window.location.origin}/share/${shareId}`
    setShareUrl(url)
    navigator.clipboard.writeText(url).catch(() => {})
    setStatus('copied')
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="header-btn" onClick={handleShare} title="Share floor plan">
        {status === 'loading' ? '...'
          : status === 'copied' ? '✓ Link copied!'
          : status === 'error' ? '✗ Error'
          : '🔗 Share'}
      </button>
    </div>
  )
}
