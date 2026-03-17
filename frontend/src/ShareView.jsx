import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import SimulationView from './components/SimulationView'
import ControlPanel from './components/ControlPanel'
import ResultsPanel from './components/ResultsPanel'
import FloorPlanEditor from './components/FloorPlanEditor'
import './App.css'

const WS_URL = import.meta.env.VITE_WS_URL || "wss://ghostcrowd-production.up.railway.app"

export default function ShareView() {
  const { shareId } = useParams()
  const [floorPlan, setFloorPlan] = useState(null)
  const [planName, setPlanName] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [agentCount, setAgentCount] = useState(50)
  const [simulationState, setSimulationState] = useState(null)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [results, setResults] = useState(null)
  const [heatMap, setHeatMap] = useState(null)
  const [bottlenecks, setBottlenecks] = useState(null)
  const [showHeatMap, setShowHeatMap] = useState(false)
  const [showBottlenecks, setShowBottlenecks] = useState(true)
  const wsRef = useRef(null)

  useEffect(() => {
    const fetchPlan = async () => {
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_public', true)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setFloorPlan(data.data)
        setPlanName(data.name)
      }
      setLoading(false)
    }
    fetchPlan()
  }, [shareId])

  const startSimulation = useCallback(() => {
    if (!floorPlan) return
    if (wsRef.current) wsRef.current.close()
    setCurrentFrame(null)
    setResults(null)
    setHeatMap(null)
    setBottlenecks(null)
    setShowHeatMap(false)
    setSimulationState("running")

    const ws = new WebSocket(`${WS_URL}/simulate`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        agent_count: agentCount,
        floor_plan: floorPlan,
        dt: 0.05,
        steps_per_frame: 3,
        max_steps: 3000,
      }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "frame") setCurrentFrame(msg)
      else if (msg.type === "done") {
        setResults(msg.summary)
        setHeatMap(msg.heat_map)
        setBottlenecks(msg.bottlenecks)
        setSimulationState("done")
      }
    }

    ws.onerror = () => setSimulationState(null)
  }, [floorPlan, agentCount])

  const stopSimulation = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "cancel" })) } catch {}
      wsRef.current.close()
    }
    setSimulationState(null)
  }, [])

  const resetAll = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    setSimulationState(null)
    setCurrentFrame(null)
    setResults(null)
    setHeatMap(null)
    setBottlenecks(null)
    setShowHeatMap(false)
  }, [])

  const exportHeatMap = useCallback(() => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `ghostcrowd-${planName}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }, [planName])

  if (loading) return (
    <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 16 }}>Loading floor plan...</div>
    </div>
  )

  if (notFound) return (
    <div className="app" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, flexDirection: 'column' }}>
      <div style={{ fontSize: 48 }}>👻</div>
      <div style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700 }}>Floor plan not found</div>
      <div style={{ color: '#64748b', fontSize: 14 }}>This link may have expired or been removed.</div>
      <Link to="/app" style={{ marginTop: 8, textDecoration: 'none', padding: '10px 24px', borderRadius: 8, background: '#6366f1', color: 'white', fontWeight: 600 }}>
        Create your own →
      </Link>
    </div>
  )

  const isSimulating = simulationState === "running"
  const isDone = simulationState === "done"

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>👻 GhostCrowd</Link>
        <div className="plan-name-display" style={{ marginLeft: 16 }}>{planName}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Shared floor plan</span>
          <Link to="/app" className="header-btn" style={{ textDecoration: 'none' }}>
            Create your own →
          </Link>
        </div>
      </header>

      <div className="app-body">
        <main className="canvas-area">
          {isSimulating || isDone ? (
            <SimulationView
              floorPlan={floorPlan}
              frame={currentFrame}
              heatMap={showHeatMap ? heatMap : null}
              bottlenecks={showBottlenecks && isDone ? bottlenecks : null}
              isDone={isDone}
            />
          ) : (
            <FloorPlanEditor
              floorPlan={floorPlan}
              setFloorPlan={() => {}}
              activeTool="select"
              setActiveTool={() => {}}
            />
          )}
        </main>

        <aside className="sidebar-right">
          <ControlPanel
            agentCount={agentCount}
            setAgentCount={setAgentCount}
            isSimulating={isSimulating}
            isDone={isDone}
            onStart={startSimulation}
            onStop={stopSimulation}
            onReset={resetAll}
            onExport={exportHeatMap}
            currentFrame={currentFrame}
            showHeatMap={showHeatMap}
            setShowHeatMap={setShowHeatMap}
            showBottlenecks={showBottlenecks}
            setShowBottlenecks={setShowBottlenecks}
            heatMap={heatMap}
            bottlenecks={bottlenecks}
          />
          {isDone && results && <ResultsPanel results={results} />}
        </aside>
      </div>
    </div>
  )
}
