import { useState } from "react"
import { TEMPLATES } from "../utils/templates"
import RoomSettings from "./RoomSettings"
import AgentTypeEditor from "./AgentTypeEditor"

const TOOLS = [
  { id: "wall", icon: "📏", label: "Wall" },
  { id: "door", icon: "🚪", label: "Door" },
  { id: "obstacle", icon: "⬛", label: "Table" },
  { id: "spawn", icon: "🟢", label: "Spawn" },
  { id: "exit", icon: "🔴", label: "Exit" },
  { id: "select", icon: "↖", label: "Select" },
  { id: "erase", icon: "🗑", label: "Erase" },
]

export default function Toolbar({
  activeTool, setActiveTool, disabled,
  floorPlan, setFloorPlan,
  undoStack, setUndoStack, redoStack, setRedoStack,
  backgroundImage, setBackgroundImage,
  agentTypes, setAgentTypes,
}) {
  const [showTemplates, setShowTemplates] = useState(false)

  const clearAll = () => {
    if (confirm("Clear all walls and objects?")) {
      setUndoStack(s => [...s, floorPlan])
      setRedoStack([])
      setFloorPlan(fp => ({ ...fp, walls: [], obstacles: [], spawn_zones: [], exit_zones: [] }))
    }
  }

  const undo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack(s => [...s, floorPlan])
    setUndoStack(s => s.slice(0, -1))
    setFloorPlan(prev)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack(s => [...s, floorPlan])
    setRedoStack(s => s.slice(0, -1))
    setFloorPlan(next)
  }

  const applyTemplate = (template) => {
    setUndoStack(s => [...s, floorPlan])
    setRedoStack([])
    setFloorPlan(template.floorPlan)
    setShowTemplates(false)
  }

  return (
    <>
      {TOOLS.map((tool) => (
        <div key={tool.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button
            className={`tool-btn ${activeTool === tool.id ? "active" : ""}`}
            onClick={() => setActiveTool(tool.id)}
            disabled={disabled}
            title={tool.label}
          >
            {tool.icon}
          </button>
          <div className="tool-label">{tool.label}</div>
        </div>
      ))}

      <div className="tool-divider" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <button className="tool-btn" onClick={undo} disabled={disabled || undoStack.length === 0} title="Undo (Ctrl+Z)">↩</button>
        <div className="tool-label">Undo</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <button className="tool-btn" onClick={redo} disabled={disabled || redoStack.length === 0} title="Redo (Ctrl+Y)">↪</button>
        <div className="tool-label">Redo</div>
      </div>

      <div className="tool-divider" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <button className="tool-btn" onClick={clearAll} disabled={disabled} title="Clear everything">🧹</button>
        <div className="tool-label">Clear</div>
      </div>

      {/* Templates — fixed position popup */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <button
          className={`tool-btn ${showTemplates ? "active" : ""}`}
          onClick={() => setShowTemplates(v => !v)}
          disabled={disabled}
          title="Load a template"
        >📐</button>
        <div className="tool-label">Template</div>

        {showTemplates && (
          <div style={{
            position: "fixed",
            left: "72px",
            top: "220px",
            background: "#1a1d2e",
            border: "1px solid #2d3148",
            borderRadius: 8,
            padding: 8,
            width: 210,
            zIndex: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            maxHeight: "60vh",
            overflowY: "auto",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8, padding: "0 4px" }}>
              Templates
            </div>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                style={{
                  display: "flex", flexDirection: "column", width: "100%",
                  padding: "8px 10px", background: "transparent", border: "none",
                  borderRadius: 6, cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#2d3148"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontSize: 13, color: "#e2e8f0" }}>{t.icon} {t.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Agent type editor */}
      <AgentTypeEditor
        agentTypes={agentTypes}
        setAgentTypes={setAgentTypes}
        disabled={disabled}
      />

      {/* Room Settings */}
      <RoomSettings
        floorPlan={floorPlan}
        setFloorPlan={setFloorPlan}
        backgroundImage={backgroundImage}
        setBackgroundImage={setBackgroundImage}
        disabled={disabled}
      />
    </>
  )
}
