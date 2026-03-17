import { useState } from 'react'

const SPEED_OPTIONS = [
  { label: '0.25×', value: 0.25 },
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1.0 },
  { label: '2×', value: 2.0 },
  { label: '4×', value: 4.0 },
]

export default function ControlPanel({
  agentCount, setAgentCount,
  isSimulating, isDone,
  onStart, onStop, onReset, onExport,
  currentFrame,
  showHeatMap, setShowHeatMap,
  showBottlenecks, setShowBottlenecks,
  heatMap, bottlenecks,
  simSpeed, setSimSpeed,
  spawnMode, setSpawnMode,
  spawnSchedule, setSpawnSchedule,
  floorPlan, setFloorPlan,
  onSpeedChange,
  panicMode, onTriggerPanic, onCalmDown,
}) {
  const [showZoneWeights, setShowZoneWeights] = useState(false)

  const updateSpawnWeight = (idx, weight) => {
    setFloorPlan(fp => ({ ...fp, spawn_zones: fp.spawn_zones.map((z, i) => i === idx ? { ...z, weight: Number(weight) } : z) }))
  }
  const updateExitWeight = (idx, weight) => {
    setFloorPlan(fp => ({ ...fp, exit_zones: fp.exit_zones.map((z, i) => i === idx ? { ...z, weight: Number(weight) } : z) }))
  }
  const addScheduleEntry = () => {
    const lastTime = spawnSchedule.length > 0 ? spawnSchedule[spawnSchedule.length-1].time + 30 : 0
    setSpawnSchedule([...spawnSchedule, { time: lastTime, rate: 2 }])
  }
  const removeScheduleEntry = (idx) => setSpawnSchedule(spawnSchedule.filter((_, i) => i !== idx))
  const updateScheduleEntry = (idx, field, val) => setSpawnSchedule(spawnSchedule.map((e, i) => i === idx ? { ...e, [field]: Number(val) } : e))

  return (
    <div className="control-panel">

      {/* Agent count */}
      <div className="control-section">
        <div className="control-label">Agents</div>
        <div className="control-value">{agentCount} people</div>
        <input type="range" className="slider" min={5} max={500} step={5}
          value={agentCount} onChange={e => setAgentCount(Number(e.target.value))} disabled={isSimulating} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}>
          <span>5</span><span>500</span>
        </div>
      </div>

      {/* Spawn mode */}
      {!isSimulating && !isDone && (
        <div className="control-section">
          <div className="control-label">Spawn Mode</div>
          <div style={{ display:'flex', gap:6 }}>
            {['instant','gradual'].map(mode => (
              <button key={mode} onClick={() => setSpawnMode(mode)} style={{
                flex:1, padding:'6px', borderRadius:6, border:'1px solid',
                borderColor: spawnMode===mode ? '#6366f1' : '#2d3148',
                background: spawnMode===mode ? '#3730a3' : 'transparent',
                color: spawnMode===mode ? 'white' : '#94a3b8',
                fontSize:12, cursor:'pointer', textTransform:'capitalize',
              }}>{mode}</button>
            ))}
          </div>
          {spawnMode === 'gradual' && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:11, color:'#64748b' }}>Spawn schedule</span>
                <button onClick={addScheduleEntry} style={{ fontSize:11, color:'#6366f1', background:'none', border:'none', cursor:'pointer' }}>+ Add</button>
              </div>
              {spawnSchedule.length === 0 && <div style={{ fontSize:11, color:'#475569' }}>No entries — uses 2 agents/sec</div>}
              {spawnSchedule.map((entry, i) => (
                <div key={i} style={{ display:'flex', gap:4, alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:'#64748b', width:20 }}>t=</span>
                  <input type="number" value={entry.time} onChange={e => updateScheduleEntry(i,'time',e.target.value)}
                    style={{ width:40, padding:'2px 4px', background:'#0f1117', border:'1px solid #2d3148', borderRadius:4, color:'#e2e8f0', fontSize:11 }} />
                  <span style={{ fontSize:10, color:'#64748b' }}>s →</span>
                  <input type="number" value={entry.rate} onChange={e => updateScheduleEntry(i,'rate',e.target.value)}
                    style={{ width:40, padding:'2px 4px', background:'#0f1117', border:'1px solid #2d3148', borderRadius:4, color:'#e2e8f0', fontSize:11 }} />
                  <span style={{ fontSize:10, color:'#64748b' }}>/s</span>
                  <button onClick={() => removeScheduleEntry(i)} style={{ color:'#f87171', background:'none', border:'none', cursor:'pointer', fontSize:12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zone weights */}
      {!isSimulating && !isDone && (floorPlan.spawn_zones.length > 1 || floorPlan.exit_zones.length > 1) && (
        <div className="control-section">
          <button onClick={() => setShowZoneWeights(v => !v)}
            style={{ background:'none', border:'none', color:'#6366f1', fontSize:12, cursor:'pointer', textAlign:'left', padding:0 }}>
            {showZoneWeights ? '▾' : '▸'} Zone weights
          </button>
          {showZoneWeights && (
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
              {floorPlan.spawn_zones.map((z, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'#4ade80', width:60 }}>Spawn {i+1}</span>
                  <input type="range" min={0.1} max={5} step={0.1} value={z.weight||1} onChange={e => updateSpawnWeight(i, e.target.value)} style={{ flex:1, accentColor:'#4ade80' }} />
                  <span style={{ fontSize:11, color:'#64748b', width:24 }}>{(z.weight||1).toFixed(1)}x</span>
                </div>
              ))}
              {floorPlan.exit_zones.map((z, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'#f87171', width:60 }}>Exit {i+1}</span>
                  <input type="range" min={0.1} max={5} step={0.1} value={z.weight||1} onChange={e => updateExitWeight(i, e.target.value)} style={{ flex:1, accentColor:'#f87171' }} />
                  <span style={{ fontSize:11, color:'#64748b', width:24 }}>{(z.weight||1).toFixed(1)}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sim speed */}
      <div className="control-section">
        <div className="control-label">Sim Speed</div>
        <div style={{ display:'flex', gap:4 }}>
          {SPEED_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => { setSimSpeed(opt.value); if (isSimulating && onSpeedChange) onSpeedChange(opt.value) }} style={{
              flex:1, padding:'5px 2px', borderRadius:5, border:'1px solid',
              borderColor: simSpeed===opt.value ? '#6366f1' : '#2d3148',
              background: simSpeed===opt.value ? '#3730a3' : 'transparent',
              color: simSpeed===opt.value ? 'white' : '#64748b',
              fontSize:11, cursor:'pointer',
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Panic button */}
      {isSimulating && (
        <div className="control-section">
          <div className="control-label">Evacuation</div>
          {!panicMode ? (
            <button className="btn btn-danger" onClick={onTriggerPanic} style={{ fontSize:12 }}>🚨 Trigger Panic</button>
          ) : (
            <button className="btn btn-secondary" onClick={onCalmDown} style={{ fontSize:12 }}>🕊 Calm Down</button>
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>Panic: agents rush to exits</div>
        </div>
      )}

      {/* Run/stop/reset */}
      {!isSimulating && !isDone && <button className="btn btn-primary" onClick={onStart}>▶ Run Simulation</button>}
      {isSimulating && <button className="btn btn-danger" onClick={onStop}>⏹ Stop</button>}
      {isDone && (
        <>
          <button className="btn btn-secondary" onClick={onReset}>↩ Back to Editor</button>
          {heatMap && <button className="btn btn-secondary" onClick={onExport} style={{ marginTop:4 }}>⬇ Export PNG</button>}
        </>
      )}

      {/* Live stats */}
      {(isSimulating || isDone) && currentFrame && (
        <div className="control-section">
          <div className="control-label">Live Stats</div>
          <div className="stat-row"><span className="stat-label">Time</span><span className="stat-value">{currentFrame.time}s</span></div>
          <div className="stat-row"><span className="stat-label">Active</span><span className="stat-value">{currentFrame.active_count} / {currentFrame.total_count}</span></div>
          <div className="stat-row"><span className="stat-label">Exited</span><span className="stat-value">{currentFrame.total_count - currentFrame.active_count}</span></div>
          {currentFrame.panic && <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>🚨 PANIC MODE ACTIVE</div>}
        </div>
      )}

      {/* Overlays */}
      {isDone && (heatMap || bottlenecks) && (
        <div className="control-section">
          <div className="control-label">Overlays</div>
          {heatMap && (
            <div className="toggle-row" style={{ marginBottom:8 }}>
              <span style={{ fontSize:12, color:'#94a3b8' }}>Heat Map</span>
              <label className="toggle"><input type="checkbox" checked={showHeatMap} onChange={e => setShowHeatMap(e.target.checked)} /><span className="toggle-slider" /></label>
            </div>
          )}
          {bottlenecks?.length > 0 && (
            <div className="toggle-row">
              <span style={{ fontSize:12, color:'#94a3b8' }}>Bottlenecks</span>
              <label className="toggle"><input type="checkbox" checked={showBottlenecks} onChange={e => setShowBottlenecks(e.target.checked)} /><span className="toggle-slider" /></label>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="control-section">
        <div className="control-label">Legend</div>
        <div className="zone-legend">
          <div><span className="zone-dot" style={{ background:"rgba(74,222,128,0.4)" }} />Spawn</div>
          <div><span className="zone-dot" style={{ background:"rgba(248,113,113,0.4)" }} />Exit</div>
          <div><span className="zone-dot" style={{ background:"#60a5fa" }} />Wall</div>
          <div><span className="zone-dot" style={{ background:"#fbbf24" }} />Bottleneck !</div>
        </div>
      </div>
    </div>
  )
}
