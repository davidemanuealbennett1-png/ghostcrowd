export default function ResultsPanel({ results }) {
  if (!results) return null

  const exitPct = results.exit_rate_pct
  const exitClass = exitPct >= 90 ? "good" : exitPct >= 60 ? "warn" : "bad"

  const bottleneckClass = results.bottleneck_count === 0 ? "good"
    : results.bottleneck_count <= 3 ? "warn" : "bad"

  return (
    <div className="results-panel">
      <div className="results-title">Simulation Results</div>

      <div className="result-row">
        <span className="result-label">Total agents</span>
        <span className="result-value">{results.total_agents}</span>
      </div>
      <div className="result-row">
        <span className="result-label">Exited</span>
        <span className={`result-value ${exitClass}`}>{results.agents_exited}</span>
      </div>
      <div className="result-row">
        <span className="result-label">Exit rate</span>
        <span className={`result-value ${exitClass}`}>{results.exit_rate_pct}%</span>
      </div>
      <div className="result-row">
        <span className="result-label">Avg speed</span>
        <span className="result-value">{results.avg_speed} m/s</span>
      </div>
      <div className="result-row">
        <span className="result-label">Bottlenecks</span>
        <span className={`result-value ${bottleneckClass}`}>{results.bottleneck_count} zones</span>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
        {exitPct >= 90 && "✅ Good flow — most agents reached the exit."}
        {exitPct < 90 && exitPct >= 60 && "⚠️ Some agents got stuck. Check bottleneck zones."}
        {exitPct < 60 && "❌ Poor flow — consider widening exits or removing obstacles."}
      </div>
    </div>
  )
}
