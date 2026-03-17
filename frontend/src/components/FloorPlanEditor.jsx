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

export default function FloorPlanEditor({
  floorPlan, setFloorPlan, activeTool,
  undoStack, setUndoStack, redoStack, setRedoStack,
  backgroundImage,
}) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [snapIndicator, setSnapIndicator] = useState(null)
  const [gridSnap, setGridSnap] = useState(0.5)
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

  const getPosFromCoords = useCallback((x, y) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const rawX = x - rect.left
    const rawY = y - rect.top
    if (gridSnap === null) return { x: rawX, y: rawY }
    return snapPoint(rawX, rawY, floorPlan, gridSnap, scale)
  }, [floorPlan, gridSnap, scale])

  const getPos = useCallback((e) => {
    return getPosFromCoords(e.clientX, e.clientY)
  }, [getPosFromCoords])

  const getTouchPos = useCallback((e) => {
    const touch = e.touches[0] || e.changedTouches[0]
    return getPosFromCoords(touch.clientX, touch.clientY)
  }, [getPosFromCoords])

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

    for (const z of floorPlan.spawn_zones) {
      ctx.fillStyle="rgba(74,222,128,0.15)"; ctx.strokeStyle="rgba(74,222,128,0.6)"; ctx.lineWidth=1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle="rgba(74,222,128,0.8)"; ctx.font="bold 10px sans-serif"
      ctx.fillText("SPAWN", toPx(z.x,scale)+4, toPx(z.y,scale)+14)
    }

    for (const z of floorPlan.exit_zones) {
      ctx.fillStyle="rgba(248,113,113,0.15)"; ctx.strokeStyle="rgba(248,113,113,0.6)"; ctx.lineWidth=1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle="rgba(248,113,113,0.8)"; ctx.font="bold 10px sans-serif"
      ctx.fillText("EXIT", toPx(z.x,scale)+4, toPx(z.y,scale)+14)
    }

    for (const o of floorPlan.obstacles) {
      ctx.fillStyle="rgba(100,116,139,0.4)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2
      ctx.fillRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
      ctx.strokeRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
      ctx.fillStyle="rgba(148,163,184,0.6)"; ctx.font="10px sans-serif"; ctx.textAlign="center"
      ctx.fillText("obstacle", toPx(o.x+o.width/2,scale), toPx(o.y+o.height/2,scale)+4)
      ctx.textAlign="left"
    }

    ctx.lineCap="round"
    for (const w of floorPlan.walls) {
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=3
      ctx.beginPath(); ctx.moveTo(toPx(w.x1,scale),toPx(w.y1,scale)); ctx.lineTo(toPx(w.x2,scale),toPx(w.y2,scale)); ctx.stroke()
      ctx.fillStyle="#93c5fd"
      for (const [ex,ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]) {
        ctx.beginPath(); ctx.arc(ex,ey,3,0,Math.PI*2); ctx.fill()
      }
    }

    ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2
    ctx.strokeRect(1,1,W-2,H-2)

    if (drawing && startPt && mousePos) {
      ctx.setLineDash([5,5])
      if (activeTool==="wall") {
        ctx.strokeStyle="#60a5fa"; ctx.lineWidth=3
        ctx.beginPath(); ctx.moveTo(startPt.x,startPt.y); ctx.lineTo(mousePos.x,mousePos.y); ctx.stroke()
        const mx=toMeters(mousePos.x,scale)-toMeters(startPt.x,scale)
        const my=toMeters(mousePos.y,scale)-toMeters(startPt.y,scale)
        const len=Math.hypot(mx,my).toFixed(2)
        ctx.setLineDash([])
        ctx.fillStyle="#60a5fa"; ctx.font="11px sans-serif"
        ctx.fillText(`${len}m`, (startPt.x+mousePos.x)/2+4, (startPt.y+mousePos.y)/2-4)
      } else {
        const x=Math.min(startPt.x,mousePos.x), y=Math.min(startPt.y,mousePos.y)
        const w=Math.abs(mousePos.x-startPt.x), h=Math.abs(mousePos.y-startPt.y)
        ctx.strokeStyle=activeTool==="spawn"?"#4ade80":activeTool==="exit"?"#f87171":"#94a3b8"
        ctx.lineWidth=2; ctx.strokeRect(x,y,w,h)
        ctx.setLineDash([])
        ctx.fillStyle="#94a3b8"; ctx.font="11px sans-serif"
        ctx.fillText(`${(w/scale).toFixed(2)}×${(h/scale).toFixed(2)}m`, x+4, y-4)
      }
      ctx.setLineDash([])
    }

    if (snapIndicator) {
      ctx.beginPath(); ctx.arc(snapIndicator.x,snapIndicator.y,7,0,Math.PI*2)
      ctx.strokeStyle="#fbbf24"; ctx.lineWidth=2; ctx.stroke()
    }
  }, [floorPlan, drawing, startPt, mousePos, activeTool, snapIndicator, gridSnap, W, H, scale])

  useEffect(() => { draw() }, [draw])

  // ── Shared logic ──
  const handleStart = useCallback((pos) => {
    if (activeTool === "erase") {
      const mx = toMeters(pos.x, scale), my = toMeters(pos.y, scale)
      pushUndo(floorPlan)
      setFloorPlan(fp => ({
        ...fp,
        walls: fp.walls.filter(w => Math.hypot((w.x1+w.x2)/2-mx,(w.y1+w.y2)/2-my) > 0.8),
        obstacles: fp.obstacles.filter(o => Math.hypot(o.x+o.width/2-mx,o.y+o.height/2-my) > 0.8),
        spawn_zones: fp.spawn_zones.filter(z => Math.hypot(z.x+z.w/2-mx,z.y+z.h/2-my) > 1.0),
        exit_zones: fp.exit_zones.filter(z => Math.hypot(z.x+z.w/2-mx,z.y+z.h/2-my) > 1.0),
      }))
      return
    }
    setDrawing(true); setStartPt(pos); setMousePos(pos)
  }, [activeTool, floorPlan, setFloorPlan, pushUndo, scale])

  const handleMove = useCallback((pos) => {
    setMousePos(pos)
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
  }, [floorPlan.walls, scale])

  const handleEnd = useCallback((pos) => {
    if (!drawing || !startPt) return
    setDrawing(false)
    const x1=toMeters(startPt.x,scale), y1=toMeters(startPt.y,scale)
    const x2=toMeters(pos.x,scale), y2=toMeters(pos.y,scale)
    const r = v => Math.round(v * 100) / 100

    pushUndo(floorPlan)

    if (activeTool==="wall") {
      if (Math.hypot(x2-x1,y2-y1) < 0.05) return
      setFloorPlan(fp => ({ ...fp, walls: [...fp.walls, { x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2) }] }))
    } else if (activeTool==="obstacle") {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if (ow<0.05||oh<0.05) return
      setFloorPlan(fp => ({ ...fp, obstacles: [...fp.obstacles, { x:ox,y:oy,width:ow,height:oh }] }))
    } else if (activeTool==="spawn") {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if (ow<0.05||oh<0.05) return
      setFloorPlan(fp => ({ ...fp, spawn_zones: [...fp.spawn_zones, { x:ox,y:oy,w:ow,h:oh }] }))
    } else if (activeTool==="exit") {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if (ow<0.05||oh<0.05) return
      setFloorPlan(fp => ({ ...fp, exit_zones: [...fp.exit_zones, { x:ox,y:oy,w:ow,h:oh }] }))
    }

    setStartPt(null); setMousePos(null); setSnapIndicator(null)
  }, [drawing, startPt, activeTool, floorPlan, setFloorPlan, pushUndo, scale])

  // ── Mouse events ──
  const onMouseDown = useCallback((e) => { handleStart(getPos(e)) }, [handleStart, getPos])
  const onMouseMove = useCallback((e) => { if (drawing) handleMove(getPos(e)) }, [drawing, handleMove, getPos])
  const onMouseUp = useCallback((e) => { handleEnd(getPos(e)) }, [handleEnd, getPos])

  // ── Touch events ──
  const onTouchStart = useCallback((e) => {
    e.preventDefault()
    handleStart(getTouchPos(e))
  }, [handleStart, getTouchPos])

  const onTouchMove = useCallback((e) => {
    e.preventDefault()
    if (drawing) handleMove(getTouchPos(e))
  }, [drawing, handleMove, getTouchPos])

  const onTouchEnd = useCallback((e) => {
    e.preventDefault()
    handleEnd(getTouchPos(e))
  }, [handleEnd, getTouchPos])

  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      {/* Snap controls */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 8px", background:"#1a1d2e", borderRadius:6, border:"1px solid #2d3148" }}>
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

      <div style={{ position:"relative" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setDrawing(false); setMousePos(null); setSnapIndicator(null) }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ cursor:"crosshair", borderRadius:4, touchAction:"none" }}
        />
        <div className="canvas-hint">
          {activeTool==="wall" && "Drag to draw walls · Yellow circle = snap to endpoint"}
          {activeTool==="door" && "Drag to mark a doorway"}
          {activeTool==="obstacle" && "Drag to place a table or obstacle"}
          {activeTool==="spawn" && "Drag to set where people appear"}
          {activeTool==="exit" && "Drag to set where people go"}
          {activeTool==="erase" && "Tap near any wall or zone to erase it"}
        </div>
      </div>
    </div>
  )
}
