import { useState } from 'react'

const TOOLS = [
  { id: "wall", icon: "📏", label: "Wall" },
  { id: "door", icon: "🚪", label: "Door" },
  { id: "obstacle", icon: "⬛", label: "Table" },
  { id: "spawn", icon: "🟢", label: "Spawn" },
  { id: "exit", icon: "🔴", label: "Exit" },
  { id: "erase", icon: "🗑", label: "Erase" },
]

export default function MobileLayout({
  children, // canvas
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
  playbackBar, // optional playback controls
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const SPEED_OPTIONS = [
    { label: '0.5×', value: 0.5 },
    { label: '1×', value: 1.0 },
    { label: '2×', value: 2.0 },
    { label: '4×', value: 4.0 },
  ]

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
          {/* Run/Stop button */}
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

          {/* Hamburger menu */}
          <button onClick={() => setMenuOpen(v => !v)} style={{
            width: 36, height: 36, background: '#2d3148', border: '1px solid #3d4266',
            borderRadius: 8, color: '#e2e8f0', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>☰</button>
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 56, right: 12, zIndex: 200,
          background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 10,
          padding: 8, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <button onClick={() => { onSave(); setMenuOpen(false) }} style={menuBtnStyle}>
            💾 {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save'}
          </button>
          <button onClick={() => { onShare(); setMenuOpen(false) }} style={menuBtnStyle}>
            🔗 Share
          </button>
          <button onClick={() => { onUpgrade(); setMenuOpen(false) }} style={menuBtnStyle}>
            ⬆ {tier === 'free' ? 'Upgrade' : tier}
          </button>
          {isDone && heatMap && (
            <>
              <button onClick={() => { onExport(); setMenuOpen(false) }} style={menuBtnStyle}>⬇ Export PNG</button>
              <button onClick={() => { onExportPDF(); setMenuOpen(false) }} style={menuBtnStyle}>📄 Export PDF</button>
            </>
          )}
          <div style={{ height: 1, background: '#2d3148', margin: '4px 0' }} />
          {user ? (
            <button onClick={() => { onSignOut(); setMenuOpen(false) }} style={{ ...menuBtnStyle, color: '#f87171' }}>
              Sign out
            </button>
          ) : (
            <button onClick={() => { onSignIn(); setMenuOpen(false) }} style={{ ...menuBtnStyle, color: '#a78bfa' }}>
              Sign in
            </button>
          )}
        </div>
      )}

      {/* Canvas area */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}
        onClick={() => { setMenuOpen(false) }}
      >
        {children}
      </div>

      {/* Playback bar if present */}
      {playbackBar}

      {/* Live stats bar during simulation */}
      {(isSimulating || isDone) && currentFrame && (
        <div style={{
          display: 'flex', gap: 16, padding: '6px 16px',
          background: '#131729', borderTop: '1px solid #2d3148',
          fontSize: 12, flexShrink: 0,
        }}>
          <span style={{ color: '#64748b' }}>t=<span style={{ color: '#a78bfa' }}>{currentFrame.time}s</span></span>
          <span style={{ color: '#64748b' }}>Active: <span style={{ color: '#a78bfa' }}>{currentFrame.active_count}/{currentFrame.total_count}</span></span>
          {currentFrame.panic && <span style={{ color: '#f87171' }}>🚨 PANIC</span>}
        </div>
      )}

      {/* Results bar */}
      {isDone && results && (
        <div style={{
          display: 'flex', gap: 16, padding: '8px 16px',
          background: '#131729', borderTop: '1px solid #2d3148',
          fontSize: 12, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ color: results.exit_rate_pct >= 90 ? '#4ade80' : results.exit_rate_pct >= 60 ? '#fbbf24' : '#f87171' }}>
            {results.exit_rate_pct}% exited
          </span>
          <span style={{ color: '#64748b' }}>Avg: <span style={{ color: '#e2e8f0' }}>{results.avg_speed} m/s</span></span>
          <span style={{ color: '#64748b' }}>Bottlenecks: <span style={{ color: '#fbbf24' }}>{results.bottleneck_count}</span></span>
        </div>
      )}

      {/* Overlays toggle row */}
      {isDone && (heatMap || (bottlenecks?.length > 0)) && (
        <div style={{
          display: 'flex', gap: 10, padding: '6px 16px',
          background: '#1a1d2e', borderTop: '1px solid #2d3148', flexShrink: 0,
        }}>
          {heatMap && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={showHeatMap} onChange={e => setShowHeatMap(e.target.checked)} />
              Heat Map
            </label>
          )}
          {bottlenecks?.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
              <input type="checkbox" checked={showBottlenecks} onChange={e => setShowBottlenecks(e.target.checked)} />
              Bottlenecks
            </label>
          )}
        </div>
      )}

      {/* Bottom toolbar */}
      {!isSimulating && !isDone && (
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#1a1d2e', borderTop: '1px solid #2d3148',
          padding: '6px 8px', gap: 4, flexShrink: 0,
          overflowX: 'auto',
        }}>
          {TOOLS.map(tool => (
            <button key={tool.id} onClick={() => setActiveTool(tool.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 10px', borderRadius: 8, border: '1px solid',
              borderColor: activeTool === tool.id ? '#6366f1' : 'transparent',
              background: activeTool === tool.id ? '#3730a3' : 'transparent',
              color: activeTool === tool.id ? 'white' : '#94a3b8',
              fontSize: 18, cursor: 'pointer', flexShrink: 0, minWidth: 48,
            }}>
              {tool.icon}
              <span style={{ fontSize: 9, marginTop: 2 }}>{tool.label}</span>
            </button>
          ))}

          {/* Settings panel toggle */}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <button onClick={() => setPanelOpen(v => !v)} style={{
              padding: '6px 12px', background: panelOpen ? '#3730a3' : '#2d3148',
              border: '1px solid #3d4266', borderRadius: 8, color: '#e2e8f0',
              fontSize: 12, cursor: 'pointer',
            }}>⚙ Settings</button>
          </div>
        </div>
      )}

      {/* Panic button during sim */}
      {isSimulating && (
        <div style={{ padding: '8px 12px', background: '#1a1d2e', borderTop: '1px solid #2d3148', flexShrink: 0 }}>
          {!panicMode ? (
            <button onClick={onTriggerPanic} style={{
              width: '100%', padding: '10px', background: '#dc2626', border: 'none',
              borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>🚨 Trigger Panic / Evacuation</button>
          ) : (
            <button onClick={onCalmDown} style={{
              width: '100%', padding: '10px', background: '#2d3148', border: '1px solid #3d4266',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
            }}>🕊 Calm Down</button>
          )}
        </div>
      )}

      {/* Settings panel slide-up */}
      {panelOpen && !isSimulating && !isDone && (
        <div style={{
          position: 'absolute', bottom: 60, left: 0, right: 0, zIndex: 100,
          background: '#1a1d2e', borderTop: '1px solid #2d3148',
          padding: 16, maxHeight: '50vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Settings</span>
            <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Agents: {agentCount}</div>
            <input type="range" min={5} max={500} step={5} value={agentCount}
              onChange={e => setAgentCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Sim Speed</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SPEED_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSimSpeed(opt.value)} style={{
                  flex: 1, padding: '7px', borderRadius: 6, border: '1px solid',
                  borderColor: simSpeed === opt.value ? '#6366f1' : '#2d3148',
                  background: simSpeed === opt.value ? '#3730a3' : 'transparent',
                  color: simSpeed === opt.value ? 'white' : '#64748b',
                  fontSize: 12, cursor: 'pointer',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const menuBtnStyle = {
  display: 'block', width: '100%', padding: '10px 14px',
  background: 'transparent', border: 'none', borderRadius: 6,
  color: '#e2e8f0', fontSize: 13, cursor: 'pointer', textAlign: 'left',
  transition: 'background 0.1s',
}
