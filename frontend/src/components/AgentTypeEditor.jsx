import { useState } from 'react'

const PRESET_COLORS = [
  '#a78bfa', '#34d399', '#fbbf24', '#94a3b8',
  '#f87171', '#60a5fa', '#fb923c', '#e879f9',
  '#4ade80', '#facc15', '#38bdf8', '#f472b6',
]

const DEFAULT_PRESETS = [
  { id: 'customer', name: 'Customer', color: '#a78bfa', speedMin: 1.0, speedMax: 1.5, proportion: 1.0 },
  { id: 'staff', name: 'Staff', color: '#34d399', speedMin: 1.4, speedMax: 1.8, proportion: 0.0 },
  { id: 'child', name: 'Child', color: '#fbbf24', speedMin: 0.7, speedMax: 1.0, proportion: 0.0 },
  { id: 'elderly', name: 'Elderly', color: '#94a3b8', speedMin: 0.5, speedMax: 0.8, proportion: 0.0 },
]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export default function AgentTypeEditor({ agentTypes, setAgentTypes, disabled }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const totalProportion = agentTypes.reduce((sum, t) => sum + t.proportion, 0)

  const addType = () => {
    const newId = `custom_${Date.now()}`
    setAgentTypes(prev => [...prev, {
      id: newId,
      name: 'Custom',
      color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
      speedMin: 1.0,
      speedMax: 1.5,
      proportion: 0.0,
    }])
    setEditingId(newId)
  }

  const removeType = (id) => {
    setAgentTypes(prev => prev.filter(t => t.id !== id))
  }

  const updateType = (id, field, value) => {
    setAgentTypes(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  // Build the distribution object for the backend
  // Returns { typeName: normalizedProportion }
  const getDistribution = () => {
    const active = agentTypes.filter(t => t.proportion > 0)
    if (active.length === 0) return { customer: 1.0 }
    const total = active.reduce((sum, t) => sum + t.proportion, 0)
    const dist = {}
    for (const t of active) {
      dist[t.id] = t.proportion / total
    }
    return dist
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <button
        className={`tool-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        title="Agent types"
      >
        🧑
      </button>
      <div className="tool-label">Agents</div>

      {open && (
        <div style={{
          position: 'absolute',
          left: '56px',
          top: 0,
          background: '#1a1d2e',
          border: '1px solid #2d3148',
          borderRadius: 10,
          padding: 16,
          width: 280,
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Agent Types
            </div>
            <button onClick={addType} style={{
              fontSize: 11, color: '#6366f1', background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5,
              padding: '3px 8px', cursor: 'pointer',
            }}>+ Add type</button>
          </div>

          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
            Set proportion to 0 to exclude a type. Proportions are auto-normalized.
          </div>

          {agentTypes.map(type => (
            <div key={type.id} style={{
              background: '#0f1117',
              border: `1px solid ${editingId === type.id ? type.color : '#2d3148'}`,
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 8,
              transition: 'border-color 0.2s',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {/* Color picker */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: type.color, cursor: 'pointer',
                    border: '2px solid rgba(255,255,255,0.2)',
                  }} onClick={() => setEditingId(editingId === type.id ? null : type.id)} />
                </div>

                {/* Name */}
                <input
                  value={type.name}
                  onChange={e => updateType(type.id, 'name', e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: '#e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none',
                  }}
                />

                {/* Delete (don't allow deleting if only 1 left) */}
                {agentTypes.length > 1 && (
                  <button onClick={() => removeType(type.id)} style={{
                    color: '#475569', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 14, padding: 0,
                  }}>✕</button>
                )}
              </div>

              {/* Color swatches (shown when editing) */}
              {editingId === type.id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {PRESET_COLORS.map(c => (
                    <div key={c} onClick={() => updateType(type.id, 'color', c)} style={{
                      width: 18, height: 18, borderRadius: 3, background: c,
                      cursor: 'pointer', border: type.color === c ? '2px solid white' : '2px solid transparent',
                    }} />
                  ))}
                </div>
              )}

              {/* Speed range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', width: 42 }}>Speed</span>
                <input type="number" value={type.speedMin} step={0.1} min={0.1} max={5}
                  onChange={e => updateType(type.id, 'speedMin', Number(e.target.value))}
                  style={{ width: 46, padding: '2px 4px', background: '#161929', border: '1px solid #2d3148', borderRadius: 4, color: '#e2e8f0', fontSize: 11 }} />
                <span style={{ fontSize: 10, color: '#475569' }}>–</span>
                <input type="number" value={type.speedMax} step={0.1} min={0.1} max={5}
                  onChange={e => updateType(type.id, 'speedMax', Number(e.target.value))}
                  style={{ width: 46, padding: '2px 4px', background: '#161929', border: '1px solid #2d3148', borderRadius: 4, color: '#e2e8f0', fontSize: 11 }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>m/s</span>
              </div>

              {/* Proportion slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', width: 42 }}>Mix</span>
                <input type="range" min={0} max={1} step={0.05} value={type.proportion}
                  onChange={e => updateType(type.id, 'proportion', Number(e.target.value))}
                  style={{ flex: 1, accentColor: type.color }} />
                <span style={{ fontSize: 11, color: '#64748b', width: 28 }}>
                  {totalProportion > 0 ? Math.round((type.proportion / totalProportion) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}

          {/* Summary bar */}
          <div style={{ marginTop: 8, height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
            {agentTypes.filter(t => t.proportion > 0).map(t => (
              <div key={t.id} style={{
                flex: t.proportion,
                background: t.color,
                transition: 'flex 0.2s',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {agentTypes.filter(t => t.proportion > 0).map(t => (
              <span key={t.id} style={{ fontSize: 10, color: t.color }}>
                ● {t.name} {totalProportion > 0 ? Math.round((t.proportion / totalProportion) * 100) : 0}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { DEFAULT_PRESETS, hexToRgb }
