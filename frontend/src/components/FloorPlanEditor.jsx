import { useRef, useEffect, useState, useCallback } from "react"

const DISPLAY_SCALE = 30
const SNAP_RADIUS_PX = 12

function snapToGrid(val, gridSize) {
  return Math.round(val / gridSize) * gridSize
}

function toPx(m, scale) { return m * scale }
function toMeters(px, scale) { return px / scale }

function snapPoint(x, y, floorPlan, gridSizeM, scale) {
  let best = null
  let bestDist = SNAP_RADIUS_PX
  for (const w of floorPlan.walls) {
    for (const [ex, ey] of [
      [toPx(w.x1, scale), toPx(w.y1, scale)],
      [toPx(w.x2, scale), toPx(w.y2, scale)]
    ]) {
      const d = Math.hypot(x - ex, y - ey)
      if (d < bestDist) { bestDist = d; best = { x: ex, y: ey } }
    }
  }
  if (best) return best
  if (gridSizeM === null) return { x, y }
  const gridSizePx = toPx(gridSizeM, scale)
  return { x: snapToGrid(x, gridSizePx), y: snapToGrid(y, gridSizePx) }
}

const SNAP_OPTIONS = [
  { label: '1m', value: 1.0 },
  { label: '0.5m', value: 0.5 },
  { label: '0.25m', value: 0.25 },
  { label: '0.1m', value: 0.1 },
  { label: 'Free', value: null },
]

// Find the closest item to a point for selection/deletion
function findClosestItem(mx, my, floorPlan) {
  let best = null
  let bestDist = 1.5 // meters threshold

  // Check walls
  for (let i = 0; i < floorPlan.walls.length; i++) {
    const w = floorPlan.walls[i]
    const midX = (w.x1 + w.x2) / 2
    const midY = (w.y1 + w.y2) / 2
    const d = Math.hypot(midX - mx, midY - my)
    if (d < bestDist) { bestDist = d; best = { type: 'wall', index: i } }
  }

  // Check obstacles
  for (let i = 0; i < floorPlan.obstacles.length; i++) {
    const o = floorPlan.obstacles[i]
    const cx = o.x + o.width / 2, cy = o.y + o.height / 2
    const d = Math.hypot(cx - mx, cy - my)
    if (d < bestDist) { bestDist = d; best = { type: 'obstacle', index: i } }
  }

  // Check spawn zones
  for (let i = 0; i < floorPlan.spawn_zones.length; i++) {
    const z = floorPlan.spawn_zones[i]
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2
    const d = Math.hypot(cx - mx, cy - my)
    if (d < bestDist) { bestDist = d; best = { type: 'spawn', index: i } }
  }

  // Check exit zones
  for (let i = 0; i < floorPlan.exit_zones.length; i++) {
    const z = floorPlan.exit_zones[i]
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2
    const d = Math.hypot(cx - mx, cy - my)
    if (d < bestDist) { bestDist = d; best = { type: 'exit', index: i } }
  }

  return best
}

