export default function ControlPanel({
  agentCount, setAgentCount,
  isSimulating, isDone,
  onStart, onStop, onReset, onExport,
  currentFrame,
  showHeatMap, setShowHeatMap,
  showBottlenecks, setShowBottlenecks,
  heatMap, bottlenecks,
}) {
  return (
    <div className="control-panel">
      <div className="control-section">
        <div className="control-label">Agents</div>
        <div className="control-value">{agentCount} people</div>
        <input
          type="range"
          className="slider"
          min={5} max={500} step={5}
          value={agentCount}
          onChange={e => setAgentCount(Number(e.target.value))}
          disabled={isSimulating}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
          <span>5</span><span>500</span>
        </div>
      </div>

      {!isSimulating && !isDone && (
        <button className="btn btn-primary" onClick={onStart}>
          ▶ Run Simulation
        </button>
      )}

      {isSimulating && (
        <button className="btn btn-danger" onClick={onStop}>
          ⏹ Stop
        </button>
      )}

      {isDone && (
        <>
          <button className="btn btn-secondary" onClick={onReset}>
            ↩ Back to Editor
          </button>
          {heatMap && (
            <button className="btn btn-secondary" onClick={onExport} style={{ marginTop: 4 }}>
              ⬇ Export PNG
            </button>
          )}
        </>
      )}

      {(isSimulating || isDone) && currentFrame && (
        <div className="control-section">
          <div className="control-label">Live Stats</div>
          <div className="stat-row">
            <span className="stat-label">Time</span>
            <span className="stat-value">{currentFrame.time}s</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Active</span>
            <span className="stat-value">{currentFrame.active_count} / {currentFrame.total_count}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Exited</span>
            <span className="stat-value">{currentFrame.total_count - currentFrame.active_count}</span>
          </div>
        </div>
      )}

      {isDone && (heatMap || bottlenecks) && (
        <div className="control-section">
          <div className="control-label">Overlays</div>
          {heatMap && (
            <div className="toggle-row" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Heat Map</span>
              <label className="toggle">
                <input type="checkbox" checked={showHeatMap} onChange={e => setShowHeatMap(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          )}
          {bottlenecks && bottlenecks.length > 0 && (
            <div className="toggle-row">
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Bottlenecks</span>
              <label className="toggle">
                <input type="checkbox" checked={showBottlenecks} onChange={e => setShowBottlenecks(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          )}
        </div>
      )}

      <div className="control-section">
        <div className="control-label">Legend</div>
        <div className="zone-legend">
          <div><span className="zone-dot" style={{ background: "rgba(74,222,128,0.4)" }} />Spawn</div>
          <div><span className="zone-dot" style={{ background: "rgba(248,113,113,0.4)" }} />Exit</div>
          <div><span className="zone-dot" style={{ background: "#60a5fa" }} />Wall</div>
          <div><span className="zone-dot" style={{ background: "#4ade80" }} />Sparse</div>
          <div><span className="zone-dot" style={{ background: "#f87171" }} />Dense</div>
          <div><span className="zone-dot" style={{ background: "#fbbf24" }} />Bottleneck</div>
        </div>
      </div>
    </div>
  )
}
