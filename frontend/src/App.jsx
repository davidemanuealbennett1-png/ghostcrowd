import { useState, useCallback, useRef, useEffect } from "react"
import FloorPlanEditor from "./components/FloorPlanEditor"
import SimulationView from "./components/SimulationView"
import Toolbar from "./components/Toolbar"
import ControlPanel from "./components/ControlPanel"
import ResultsPanel from "./components/ResultsPanel"
import AuthModal from "./components/AuthModal"
import SavedPlans from "./components/SavedPlans"
import ShareButton from "./components/ShareButton"
import PricingModal from "./components/PricingModal"
import MobileLayout from "./components/MobileLayout"
import { DEFAULT_PRESETS } from "./components/AgentTypeEditor"
import { TEMPLATES } from "./utils/templates"
import { supabase } from "./utils/supabase"
import { generatePDFReport } from "./utils/pdfReport"
import { usePlaybackRecorder } from "./utils/usePlaybackRecorder"
import { useSubscription } from "./utils/useSubscription"
import "./App.css"

const DEFAULT_FLOOR_PLAN = TEMPLATES[0].floorPlan
const WS_URL = import.meta.env.VITE_WS_URL || "wss://ghostcrowd-production.up.railway.app"

function getUpgradeStatus() {
  const params = new URLSearchParams(window.location.search)
  return params.get('upgrade')
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function App() {
  const isMobile = useIsMobile()

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
  const [simSpeed, setSimSpeed] = useState(1.0)
  const [spawnMode, setSpawnMode] = useState('instant')
  const [spawnSchedule, setSpawnSchedule] = useState([])
  const [agentTypes, setAgentTypes] = useState(DEFAULT_PRESETS)
  const [panicMode, setPanicMode] = useState(false)

  const wsRef = useRef(null)

  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSavedPlans, setShowSavedPlans] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [upgradeStatus, setUpgradeStatus] = useState(getUpgradeStatus())

  const { tier, limits, canUse } = useSubscription(user)

  const {
    playback, playbackFrame, playbackProgress,
    hasRecording, startRecording, recordFrame, stopRecording,
    startPlayback, stopPlayback, seekPlayback, frameCount,
  } = usePlaybackRecorder()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (upgradeStatus) {
      window.history.replaceState({}, '', '/app')
      setTimeout(() => setUpgradeStatus(null), 4000)
    }
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "speed", sim_speed: newSpeed }))
    }
  }, [])

  const handleTriggerPanic = useCallback(() => {
    setPanicMode(true)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "panic" }))
    }
  }, [])

  const handleCalmDown = useCallback(() => {
    setPanicMode(false)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "calm" }))
    }
  }, [])

  const startSimulation = useCallback(() => {
    const cappedAgents = Math.min(agentCount, limits.agents)
    if (wsRef.current) wsRef.current.close()
    setCurrentFrame(null); setResults(null); setHeatMap(null)
    setBottlenecks(null); setShowHeatMap(false); setPanicMode(false)
    setSimulationState("running")
    startRecording()

    const ws = new WebSocket(`${WS_URL}/simulate`)
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({
      agent_count: cappedAgents, floor_plan: floorPlan,
      dt: 0.05, steps_per_frame: 3, max_steps: 3000,
      sim_speed: simSpeed,
      spawn_schedule: spawnMode === 'gradual' && spawnSchedule.length > 0 ? spawnSchedule : null,
      panic_mode: false, custom_agent_types: agentTypes,
    }))

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "frame") {
        setCurrentFrame(msg); recordFrame(msg)
        if (msg.panic !== undefined) setPanicMode(msg.panic)
      } else if (msg.type === "done") {
        setResults(msg.summary); setHeatMap(msg.heat_map)
        setBottlenecks(msg.bottlenecks); setSimulationState("done"); stopRecording()
      } else if (msg.type === "error") {
        console.error("Simulation error:", msg.message); setSimulationState(null); stopRecording()
      }
    }

    ws.onerror = () => { setSimulationState(null); stopRecording() }
    ws.onclose = () => {}
  }, [floorPlan, agentCount, limits, simSpeed, spawnMode, spawnSchedule, agentTypes, startRecording, recordFrame, stopRecording])

  const stopSimulation = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "cancel" })) } catch {}
      wsRef.current.close()
    }
    setSimulationState(null); setPanicMode(false); stopRecording()
  }, [stopRecording])

  const resetAll = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    stopPlayback()
    setSimulationState(null); setCurrentFrame(null); setResults(null)
    setHeatMap(null); setBottlenecks(null); setShowHeatMap(false); setPanicMode(false)
  }, [stopPlayback])

  const exportHeatMap = useCallback(() => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `ghostcrowd-${floorPlanName.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL("image/png"); link.click()
  }, [floorPlanName])

  const exportPDF = useCallback(async () => {
    if (!canUse('pdf')) { setShowPricing(true); return }
    const canvas = document.querySelector("canvas")
    await generatePDFReport({ floorPlanName, results, bottlenecks, agentTypes, agentCount, floorPlan, canvasElement: canvas })
  }, [floorPlanName, results, bottlenecks, agentTypes, agentCount, floorPlan, canUse])

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
  const activeFrame = playback ? playbackFrame : currentFrame

  const canvas = isSimulating || isDone ? (
    <SimulationView
      floorPlan={floorPlan} frame={activeFrame}
      heatMap={showHeatMap ? heatMap : null}
      bottlenecks={showBottlenecks && isDone ? bottlenecks : null}
      isDone={isDone && !playback} agentTypes={agentTypes}
    />
  ) : (
    <FloorPlanEditor
      floorPlan={floorPlan} setFloorPlan={setFloorPlan}
      activeTool={activeTool} setActiveTool={setActiveTool}
      undoStack={undoStack} setUndoStack={setUndoStack}
      redoStack={redoStack} setRedoStack={setRedoStack}
      backgroundImage={backgroundImage}
    />
  )

  const playbackBar = isDone && hasRecording ? (
    <div style={{
      background: '#1a1d2e', borderTop: '1px solid #2d3148',
      padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      {!playback ? (
        <button onClick={() => startPlayback(simSpeed)} style={{
          padding: '5px 12px', background: '#3730a3', border: '1px solid #6366f1',
          borderRadius: 6, color: 'white', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>▶ Replay</button>
      ) : (
        <button onClick={stopPlayback} style={{
          padding: '5px 12px', background: '#1e2235', border: '1px solid #2d3148',
          borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>⏹ Stop</button>
      )}
      <input type="range" min={0} max={100} value={playbackProgress}
        onChange={e => seekPlayback(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#6366f1' }} />
      <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{frameCount}f</span>
    </div>
  ) : null

  const sharedProps = {
    activeTool, setActiveTool,
    floorPlan, agentCount, setAgentCount,
    isSimulating, isDone,
    onStart: startSimulation, onStop: stopSimulation, onReset: resetAll,
    currentFrame: activeFrame,
    user, onSignIn: () => setShowAuthModal(true), onSignOut: signOut,
    onSave: saveFloorPlan, saveStatus,
    onShare: () => {},
    onUpgrade: () => setShowPricing(true), tier,
    onExport: exportHeatMap, onExportPDF: exportPDF,
    heatMap, showHeatMap, setShowHeatMap,
    bottlenecks, showBottlenecks, setShowBottlenecks,
    panicMode, onTriggerPanic: handleTriggerPanic, onCalmDown: handleCalmDown,
    simSpeed, setSimSpeed,
    results,
    playbackBar,
    agentTypes, setAgentTypes,
  }

  if (isMobile) {
    return (
      <>
        <MobileLayout {...sharedProps}>
          {canvas}
        </MobileLayout>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onAuth={setUser} />}
        {showPricing && <PricingModal user={user} currentTier={tier} onClose={() => setShowPricing(false)} onRequestAuth={() => { setShowPricing(false); setShowAuthModal(true) }} />}
      </>
    )
  }

  // ── Desktop layout ──
  return (
    <div className="app">
      {upgradeStatus === 'success' && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(74,222,128,0.15)', border: '1px solid #4ade80',
          borderRadius: 8, padding: '10px 20px', zIndex: 200, fontSize: 13, color: '#4ade80',
        }}>🎉 Upgrade successful! Welcome to {tier}.</div>
      )}

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
          <button className="header-btn" onClick={() => setShowPricing(true)}
            style={{ borderColor: tier !== 'free' ? 'rgba(99,102,241,0.5)' : '#2d3148', color: tier !== 'free' ? '#a5b4fc' : '#64748b' }}>
            {tier === 'free' ? '⬆ Upgrade' : `✨ ${tier.charAt(0).toUpperCase() + tier.slice(1)}`}
          </button>
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
            agentTypes={agentTypes} setAgentTypes={setAgentTypes}
          />
        </aside>

        <main className="canvas-area" style={{ flexDirection: 'column', gap: 0 }}>
          {canvas}
          {playbackBar}
        </main>

        <aside className="sidebar-right">
          <ControlPanel
            agentCount={agentCount} setAgentCount={setAgentCount}
            isSimulating={isSimulating} isDone={isDone}
            onStart={startSimulation} onStop={stopSimulation}
            onReset={resetAll} onExport={exportHeatMap} onExportPDF={exportPDF}
            currentFrame={activeFrame}
            showHeatMap={showHeatMap} setShowHeatMap={setShowHeatMap}
            showBottlenecks={showBottlenecks} setShowBottlenecks={setShowBottlenecks}
            heatMap={heatMap} bottlenecks={bottlenecks}
            simSpeed={simSpeed} setSimSpeed={setSimSpeed}
            spawnMode={spawnMode} setSpawnMode={setSpawnMode}
            spawnSchedule={spawnSchedule} setSpawnSchedule={setSpawnSchedule}
            floorPlan={floorPlan} setFloorPlan={setFloorPlan}
            onSpeedChange={handleSpeedChange}
            panicMode={panicMode} onTriggerPanic={handleTriggerPanic} onCalmDown={handleCalmDown}
            tier={tier} limits={limits} onUpgrade={() => setShowPricing(true)}
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
      {showPricing && (
        <PricingModal user={user} currentTier={tier} onClose={() => setShowPricing(false)}
          onRequestAuth={() => { setShowPricing(false); setShowAuthModal(true) }} />
      )}
    </div>
  )
}