export default function FloorPlanEditor({
  floorPlan, setFloorPlan, activeTool, setActiveTool,
  undoStack, setUndoStack, redoStack, setRedoStack,
  backgroundImage,
}) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [snapIndicator, setSnapIndicator] = useState(null)
  const [gridSnap, setGridSnap] = useState(0.5)
  const [selected, setSelected] = useState(null) // { type, index }
  const [hovered, setHovered] = useState(null)
  const bgImgRef = useRef(null)

  const scale = DISPLAY_SCALE
  const W = toPx(floorPlan.width, scale)
  const H = toPx(floorPlan.height, scale)

  useEffect(() => {
    if (backgroundImage) {
      const img = new Image()
      img.onload = () => { bgImgRef.current = img }
      img.src = backgroundImage
    } else {
      bgImgRef.current = null
    }
  }, [backgroundImage])

  const pushUndo = useCallback((prevState) => {
    setUndoStack(stack => [...stack.slice(-30), prevState])
    setRedoStack([])
  }, [setUndoStack, setRedoStack])

  const getPosFromCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const rawX = (clientX - rect.left) * scaleX
    const rawY = (clientY - rect.top) * scaleY
    if (gridSnap === null) return { x: rawX, y: rawY }
    return snapPoint(rawX, rawY, floorPlan, gridSnap, scale)
  }, [floorPlan, gridSnap, scale])

  const getPos = useCallback((e) => getPosFromCoords(e.clientX, e.clientY), [getPosFromCoords])
  const getTouchPos = useCallback((e) => {
    const touch = e.touches[0] || e.changedTouches[0]
    return getPosFromCoords(touch.clientX, touch.clientY)
  }, [getPosFromCoords])

  const deleteSelected = useCallback((item) => {
    if (!item) return
    pushUndo(floorPlan)
    setFloorPlan(fp => {
      const next = { ...fp }
      if (item.type === 'wall') next.walls = fp.walls.filter((_, i) => i !== item.index)
      else if (item.type === 'obstacle') next.obstacles = fp.obstacles.filter((_, i) => i !== item.index)
      else if (item.type === 'spawn') next.spawn_zones = fp.spawn_zones.filter((_, i) => i !== item.index)
      else if (item.type === 'exit') next.exit_zones = fp.exit_zones.filter((_, i) => i !== item.index)
      return next
    })
    setSelected(null)
  }, [floorPlan, pushUndo, setFloorPlan])

  // Delete key handler for selected items
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected && activeTool === 'select') {
          deleteSelected(selected)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, activeTool, deleteSelected])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = "#161929"
    ctx.fillRect(0, 0, W, H)

    if (bgImgRef.current) {
      ctx.globalAlpha = 0.35
      ctx.drawImage(bgImgRef.current, 0, 0, W, H)
      ctx.globalAlpha = 1.0
    }

    const gridSizePx = gridSnap ? toPx(gridSnap, scale) : toPx(0.5, scale)
    const majorGridPx = toPx(1.0, scale)

    ctx.strokeStyle = "#161f33"; ctx.lineWidth = 0.4
    for (let x = 0; x <= W; x += gridSizePx) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
    for (let y = 0; y <= H; y += gridSizePx) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
    ctx.strokeStyle = "#1e2235"; ctx.lineWidth = 0.7
    for (let x = 0; x <= W; x += majorGridPx) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
    for (let y = 0; y <= H; y += majorGridPx) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }

    // Spawn zones
    for (let i = 0; i < floorPlan.spawn_zones.length; i++) {
      const z = floorPlan.spawn_zones[i]
      const isSelected = selected?.type === 'spawn' && selected?.index === i
      const isHovered = hovered?.type === 'spawn' && hovered?.index === i
      ctx.fillStyle = "rgba(74,222,128,0.15)"
      ctx.strokeStyle = isSelected ? "#fff" : isHovered ? "#6ee7b7" : "rgba(74,222,128,0.6)"
      ctx.lineWidth = isSelected ? 2 : 1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle = "rgba(74,222,128,0.8)"; ctx.font = "bold 10px sans-serif"
      ctx.fillText("SPAWN", toPx(z.x,scale)+4, toPx(z.y,scale)+14)
      if (isSelected) {
        ctx.fillStyle = "#f87171"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"
        ctx.fillText("✕ delete", toPx(z.x+z.w/2,scale), toPx(z.y+z.h/2,scale)+4)
        ctx.textAlign = "left"
      }
    }

    // Exit zones
    for (let i = 0; i < floorPlan.exit_zones.length; i++) {
      const z = floorPlan.exit_zones[i]
      const isSelected = selected?.type === 'exit' && selected?.index === i
      const isHovered = hovered?.type === 'exit' && hovered?.index === i
      ctx.fillStyle = "rgba(248,113,113,0.15)"
      ctx.strokeStyle = isSelected ? "#fff" : isHovered ? "#fca5a5" : "rgba(248,113,113,0.6)"
      ctx.lineWidth = isSelected ? 2 : 1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle = "rgba(248,113,113,0.8)"; ctx.font = "bold 10px sans-serif"
      ctx.fillText("EXIT", toPx(z.x,scale)+4, toPx(z.y,scale)+14)
      if (isSelected) {
        ctx.fillStyle = "#f87171"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"
        ctx.fillText("✕ delete", toPx(z.x+z.w/2,scale), toPx(z.y+z.h/2,scale)+4)
        ctx.textAlign = "left"
      }
    }

    // Obstacles
    for (let i = 0; i < floorPlan.obstacles.length; i++) {
      const o = floorPlan.obstacles[i]
      const isSelected = selected?.type === 'obstacle' && selected?.index === i
      const isHovered = hovered?.type === 'obstacle' && hovered?.index === i
      ctx.fillStyle = isSelected ? "rgba(100,116,139,0.6)" : "rgba(100,116,139,0.4)"
      ctx.strokeStyle = isSelected ? "#fff" : isHovered ? "#cbd5e1" : "#94a3b8"
      ctx.lineWidth = isSelected ? 2 : 1.5
      ctx.fillRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
      ctx.strokeRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
      ctx.fillStyle = "rgba(148,163,184,0.7)"; ctx.font = "10px sans-serif"; ctx.textAlign = "center"
      ctx.fillText(isSelected ? "✕ delete" : "obstacle", toPx(o.x+o.width/2,scale), toPx(o.y+o.height/2,scale)+4)
      ctx.textAlign = "left"
    }

    // Walls
    ctx.lineCap = "round"
    for (let i = 0; i < floorPlan.walls.length; i++) {
      const w = floorPlan.walls[i]
      const isSelected = selected?.type === 'wall' && selected?.index === i
      const isHovered = hovered?.type === 'wall' && hovered?.index === i
      ctx.strokeStyle = isSelected ? "#fff" : isHovered ? "#93c5fd" : "#60a5fa"
      ctx.lineWidth = isSelected ? 5 : 3
      ctx.beginPath(); ctx.moveTo(toPx(w.x1,scale),toPx(w.y1,scale)); ctx.lineTo(toPx(w.x2,scale),toPx(w.y2,scale)); ctx.stroke()
      ctx.fillStyle = isSelected ? "#fff" : "#93c5fd"
      for (const [ex,ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]) {
        ctx.beginPath(); ctx.arc(ex,ey,3,0,Math.PI*2); ctx.fill()
      }
    }

    // Door preview (dashed yellow line)
    if (drawing && startPt && mousePos && activeTool === 'door') {
      ctx.setLineDash([8, 4])
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 4; ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(startPt.x, startPt.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke()
      ctx.setLineDash([])
      const mx = toMeters(mousePos.x,scale) - toMeters(startPt.x,scale)
      const my = toMeters(mousePos.y,scale) - toMeters(startPt.y,scale)
      ctx.fillStyle = "#fbbf24"; ctx.font = "11px sans-serif"
      ctx.fillText(`${Math.hypot(mx,my).toFixed(2)}m gap`, (startPt.x+mousePos.x)/2+4, (startPt.y+mousePos.y)/2-4)
    }

    // Wall preview
    if (drawing && startPt && mousePos && activeTool === 'wall') {
      ctx.setLineDash([5,5])
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(startPt.x,startPt.y); ctx.lineTo(mousePos.x,mousePos.y); ctx.stroke()
      const mx = toMeters(mousePos.x,scale) - toMeters(startPt.x,scale)
      const my = toMeters(mousePos.y,scale) - toMeters(startPt.y,scale)
      ctx.setLineDash([])
      ctx.fillStyle = "#60a5fa"; ctx.font = "11px sans-serif"
      ctx.fillText(`${Math.hypot(mx,my).toFixed(2)}m`, (startPt.x+mousePos.x)/2+4, (startPt.y+mousePos.y)/2-4)
    }

    // Rect preview (obstacle/spawn/exit)
    if (drawing && startPt && mousePos && ['obstacle','spawn','exit'].includes(activeTool)) {
      ctx.setLineDash([5,5])
      const x=Math.min(startPt.x,mousePos.x), y=Math.min(startPt.y,mousePos.y)
      const w=Math.abs(mousePos.x-startPt.x), h=Math.abs(mousePos.y-startPt.y)
      ctx.strokeStyle = activeTool==="spawn"?"#4ade80":activeTool==="exit"?"#f87171":"#94a3b8"
      ctx.lineWidth=2; ctx.strokeRect(x,y,w,h)
      ctx.setLineDash([])
      ctx.fillStyle="#94a3b8"; ctx.font="11px sans-serif"
      ctx.fillText(`${(w/scale).toFixed(2)}×${(h/scale).toFixed(2)}m`, x+4, y-4)
    }

    ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2
    ctx.strokeRect(1,1,W-2,H-2)

    if (snapIndicator) {
      ctx.beginPath(); ctx.arc(snapIndicator.x,snapIndicator.y,7,0,Math.PI*2)
      ctx.strokeStyle="#fbbf24"; ctx.lineWidth=2; ctx.stroke()
    }

    // Select mode hint
    if (activeTool === 'select' && selected) {
      ctx.fillStyle = "rgba(248,113,113,0.9)"
      ctx.font = "bold 12px sans-serif"
      ctx.fillText("Press Delete to remove selected item", 8, H - 8)
    }

  }, [floorPlan, drawing, startPt, mousePos, activeTool, snapIndicator, gridSnap, W, H, scale, selected, hovered])

  useEffect(() => { draw() }, [draw])

  const handleStart = useCallback((pos) => {
    if (activeTool === 'select') {
      const mx = toMeters(pos.x, scale), my = toMeters(pos.y, scale)
      const item = findClosestItem(mx, my, floorPlan)
      if (selected && item && selected.type === item.type && selected.index === item.index) {
        // Double-click same item = delete
        deleteSelected(item)
      } else {
        setSelected(item)
      }
      return
    }

    if (activeTool === 'erase') {
      const mx = toMeters(pos.x, scale), my = toMeters(pos.y, scale)
      const item = findClosestItem(mx, my, floorPlan)
      if (item) {
        pushUndo(floorPlan)
        setFloorPlan(fp => {
          const next = { ...fp }
          if (item.type === 'wall') next.walls = fp.walls.filter((_, i) => i !== item.index)
          else if (item.type === 'obstacle') next.obstacles = fp.obstacles.filter((_, i) => i !== item.index)
          else if (item.type === 'spawn') next.spawn_zones = fp.spawn_zones.filter((_, i) => i !== item.index)
          else if (item.type === 'exit') next.exit_zones = fp.exit_zones.filter((_, i) => i !== item.index)
          return next
        })
      }
      return
    }

    setSelected(null)
    setDrawing(true); setStartPt(pos); setMousePos(pos)
  }, [activeTool, floorPlan, setFloorPlan, pushUndo, scale, selected, deleteSelected])

  const handleMove = useCallback((pos) => {
    setMousePos(pos)

    // Update hover state for select/erase tool
    if (activeTool === 'select' || activeTool === 'erase') {
      const mx = toMeters(pos.x, scale), my = toMeters(pos.y, scale)
      setHovered(findClosestItem(mx, my, floorPlan))
    } else {
      setHovered(null)
    }

    let snapped = false
    for (const w of floorPlan.walls) {
      for (const [ex, ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]) {
        if (Math.hypot(pos.x-ex, pos.y-ey) < SNAP_RADIUS_PX) {
          setSnapIndicator({ x: ex, y: ey }); snapped = true; break
        }
      }
      if (snapped) break
    }
    if (!snapped) setSnapIndicator(null)
  }, [floorPlan.walls, scale, activeTool, floorPlan])

  const handleEnd = useCallback((pos) => {
    if (!drawing || !startPt) return
    setDrawing(false)
    const x1=toMeters(startPt.x,scale), y1=toMeters(startPt.y,scale)
    const x2=toMeters(pos.x,scale), y2=toMeters(pos.y,scale)
    const r = v => Math.round(v * 100) / 100
    pushUndo(floorPlan)

    if (activeTool === 'wall') {
      if (Math.hypot(x2-x1,y2-y1) < 0.05) return
      setFloorPlan(fp => ({ ...fp, walls: [...fp.walls, { x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2) }] }))
    } else if (activeTool === 'door') {
      // Door = split nearest wall with a gap, or just add a gap marker
      // Implementation: add as a special wall type with isDoor flag
      if (Math.hypot(x2-x1,y2-y1) < 0.1) return
      setFloorPlan(fp => ({ ...fp, walls: [...fp.walls, { x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2), isDoor:true }] }))
    } else if (activeTool === 'obstacle') {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if (ow<0.05||oh<0.05) return
      setFloorPlan(fp => ({ ...fp, obstacles: [...fp.obstacles, { x:ox,y:oy,width:ow,height:oh }] }))
    } else if (activeTool === 'spawn') {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if (ow<0.05||oh<0.05) return
      setFloorPlan(fp => ({ ...fp, spawn_zones: [...fp.spawn_zones, { x:ox,y:oy,w:ow,h:oh }] }))
    } else if (activeTool === 'exit') {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if (ow<0.05||oh<0.05) return
      setFloorPlan(fp => ({ ...fp, exit_zones: [...fp.exit_zones, { x:ox,y:oy,w:ow,h:oh }] }))
    }

    setStartPt(null); setMousePos(null); setSnapIndicator(null)
  }, [drawing, startPt, activeTool, floorPlan, setFloorPlan, pushUndo, scale])

  const onMouseDown = useCallback((e) => { handleStart(getPos(e)) }, [handleStart, getPos])
  const onMouseMove = useCallback((e) => { handleMove(getPos(e)) }, [handleMove, getPos])
  const onMouseUp = useCallback((e) => { handleEnd(getPos(e)) }, [handleEnd, getPos])
  const onTouchStart = useCallback((e) => { e.preventDefault(); handleStart(getTouchPos(e)) }, [handleStart, getTouchPos])
  const onTouchMove = useCallback((e) => { e.preventDefault(); handleMove(getTouchPos(e)) }, [handleMove, getTouchPos])
  const onTouchEnd = useCallback((e) => { e.preventDefault(); handleEnd(getTouchPos(e)) }, [handleEnd, getTouchPos])

  const getCursor = () => {
    if (activeTool === 'select') return hovered ? 'pointer' : 'default'
    if (activeTool === 'erase') return hovered ? 'pointer' : 'crosshair'
    return 'crosshair'
  }

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 8px", background:"#1a1d2e", borderRadius:6, border:"1px solid #2d3148", flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:"#64748b" }}>Snap:</span>
        {SNAP_OPTIONS.map(opt => (
          <button key={String(opt.value)} onClick={() => setGridSnap(opt.value)} style={{
            padding:"3px 8px", borderRadius:4, border:"1px solid",
            borderColor: gridSnap===opt.value ? "#6366f1" : "#2d3148",
            background: gridSnap===opt.value ? "#3730a3" : "transparent",
            color: gridSnap===opt.value ? "white" : "#64748b",
            fontSize:11, cursor:"pointer",
          }}>{opt.label}</button>
        ))}
      </div>

      <div style={{ position:"relative", width:"100%", maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onMouseLeave={() => { setDrawing(false); setMousePos(null); setSnapIndicator(null); setHovered(null) }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{ cursor: getCursor(), borderRadius:4, touchAction:"none", width:"100%", height:"auto" }}
        />
        <div className="canvas-hint">
          {activeTool==="wall" && "Drag to draw walls · Yellow = snap to endpoint"}
          {activeTool==="door" && "Drag to mark a doorway gap (yellow dashed line)"}
          {activeTool==="obstacle" && "Drag to place a table or obstacle"}
          {activeTool==="spawn" && "Drag to set where people appear"}
          {activeTool==="exit" && "Drag to set where people go"}
          {activeTool==="erase" && "Click any wall, zone or obstacle to erase it"}
          {activeTool==="select" && "Click to select · Click again or press Delete to remove"}
        </div>
      </div>
    </div>
  )
}
