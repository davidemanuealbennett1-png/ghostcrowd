import { useState } from 'react'

const TOOLS = [
  { id: "wall", icon: "📏", label: "Wall" },
  { id: "door", icon: "🚪", label: "Door" },
  { id: "obstacle", icon: "⬛", label: "Table" },
  { id: "spawn", icon: "🟢", label: "Spawn" },
  { id: "exit", icon: "🔴", label: "Exit" },
  { id: "erase", icon: "🗑", label: "Erase" },
]

const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1.0 },
  { label: '2×', value: 2.0 },
  { label: '4×', value: 4.0 },
]

const PRESET_COLORS = ['#a78bfa','#34d399','#fbbf24','#94a3b8','#f87171','#60a5fa','#fb923c','#e879f9']

function MobileAgentEditor({ agentTypes, setAgentTypes }) {
  const totalProportion = agentTypes.reduce((sum, t) => sum + t.proportion, 0)

  const updateType = (id, field, value) =>
    setAgentTypes(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))

  const removeType = (id) =>
    setAgentTypes(prev => prev.filter(t => t.id !== id))

  const addType = () => {
    const newId = `custom_${Date.now()}`
    setAgentTypes(prev => [...prev, {
      id: newId, name: 'Custom',
      color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
      speedMin: 1.0, speedMax: 1.5, proportion: 0.0,
    }])
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
        Set proportion to 0 to exclude. Proportions are auto-normalized.
      </div>
      {agentTypes.map(type => (
        <div key={type.id} style={{
          background: '#0f1117', border: '1px solid #2d3148',
          borderRadius: 8, padding: '10px 12px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: type.color, border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
            <input value={type.name} onChange={e => updateType(type.id, 'name', e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none' }} />
            {agentTypes.length > 1 && (
              <button onClick={() => removeType(type.id)} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {PRESET_COLORS.map(c => (
              <div key={c} onClick={() => updateType(type.id, 'color', c)} style={{
                width: 22, height: 22, borderRadius: 4, background: c, cursor: 'pointer',
                border: type.color === c ? '2px solid white' : '2px solid transparent',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: '#64748b', width: 42 }}>Speed</span>
            <input type="number" value={type.speedMin} step={0.1} min={0.1} max={5}
              onChange={e => updateType(type.id, 'speedMin', Number(e.target.value))}
              style={{ width: 52, padding: '4px 6px', background: '#161929', border: '1px solid #2d3148', borderRadius: 4, color: '#e2e8f0', fontSize: 12 }} />
            <span style={{ fontSize: 10, color: '#475569' }}>–</span>
            <input type="number" value={type.speedMax} step={0.1} min={0.1} max={5}
              onChange={e => updateType(type.id, 'speedMax', Number(e.target.value))}
              style={{ width: 52, padding: '4px 6px', background: '#161929', border: '1px solid #2d3148', borderRadius: 4, color: '#e2e8f0', fontSize: 12 }} />
            <span style={{ fontSize: 10, color: '#64748b' }}>m/s</span>
          </div>
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
      <button onClick={addType} style={{
        width: '100%', padding: '10px', background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
        color: '#6366f1', fontSize: 13, cursor: 'pointer', fontWeight: 600,
      }}>+ Add agent type</button>
      <div style={{ marginTop: 10, height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
        {agentTypes.filter(t => t.proportion > 0).map(t => (
          <div key={t.id} style={{ flex: t.proportion, background: t.color }} />
        ))}
      </div>
    </div>
  )
}

export default function MobileLayout({
  children,
  activeTool, setActiveTool,
  floorPlan, agentCount, setAgentCount,
  isSimulating, isDone,
  onStart, onStop, onReset,
  currentFrame,
  user, onSignIn, onSignOut,
  onSave, saveStatus,
  onShare,
  onUpgrade, tier,
  onExport, onExportPDF,
  heatMap, showHeatMap, setShowHeatMap,
  bottlenecks, showBottlenecks, setShowBottlenecks,
  panicMode, onTriggerPanic, onCalmDown,
  simSpeed, setSimSpeed,
  results,
  playbackBar,
  agentTypes, setAgentTypes,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [panel, setPanel] = useState(null) // null | 'settings' | 'agents'

  const togglePanel = (name) => setPanel(p => p === name ? null : name)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f1117', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#1a1d2e', borderBottom: '1px solid #2d3148',
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>👻 GhostCrowd</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isDone && !isSimulating && (
            <button onClick={onStart} style={{
              padding: '7px 16px', background: '#6366f1', border: 'none',
              borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>▶ Run</button>
          )}
          {isSimulating && (
            <button onClick={onStop} style={{
              padding: '7px 16px', background: '#dc2626', border: 'none',
              borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>⏹ Stop</button>
          )}
          {isDone && (
            <button onClick={onReset} style={{
              padding: '7px 16px', background: '#2d3148', border: '1px solid #3d4266',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
            }}>↩ Edit</button>
          )}
          <button onClick={() => { setMenuOpen(v => !v); setPanel(null) }} style={{
            width: 36, height: 36, background: menuOpen ? '#3730a3' : '#2d3148',
            border: '1px solid #3d4266', borderRadius: 8, color: '#e2e8f0',
            fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>☰</button>
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 56, right: 12, zIndex: 200,
          background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 10,
          padding: 8, minWidth: 190, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <button onClick={() => { onSave(); setMenuOpen(false) }} style={menuBtnStyle}>
            💾 {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save'}
          </button>
          <button onClick={() => { onShare(); setMenuOpen(false) }} style={menuBtnStyle}>🔗 Share</button>
          <button onClick={() => { onUpgrade(); setMenuOpen(false) }} style={menuBtnStyle}>
            ⬆ {tier === 'free' ? 'Upgrade' : `${tier.charAt(0).toUpperCase() + tier.slice(1)} plan`}
          </button>
          {isDone && heatMap && <>
            <button onClick={() => { onExport(); setMenuOpen(false) }} style={menuBtnStyle}>⬇ Export PNG</button>
            <button onClick={() => { onExportPDF(); setMenuOpen(false) }} style={menuBtnStyle}>📄 Export PDF</button>
          </>}
          <div style={{ height: 1, background: '#2d3148', margin: '4px 0' }} />
          {user ? (
            <button onClick={() => { onSignOut(); setMenuOpen(false) }} style={{ ...menuBtnStyle, color: '#f87171' }}>Sign out</button>
          ) : (
            <button onClick={() => { onSignIn(); setMenuOpen(false) }} style={{ ...menuBtnStyle, color: '#a78bfa' }}>Sign in</button>
          )}
        </div>
      )}

      {/* Canvas — fills available space */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}
        onClick={() => setMenuOpen(false)}>
        {children}
      </div>

      {playbackBar}

      {/* Live stats */}
      {(isSimulating || isDone) && currentFrame && (
        <div style={{ display:'flex', gap:16, padding:'6px 16px', background:'#131729', borderTop:'1px solid #2d3148', fontSize:12, flexShrink:0 }}>
          <span style={{ color:'#64748b' }}>t=<span style={{ color:'#a78bfa' }}>{currentFrame.time}s</span></span>
          <span style={{ color:'#64748b' }}>Active: <span style={{ color:'#a78bfa' }}>{currentFrame.active_count}/{currentFrame.total_count}</span></span>
          {currentFrame.panic && <span style={{ color:'#f87171' }}>🚨 PANIC</span>}
        </div>
      )}

      {/* Results */}
      {isDone && results && (
        <div style={{ display:'flex', gap:16, padding:'8px 16px', background:'#131729', borderTop:'1px solid #2d3148', fontSize:12, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ color: results.exit_rate_pct>=90?'#4ade80':results.exit_rate_pct>=60?'#fbbf24':'#f87171' }}>
            {results.exit_rate_pct}% exited
          </span>
          <span style={{ color:'#64748b' }}>Avg: <span style={{ color:'#e2e8f0' }}>{results.avg_speed} m/s</span></span>
          <span style={{ color:'#64748b' }}>Bottlenecks: <span style={{ color:'#fbbf24' }}>{results.bottleneck_count}</span></span>
        </div>
      )}

      {/* Overlay toggles */}
      {isDone && (heatMap || bottlenecks?.length > 0) && (
        <div style={{ display:'flex', gap:10, padding:'6px 16px', background:'#1a1d2e', borderTop:'1px solid #2d3148', flexShrink:0 }}>
          {heatMap && (
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#94a3b8', cursor:'pointer' }}>
              <input type="checkbox" checked={showHeatMap} onChange={e => setShowHeatMap(e.target.checked)} />Heat Map
            </label>
          )}
          {bottlenecks?.length > 0 && (
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#94a3b8', cursor:'pointer' }}>
              <input type="checkbox" checked={showBottlenecks} onChange={e => setShowBottlenecks(e.target.checked)} />Bottlenecks
            </label>
          )}
        </div>
      )}

      {/* Panic button during sim */}
      {isSimulating && (
        <div style={{ padding:'8px 12px', background:'#1a1d2e', borderTop:'1px solid #2d3148', flexShrink:0 }}>
          {!panicMode ? (
            <button onClick={onTriggerPanic} style={{ width:'100%', padding:'10px', background:'#dc2626', border:'none', borderRadius:8, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              🚨 Trigger Panic / Evacuation
            </button>
          ) : (
            <button onClick={onCalmDown} style={{ width:'100%', padding:'10px', background:'#2d3148', border:'1px solid #3d4266', borderRadius:8, color:'#e2e8f0', fontSize:13, cursor:'pointer' }}>
              🕊 Calm Down
            </button>
          )}
        </div>
      )}

      {/* Bottom toolbar — two rows: tools row + action row */}
      {!isSimulating && !isDone && (
        <div style={{ background:'#1a1d2e', borderTop:'1px solid #2d3148', flexShrink:0 }}>
          {/* Tools row */}
          <div style={{ display:'flex', padding:'6px 8px', gap:4, overflowX:'auto' }}>
            {TOOLS.map(tool => (
              <button key={tool.id} onClick={() => setActiveTool(tool.id)} style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'6px 10px', borderRadius:8, border:'1px solid',
                borderColor: activeTool===tool.id ? '#6366f1' : 'transparent',
                background: activeTool===tool.id ? '#3730a3' : 'transparent',
                color: activeTool===tool.id ? 'white' : '#94a3b8',
                fontSize:20, cursor:'pointer', flexShrink:0, minWidth:52,
              }}>
                {tool.icon}
                <span style={{ fontSize:9, marginTop:2 }}>{tool.label}</span>
              </button>
            ))}
          </div>
          {/* Action row */}
          <div style={{ display:'flex', gap:6, padding:'0 8px 8px', borderTop:'1px solid #1e2235' }}>
            <button onClick={() => togglePanel('agents')} style={{
              flex:1, padding:'8px', background: panel==='agents' ? '#3730a3' : '#2d3148',
              border:'1px solid', borderColor: panel==='agents' ? '#6366f1' : '#3d4266',
              borderRadius:8, color: panel==='agents' ? 'white' : '#e2e8f0',
              fontSize:13, cursor:'pointer', fontWeight:500,
            }}>🧑 Agent Types</button>
            <button onClick={() => togglePanel('settings')} style={{
              flex:1, padding:'8px', background: panel==='settings' ? '#3730a3' : '#2d3148',
              border:'1px solid', borderColor: panel==='settings' ? '#6366f1' : '#3d4266',
              borderRadius:8, color: panel==='settings' ? 'white' : '#e2e8f0',
              fontSize:13, cursor:'pointer', fontWeight:500,
            }}>⚙ Settings</button>
          </div>
        </div>
      )}

      {/* Slide-up panels */}
      {panel && !isSimulating && !isDone && (
        <div style={{
          borderTop:'1px solid #2d3148',
          background:'#1a1d2e', borderTop:'1px solid #2d3148',
          maxHeight:'60vh', overflowY:'auto',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px 10px', borderBottom:'1px solid #2d3148' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#e2e8f0' }}>
              {panel === 'agents' ? '🧑 Agent Types' : '⚙ Settings'}
            </span>
            <button onClick={() => setPanel(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>

          <div style={{ padding:16 }}>
            {panel === 'agents' && (
              <MobileAgentEditor agentTypes={agentTypes} setAgentTypes={setAgentTypes} />
            )}

            {panel === 'settings' && (
              <>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px' }}>Agents: {agentCount}</div>
                  <input type="range" min={5} max={500} step={5} value={agentCount}
                    onChange={e => setAgentCount(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'#6366f1' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#475569' }}>
                    <span>5</span><span>500</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px' }}>Sim Speed</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {SPEED_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setSimSpeed(opt.value)} style={{
                        flex:1, padding:'9px', borderRadius:6, border:'1px solid',
                        borderColor: simSpeed===opt.value ? '#6366f1' : '#2d3148',
                        background: simSpeed===opt.value ? '#3730a3' : 'transparent',
                        color: simSpeed===opt.value ? 'white' : '#64748b',
                        fontSize:13, cursor:'pointer',
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const menuBtnStyle = {
  display:'block', width:'100%', padding:'10px 14px',
  background:'transparent', border:'none', borderRadius:6,
  color:'#e2e8f0', fontSize:13, cursor:'pointer', textAlign:'left',
}
