import { useState, useCallback, useRef, useEffect } from "react"
import FloorPlanEditor from "./components/FloorPlanEditor"
import SimulationView from "./components/SimulationView"
import Toolbar from "./components/Toolbar"
import ControlPanel from "./components/ControlPanel"
import ResultsPanel from "./components/ResultsPanel"
import AuthModal from "./components/AuthModal"
import SavedPlans from "./components/SavedPlans"
import ShareButton from "./components/ShareButton"
import { TEMPLATES } from "./utils/templates"
import { supabase } from "./utils/supabase"
import "./App.css"

const DEFAULT_FLOOR_PLAN = TEMPLATES[0].floorPlan
const WS_URL = import.meta.env.VITE_WS_URL || "wss://ghostcrowd-production.up.railway.app"

export default function App() {
  const [activeTool, setActiveTool] = useState("wall")
  const [floorPlan, setFloorPlan] = useState(DEFAULT_FLOOR_PLAN)
  const [floorPlanName, setFloorPlanName] = useState("Untitled")
  const [agentCount, setAgentCount] = useState(50)
  const [simulationState, setSimulationState] = useState(null)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [results, setResults] = useState(null)
  const [heatMap, setHeatMap] = useState(null)
  const [bottlenecks, setBottlenecks] = useState(null)
  const [showHeatMap, setShowHeatMap] = useState(false)
  const [showBottlenecks, setShowBottlenecks] = useState(true)
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  // Batch 2 state
  const [simSpeed, setSimSpeed] = useState(1.0)
  const [spawnMode, setSpawnMode] = useState('instant')
  const [spawnSchedule, setSpawnSchedule] = useState([])

  const wsRef = useRef(null)

  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSavedPlans, setShowSavedPlans] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      const isSim = simulationState === "running"
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isSim) {
        e.preventDefault()
        if (undoStack.length === 0) return
        const prev = undoStack[undoStack.length - 1]
        setRedoStack(s => [...s, floorPlan]); setUndoStack(s => s.slice(0, -1)); setFloorPlan(prev)
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z')) && !isSim) {
        e.preventDefault()
        if (redoStack.length === 0) return
        const next = redoStack[redoStack.length - 1]
        setUndoStack(s => [...s, floorPlan]); setRedoStack(s => s.slice(0, -1)); setFloorPlan(next)
      }
      if (!isSim) {
        if (e.key === 'w' || e.key === 'W') setActiveTool('wall')
        if (e.key === 'd' || e.key === 'D') setActiveTool('door')
        if (e.key === 'r' || e.key === 'R') setActiveTool('obstacle')
        if (e.key === 's' || e.key === 'S') setActiveTool('select')
        if (e.key === 'e' || e.key === 'E') setActiveTool('erase')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undoStack, redoStack, floorPlan, simulationState])

  const handleSpeedChange = useCallback((newSpeed) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "speed", sim_speed: newSpeed }))
    }
  }, [])

  const startSimulation = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    setCurrentFrame(null); setResults(null); setHeatMap(null)
    setBottlenecks(null); setShowHeatMap(false)
    setSimulationState("running")

    const ws = new WebSocket(`${WS_URL}/simulate`)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({
      agent_count: agentCount,
      floor_plan: floorPlan,
      dt: 0.05,
      steps_per_frame: 3,
      max_steps: 3000,
      sim_speed: simSpeed,
      spawn_schedule: spawnMode === 'gradual' && spawnSchedule.length > 0 ? spawnSchedule : null,
    }))

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "frame") setCurrentFrame(msg)
      else if (msg.type === "done") {
        setResults(msg.summary); setHeatMap(msg.heat_map)
        setBottlenecks(msg.bottlenecks); setSimulationState("done")
      } else if (msg.type === "error") {
        console.error("Simulation error:", msg.message); setSimulationState(null)
      }
    }

    ws.onerror = () => setSimulationState(null)
    ws.onclose = () => {}
  }, [floorPlan, agentCount, simSpeed, spawnMode, spawnSchedule])

  const stopSimulation = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "cancel" })) } catch {}
      wsRef.current.close()
    }
    setSimulationState(null)
  }, [])

  const resetAll = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    setSimulationState(null); setCurrentFrame(null); setResults(null)
    setHeatMap(null); setBottlenecks(null); setShowHeatMap(false)
  }, [])

  const exportHeatMap = useCallback(() => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `ghostcrowd-${floorPlanName.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL("image/png"); link.click()
  }, [floorPlanName])

  const saveFloorPlan = useCallback(async () => {
    if (!user) { setShowAuthModal(true); return }
    setSaveStatus('saving')
    const existing = await supabase.from('floor_plans').select('id').eq('user_id', user.id).eq('name', floorPlanName).single()
    let error
    if (existing.data) {
      const res = await supabase.from('floor_plans').update({ data: floorPlan, updated_at: new Date().toISOString() }).eq('id', existing.data.id)
      error = res.error
    } else {
      const res = await supabase.from('floor_plans').insert({ user_id: user.id, name: floorPlanName, data: floorPlan })
      error = res.error
    }
    setSaveStatus(error ? 'error' : 'saved')
    setTimeout(() => setSaveStatus(null), 2000)
  }, [user, floorPlan, floorPlanName])

  const signOut = async () => { await supabase.auth.signOut(); setUser(null) }

  const isSimulating = simulationState === "running"
  const isDone = simulationState === "done"

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">👻 GhostCrowd</div>
        {!isSimulating && !isDone && (
          <input className="plan-name-input" value={floorPlanName} onChange={e => setFloorPlanName(e.target.value)} placeholder="Untitled" />
        )}
        {(isSimulating || isDone) && <div className="plan-name-display">{floorPlanName}</div>}
        <div className="header-actions">
          {!isSimulating && (
            <>
              <button className="header-btn" onClick={saveFloorPlan}>
                {saveStatus === 'saving' ? '...' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Error' : '💾 Save'}
              </button>
              <ShareButton user={user} floorPlan={floorPlan} floorPlanName={floorPlanName} onRequestAuth={() => setShowAuthModal(true)} />
              {user && <button className="header-btn" onClick={() => setShowSavedPlans(true)}>📁 My Plans</button>}
            </>
          )}
          {user ? (
            <button className="header-btn" onClick={signOut}>Sign out</button>
          ) : (
            <button className="header-btn header-btn-accent" onClick={() => setShowAuthModal(true)}>Sign in</button>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar-left">
          <Toolbar
            activeTool={activeTool} setActiveTool={setActiveTool}
            disabled={isSimulating} floorPlan={floorPlan} setFloorPlan={setFloorPlan}
            undoStack={undoStack} setUndoStack={setUndoStack}
            redoStack={redoStack} setRedoStack={setRedoStack}
            backgroundImage={backgroundImage} setBackgroundImage={setBackgroundImage}
          />
        </aside>

        <main className="canvas-area">
          {isSimulating || isDone ? (
            <SimulationView
              floorPlan={floorPlan} frame={currentFrame}
              heatMap={showHeatMap ? heatMap : null}
              bottlenecks={showBottlenecks && isDone ? bottlenecks : null}
              isDone={isDone}
            />
          ) : (
            <FloorPlanEditor
              floorPlan={floorPlan} setFloorPlan={setFloorPlan}
              activeTool={activeTool} setActiveTool={setActiveTool}
              undoStack={undoStack} setUndoStack={setUndoStack}
              redoStack={redoStack} setRedoStack={setRedoStack}
              backgroundImage={backgroundImage}
            />
          )}
        </main>

        <aside className="sidebar-right">
          <ControlPanel
            agentCount={agentCount} setAgentCount={setAgentCount}
            isSimulating={isSimulating} isDone={isDone}
            onStart={startSimulation} onStop={stopSimulation}
            onReset={resetAll} onExport={exportHeatMap}
            currentFrame={currentFrame}
            showHeatMap={showHeatMap} setShowHeatMap={setShowHeatMap}
            showBottlenecks={showBottlenecks} setShowBottlenecks={setShowBottlenecks}
            heatMap={heatMap} bottlenecks={bottlenecks}
            simSpeed={simSpeed} setSimSpeed={setSimSpeed}
            spawnMode={spawnMode} setSpawnMode={setSpawnMode}
            spawnSchedule={spawnSchedule} setSpawnSchedule={setSpawnSchedule}
            floorPlan={floorPlan} setFloorPlan={setFloorPlan}
            onSpeedChange={handleSpeedChange}
          />
          {isDone && results && <ResultsPanel results={results} />}
        </aside>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onAuth={setUser} />}
      {showSavedPlans && (
        <SavedPlans user={user}
          onLoad={(data, name) => { setFloorPlan(data); setFloorPlanName(name) }}
          onClose={() => setShowSavedPlans(false)} />
      )}
    </div>
  )
}
