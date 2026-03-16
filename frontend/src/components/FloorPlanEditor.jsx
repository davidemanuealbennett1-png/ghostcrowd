import { useRef, useEffect, useState, useCallback } from "react"

const GRID_SIZE = 30
const SNAP_RADIUS = 12 // px — snap to existing wall endpoints within this distance

function snapToGrid(val) {
  return Math.round(val / GRID_SIZE) * GRID_SIZE
}

function toPx(m) { return m * GRID_SIZE }
function toMeters(px) { return px / GRID_SIZE }

function snapPoint(x, y, floorPlan) {
  // First try snapping to existing wall endpoints
  let best = null
  let bestDist = SNAP_RADIUS
  for (const w of floorPlan.walls) {
    for (const [ex, ey] of [[toPx(w.x1), toPx(w.y1)], [toPx(w.x2), toPx(w.y2)]]) {
      const d = Math.hypot(x - ex, y - ey)
      if (d < bestDist) { bestDist = d; best = { x: ex, y: ey } }
    }
  }
  if (best) return best
  // Fall back to grid snap
  return { x: snapToGrid(x), y: snapToGrid(y) }
}

export default function FloorPlanEditor({ floorPlan, setFloorPlan, activeTool }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [snapIndicator, setSnapIndicator] = useState(null)

  const W = toPx(floorPlan.width)
  const H = toPx(floorPlan.height)

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top
    const snapped = snapPoint(rawX, rawY, floorPlan)
    return snapped
  }, [floorPlan])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = "#161929"
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = "#1e2235"
    ctx.lineWidth = 0.5
    for (let x = 0; x <= W; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y <= H; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Spawn zones
    for (const z of floorPlan.spawn_zones) {
      ctx.fillStyle = "rgba(74,222,128,0.15)"
      ctx.strokeStyle = "rgba(74,222,128,0.6)"
      ctx.lineWidth = 1.5
      ctx.fillRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
      ctx.strokeRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
      ctx.fillStyle = "rgba(74,222,128,0.8)"
      ctx.font = "bold 10px sans-serif"
      ctx.fillText("SPAWN", toPx(z.x) + 4, toPx(z.y) + 14)
    }

    // Exit zones
    for (const z of floorPlan.exit_zones) {
      ctx.fillStyle = "rgba(248,113,113,0.15)"
      ctx.strokeStyle = "rgba(248,113,113,0.6)"
      ctx.lineWidth = 1.5
      ctx.fillRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
      ctx.strokeRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
      ctx.fillStyle = "rgba(248,113,113,0.8)"
      ctx.font = "bold 10px sans-serif"
      ctx.fillText("EXIT", toPx(z.x) + 4, toPx(z.y) + 14)
    }

    // Obstacles
    for (const o of floorPlan.obstacles) {
      ctx.fillStyle = "rgba(100,116,139,0.4)"
      ctx.strokeStyle = "#94a3b8"
      ctx.lineWidth = 2
      ctx.fillRect(toPx(o.x), toPx(o.y), toPx(o.width), toPx(o.height))
      ctx.strokeRect(toPx(o.x), toPx(o.y), toPx(o.width), toPx(o.height))
      ctx.fillStyle = "rgba(148,163,184,0.6)"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("obstacle", toPx(o.x + o.width / 2), toPx(o.y + o.height / 2) + 4)
      ctx.textAlign = "left"
    }

    // Walls
    ctx.lineCap = "round"
    for (const w of floorPlan.walls) {
      ctx.strokeStyle = "#60a5fa"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(toPx(w.x1), toPx(w.y1))
      ctx.lineTo(toPx(w.x2), toPx(w.y2))
      ctx.stroke()

      // Endpoint dots
      ctx.fillStyle = "#93c5fd"
      for (const [ex, ey] of [[toPx(w.x1), toPx(w.y1)], [toPx(w.x2), toPx(w.y2)]]) {
        ctx.beginPath()
        ctx.arc(ex, ey, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Room boundary
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, W - 2, H - 2)

    // Drawing preview
    if (drawing && startPt && mousePos) {
      ctx.setLineDash([5, 5])
      if (activeTool === "wall") {
        ctx.strokeStyle = "#60a5fa"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(startPt.x, startPt.y)
        ctx.lineTo(mousePos.x, mousePos.y)
        ctx.stroke()
        // Length label
        const mx = toMeters(mousePos.x) - toMeters(startPt.x)
        const my = toMeters(mousePos.y) - toMeters(startPt.y)
        const len = Math.hypot(mx, my).toFixed(1)
        const midX = (startPt.x + mousePos.x) / 2
        const midY = (startPt.y + mousePos.y) / 2
        ctx.setLineDash([])
        ctx.fillStyle = "#60a5fa"
        ctx.font = "11px sans-serif"
        ctx.fillText(`${len}m`, midX + 4, midY - 4)
      } else if (activeTool === "door") {
        ctx.strokeStyle = "#fbbf24"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(startPt.x, startPt.y)
        ctx.lineTo(mousePos.x, mousePos.y)
        ctx.stroke()
      } else {
        const x = Math.min(startPt.x, mousePos.x)
        const y = Math.min(startPt.y, mousePos.y)
        const w = Math.abs(mousePos.x - startPt.x)
        const h = Math.abs(mousePos.y - startPt.y)
        ctx.strokeStyle = activeTool === "spawn" ? "#4ade80"
          : activeTool === "exit" ? "#f87171" : "#94a3b8"
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, w, h)
        // Size label
        const wm = (w / GRID_SIZE).toFixed(1)
        const hm = (h / GRID_SIZE).toFixed(1)
        ctx.setLineDash([])
        ctx.fillStyle = "#94a3b8"
        ctx.font = "11px sans-serif"
        ctx.fillText(`${wm}×${hm}m`, x + 4, y - 4)
      }
      ctx.setLineDash([])
    }

    // Snap indicator circle
    if (snapIndicator) {
      ctx.beginPath()
      ctx.arc(snapIndicator.x, snapIndicator.y, 7, 0, Math.PI * 2)
      ctx.strokeStyle = "#fbbf24"
      ctx.lineWidth = 2
      ctx.stroke()
    }

  }, [floorPlan, drawing, startPt, mousePos, activeTool, snapIndicator, W, H])

  useEffect(() => { draw() }, [draw])

  const onMouseDown = useCallback((e) => {
    const pos = getPos(e)

    if (activeTool === "erase") {
      const mx = toMeters(pos.x)
      const my = toMeters(pos.y)
      setFloorPlan(fp => ({
        ...fp,
        walls: fp.walls.filter(w => {
          const midX = (w.x1 + w.x2) / 2
          const midY = (w.y1 + w.y2) / 2
          return Math.hypot(midX - mx, midY - my) > 1.0
        }),
        obstacles: fp.obstacles.filter(o => {
          const cx = o.x + o.width / 2
          const cy = o.y + o.height / 2
          return Math.hypot(cx - mx, cy - my) > 1.0
        }),
        spawn_zones: fp.spawn_zones.filter(z => {
          const cx = z.x + z.w / 2
          const cy = z.y + z.h / 2
          return Math.hypot(cx - mx, cy - my) > 1.5
        }),
        exit_zones: fp.exit_zones.filter(z => {
          const cx = z.x + z.w / 2
          const cy = z.y + z.h / 2
          return Math.hypot(cx - mx, cy - my) > 1.5
        }),
      }))
      return
    }

    setDrawing(true)
    setStartPt(pos)
    setMousePos(pos)
  }, [activeTool, getPos, setFloorPlan])

  const onMouseMove = useCallback((e) => {
    const pos = getPos(e)
    setMousePos(pos)

    // Show snap indicator if near a wall endpoint
    const rect = canvasRef.current.getBoundingClientRect()
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top
    let snapped = false
    for (const w of floorPlan.walls) {
      for (const [ex, ey] of [[toPx(w.x1), toPx(w.y1)], [toPx(w.x2), toPx(w.y2)]]) {
        if (Math.hypot(rawX - ex, rawY - ey) < SNAP_RADIUS) {
          setSnapIndicator({ x: ex, y: ey })
          snapped = true
          break
        }
      }
      if (snapped) break
    }
    if (!snapped) setSnapIndicator(null)
  }, [getPos, floorPlan.walls])

  const onMouseUp = useCallback((e) => {
    if (!drawing || !startPt) return
    setDrawing(false)

    const end = getPos(e)
    const x1 = toMeters(startPt.x)
    const y1 = toMeters(startPt.y)
    const x2 = toMeters(end.x)
    const y2 = toMeters(end.y)

    if (activeTool === "wall") {
      if (Math.hypot(x2 - x1, y2 - y1) < 0.2) return
      setFloorPlan(fp => ({ ...fp, walls: [...fp.walls, { x1, y1, x2, y2 }] }))
    } else if (activeTool === "obstacle") {
      const ox = Math.min(x1, x2), oy = Math.min(y1, y2)
      const ow = Math.abs(x2 - x1), oh = Math.abs(y2 - y1)
      if (ow < 0.3 || oh < 0.3) return
      setFloorPlan(fp => ({ ...fp, obstacles: [...fp.obstacles, { x: ox, y: oy, width: ow, height: oh }] }))
    } else if (activeTool === "spawn") {
      const ox = Math.min(x1, x2), oy = Math.min(y1, y2)
      const ow = Math.abs(x2 - x1), oh = Math.abs(y2 - y1)
      if (ow < 0.3 || oh < 0.3) return
      setFloorPlan(fp => ({ ...fp, spawn_zones: [...fp.spawn_zones, { x: ox, y: oy, w: ow, h: oh }] }))
    } else if (activeTool === "exit") {
      const ox = Math.min(x1, x2), oy = Math.min(y1, y2)
      const ow = Math.abs(x2 - x1), oh = Math.abs(y2 - y1)
      if (ow < 0.3 || oh < 0.3) return
      setFloorPlan(fp => ({ ...fp, exit_zones: [...fp.exit_zones, { x: ox, y: oy, w: ow, h: oh }] }))
    }

    setStartPt(null)
    setMousePos(null)
    setSnapIndicator(null)
  }, [drawing, startPt, activeTool, getPos, setFloorPlan])

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setDrawing(false); setMousePos(null); setSnapIndicator(null) }}
        style={{ cursor: "crosshair", borderRadius: 4 }}
      />
      <div className="canvas-hint">
        {activeTool === "wall" && "Drag to draw walls · Yellow circle = snap to endpoint"}
        {activeTool === "door" && "Drag to mark a doorway"}
        {activeTool === "obstacle" && "Drag to place a table or obstacle"}
        {activeTool === "spawn" && "Drag to set where people appear"}
        {activeTool === "exit" && "Drag to set where people go"}
        {activeTool === "erase" && "Click near any wall or zone to erase it"}
        {activeTool === "select" && "Select tool coming soon"}
      </div>
    </div>
  )
}
