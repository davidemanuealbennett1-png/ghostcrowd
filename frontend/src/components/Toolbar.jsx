import { useState } from "react"
import { TEMPLATES } from "../utils/templates"

const TOOLS = [
  { id: "wall", icon: "📏", label: "Wall" },
  { id: "door", icon: "🚪", label: "Door" },
  { id: "obstacle", icon: "⬛", label: "Table" },
  { id: "spawn", icon: "🟢", label: "Spawn" },
  { id: "exit", icon: "🔴", label: "Exit" },
  { id: "select", icon: "↖", label: "Select" },
  { id: "erase", icon: "🗑", label: "Erase" },
]

export default function Toolbar({ activeTool, setActiveTool, disabled, floorPlan, setFloorPlan }) {
  const [showTemplates, setShowTemplates] = useState(false)

  const clearAll = () => {
    if (confirm("Clear all walls and objects?")) {
      setFloorPlan(fp => ({ ...fp, walls: [], obstacles: [] }))
    }
  }

  const applyTemplate = (template) => {
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
        <button className="tool-btn" onClick={clearAll} disabled={disabled} title="Clear walls & objects">
          🧹
        </button>
        <div className="tool-label">Clear</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <button
          className={`tool-btn ${showTemplates ? "active" : ""}`}
          onClick={() => setShowTemplates(v => !v)}
          disabled={disabled}
          title="Load a template"
        >
          📐
        </button>
        <div className="tool-label">Template</div>

        {showTemplates && (
          <div style={{
            position: "absolute",
            left: "56px",
            top: 0,
            background: "#1a1d2e",
            border: "1px solid #2d3148",
            borderRadius: 8,
            padding: 8,
            width: 200,
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8, padding: "0 4px" }}>
              Templates
            </div>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
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
    </>
  )
}
