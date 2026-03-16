import { useState, useCallback, useRef } from "react"
import FloorPlanEditor from "./components/FloorPlanEditor"
import SimulationView from "./components/SimulationView"
import Toolbar from "./components/Toolbar"
import ControlPanel from "./components/ControlPanel"
import ResultsPanel from "./components/ResultsPanel"
import { TEMPLATES } from "./utils/templates"
import "./App.css"

const DEFAULT_FLOOR_PLAN = TEMPLATES[0].floorPlan

export default function App() {
  const [activeTool, setActiveTool] = useState("wall")
  const [floorPlan, setFloorPlan] = useState(DEFAULT_FLOOR_PLAN)
  const [agentCount, setAgentCount] = useState(50)
  const [simulationState, setSimulationState] = useState(null)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [results, setResults] = useState(null)
  const [heatMap, setHeatMap] = useState(null)
  const [bottlenecks, setBottlenecks] = useState(null)
  const [showHeatMap, setShowHeatMap] = useState(false)
  const [showBottlenecks, setShowBottlenecks] = useState(true)
  const wsRef = useRef(null)
  const simViewRef = useRef(null)

  const startSimulation = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    setCurrentFrame(null)
    setResults(null)
    setHeatMap(null)
    setBottlenecks(null)
    setShowHeatMap(false)
    setSimulationState("running")

    const ws = new WebSocket("ws://localhost:8000/simulate")
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
      if (msg.type === "frame") {
        setCurrentFrame(msg)
      } else if (msg.type === "done") {
        setResults(msg.summary)
        setHeatMap(msg.heat_map)
        setBottlenecks(msg.bottlenecks)
        setSimulationState("done")
      } else if (msg.type === "error") {
        console.error("Simulation error:", msg.message)
        setSimulationState(null)
      }
    }

    ws.onerror = () => setSimulationState(null)
    ws.onclose = () => {}
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
    link.download = "ghostcrowd-heatmap.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }, [])

  const isSimulating = simulationState === "running"
  const isDone = simulationState === "done"

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">👻 GhostCrowd</div>
        <div className="header-subtitle">Pedestrian flow simulator</div>
      </header>

      <div className="app-body">
        <aside className="sidebar-left">
          <Toolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            disabled={isSimulating}
            floorPlan={floorPlan}
            setFloorPlan={setFloorPlan}
          />
        </aside>

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
              setFloorPlan={setFloorPlan}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
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
          {isDone && results && (
            <ResultsPanel results={results} />
          )}
        </aside>
      </div>
    </div>
  )
}
