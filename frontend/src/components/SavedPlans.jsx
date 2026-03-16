import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function SavedPlans({ user, onLoad, onClose }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('floor_plans')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error) setPlans(data || [])
    setLoading(false)
  }

  const deletePlan = async (id) => {
    if (!confirm('Delete this floor plan?')) return
    await supabase.from('floor_plans').delete().eq('id', id)
    setPlans(plans.filter(p => p.id !== id))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">📁 Saved Floor Plans</div>

        {loading ? (
          <div className="modal-message">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="modal-message" style={{ color: '#64748b' }}>
            No saved floor plans yet. Save your current layout using the save button.
          </div>
        ) : (
          <div className="plans-list">
            {plans.map(plan => (
              <div key={plan.id} className="plan-row">
                <div className="plan-info">
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-meta">
                    {new Date(plan.updated_at).toLocaleDateString()} ·
                    {plan.data.walls?.length || 0} walls ·
                    {plan.data.obstacles?.length || 0} obstacles
                  </div>
                </div>
                <div className="plan-actions">
                  <button className="plan-btn" onClick={() => { onLoad(plan.data, plan.name); onClose() }}>
                    Load
                  </button>
                  <button className="plan-btn plan-btn-danger" onClick={() => deletePlan(plan.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
