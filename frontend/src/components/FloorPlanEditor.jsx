import { useRef, useEffect, useState, useCallback } from "react"

const DISPLAY_SCALE = 30
const SNAP_RADIUS_PX = 12

function snapToGrid(val, gridSize) { return Math.round(val / gridSize) * gridSize }
function toPx(m, scale) { return m * scale }
function toMeters(px, scale) { return px / scale }

function snapPoint(x, y, floorPlan, gridSizeM, scale) {
  let best = null, bestDist = SNAP_RADIUS_PX
  for (const w of floorPlan.walls) {
    for (const [ex, ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]) {
      const d = Math.hypot(x-ex, y-ey)
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

// Check if a point is inside a rect (in meters)
function ptInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx+rw && py >= ry && py <= ry+rh
}

// Check if a wall midpoint is inside selection rect
function wallInRect(w, sx, sy, sw, sh) {
  const mx = (w.x1+w.x2)/2, my = (w.y1+w.y2)/2
  return ptInRect(mx, my, sx, sy, sw, sh)
}

// Get all items inside a selection rect (meters)
function getItemsInRect(floorPlan, sx, sy, sw, sh) {
  const selected = []
  floorPlan.walls.forEach((w,i) => { if (wallInRect(w,sx,sy,sw,sh)) selected.push({type:'wall',index:i}) })
  floorPlan.obstacles.forEach((o,i) => { if (ptInRect(o.x+o.width/2,o.y+o.height/2,sx,sy,sw,sh)) selected.push({type:'obstacle',index:i}) })
  floorPlan.spawn_zones.forEach((z,i) => { if (ptInRect(z.x+z.w/2,z.y+z.h/2,sx,sy,sw,sh)) selected.push({type:'spawn',index:i}) })
  floorPlan.exit_zones.forEach((z,i) => { if (ptInRect(z.x+z.w/2,z.y+z.h/2,sx,sy,sw,sh)) selected.push({type:'exit',index:i}) })
  return selected
}

// Find closest single item to a point
function findClosestItem(mx, my, floorPlan) {
  let best = null, bestDist = 1.5
  floorPlan.walls.forEach((w,i) => { const d=Math.hypot((w.x1+w.x2)/2-mx,(w.y1+w.y2)/2-my); if(d<bestDist){bestDist=d;best={type:'wall',index:i}} })
  floorPlan.obstacles.forEach((o,i) => { const d=Math.hypot(o.x+o.width/2-mx,o.y+o.height/2-my); if(d<bestDist){bestDist=d;best={type:'obstacle',index:i}} })
  floorPlan.spawn_zones.forEach((z,i) => { const d=Math.hypot(z.x+z.w/2-mx,z.y+z.h/2-my); if(d<bestDist){bestDist=d;best={type:'spawn',index:i}} })
  floorPlan.exit_zones.forEach((z,i) => { const d=Math.hypot(z.x+z.w/2-mx,z.y+z.h/2-my); if(d<bestDist){bestDist=d;best={type:'exit',index:i}} })
  return best
}

// Get actual object data for an item reference
function getItemData(fp, item) {
  if (item.type === 'wall') return { ...fp.walls[item.index] }
  if (item.type === 'obstacle') return { ...fp.obstacles[item.index] }
  if (item.type === 'spawn') return { ...fp.spawn_zones[item.index] }
  if (item.type === 'exit') return { ...fp.exit_zones[item.index] }
  return null
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
  const [selected, setSelected] = useState([]) // array of {type, index}
  const [selRect, setSelRect] = useState(null)  // rubber-band rect in canvas px {x,y,w,h}
  const [clipboard, setClipboard] = useState([]) // copied item data objects
  const bgImgRef = useRef(null)

  const scale = DISPLAY_SCALE
  const W = toPx(floorPlan.width, scale)
  const H = toPx(floorPlan.height, scale)

  useEffect(() => {
    if (backgroundImage) {
      const img = new Image(); img.onload = () => { bgImgRef.current = img }; img.src = backgroundImage
    } else { bgImgRef.current = null }
  }, [backgroundImage])

  const pushUndo = useCallback((prevState) => {
    setUndoStack(stack => [...stack.slice(-30), prevState]); setRedoStack([])
  }, [setUndoStack, setRedoStack])

  const getPosFromCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height
    const rawX = (clientX - rect.left) * scaleX, rawY = (clientY - rect.top) * scaleY
    if (gridSnap === null) return { x: rawX, y: rawY }
    return snapPoint(rawX, rawY, floorPlan, gridSnap, scale)
  }, [floorPlan, gridSnap, scale])

  const getPos = useCallback((e) => getPosFromCoords(e.clientX, e.clientY), [getPosFromCoords])
  const getTouchPos = useCallback((e) => {
    const t = e.touches[0] || e.changedTouches[0]; return getPosFromCoords(t.clientX, t.clientY)
  }, [getPosFromCoords])

  const deleteSelected = useCallback(() => {
    if (selected.length === 0) return
    pushUndo(floorPlan)
    setFloorPlan(fp => {
      const wallIdxs = new Set(selected.filter(s=>s.type==='wall').map(s=>s.index))
      const obsIdxs = new Set(selected.filter(s=>s.type==='obstacle').map(s=>s.index))
      const spawnIdxs = new Set(selected.filter(s=>s.type==='spawn').map(s=>s.index))
      const exitIdxs = new Set(selected.filter(s=>s.type==='exit').map(s=>s.index))
      return {
        ...fp,
        walls: fp.walls.filter((_,i) => !wallIdxs.has(i)),
        obstacles: fp.obstacles.filter((_,i) => !obsIdxs.has(i)),
        spawn_zones: fp.spawn_zones.filter((_,i) => !spawnIdxs.has(i)),
        exit_zones: fp.exit_zones.filter((_,i) => !exitIdxs.has(i)),
      }
    })
    setSelected([])
  }, [selected, floorPlan, pushUndo, setFloorPlan])

  const copySelected = useCallback(() => {
    if (selected.length === 0) return
    const items = selected.map(s => ({ type: s.type, data: getItemData(floorPlan, s) })).filter(i => i.data)
    setClipboard(items)
  }, [selected, floorPlan])

  const pasteClipboard = useCallback(() => {
    if (clipboard.length === 0) return
    pushUndo(floorPlan)
    const OFFSET = 1.0 // paste offset in meters
    setFloorPlan(fp => {
      const next = { ...fp, walls:[...fp.walls], obstacles:[...fp.obstacles], spawn_zones:[...fp.spawn_zones], exit_zones:[...fp.exit_zones] }
      clipboard.forEach(item => {
        if (item.type === 'wall') {
          next.walls.push({ ...item.data, x1:item.data.x1+OFFSET, y1:item.data.y1+OFFSET, x2:item.data.x2+OFFSET, y2:item.data.y2+OFFSET })
        } else if (item.type === 'obstacle') {
          next.obstacles.push({ ...item.data, x:item.data.x+OFFSET, y:item.data.y+OFFSET })
        } else if (item.type === 'spawn') {
          next.spawn_zones.push({ ...item.data, x:item.data.x+OFFSET, y:item.data.y+OFFSET })
        } else if (item.type === 'exit') {
          next.exit_zones.push({ ...item.data, x:item.data.x+OFFSET, y:item.data.y+OFFSET })
        }
      })
      return next
    })
  }, [clipboard, floorPlan, pushUndo, setFloorPlan])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (activeTool !== 'select') return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
      if ((e.ctrlKey||e.metaKey) && e.key === 'c') { e.preventDefault(); copySelected() }
      if ((e.ctrlKey||e.metaKey) && e.key === 'x') { e.preventDefault(); copySelected(); deleteSelected() }
      if ((e.ctrlKey||e.metaKey) && e.key === 'v') { e.preventDefault(); pasteClipboard() }
      if ((e.ctrlKey||e.metaKey) && e.key === 'a') { e.preventDefault()
        // Select all
        const all = []
        floorPlan.walls.forEach((_,i) => all.push({type:'wall',index:i}))
        floorPlan.obstacles.forEach((_,i) => all.push({type:'obstacle',index:i}))
        floorPlan.spawn_zones.forEach((_,i) => all.push({type:'spawn',index:i}))
        floorPlan.exit_zones.forEach((_,i) => all.push({type:'exit',index:i}))
        setSelected(all)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeTool, deleteSelected, copySelected, pasteClipboard, floorPlan])

  const isItemSelected = (type, index) => selected.some(s => s.type === type && s.index === index)

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle="#161929"; ctx.fillRect(0,0,W,H)

    if (bgImgRef.current) { ctx.globalAlpha=0.35; ctx.drawImage(bgImgRef.current,0,0,W,H); ctx.globalAlpha=1.0 }

    const gridSizePx = gridSnap ? toPx(gridSnap,scale) : toPx(0.5,scale)
    const majorGridPx = toPx(1.0,scale)
    ctx.strokeStyle="#161f33"; ctx.lineWidth=0.4
    for (let x=0;x<=W;x+=gridSizePx){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for (let y=0;y<=H;y+=gridSizePx){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle="#1e2235"; ctx.lineWidth=0.7
    for (let x=0;x<=W;x+=majorGridPx){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for (let y=0;y<=H;y+=majorGridPx){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}

    // Spawn zones
    floorPlan.spawn_zones.forEach((z,i) => {
      const sel = isItemSelected('spawn',i)
      ctx.fillStyle="rgba(74,222,128,0.15)"; ctx.strokeStyle=sel?"#fff":"rgba(74,222,128,0.6)"; ctx.lineWidth=sel?2:1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle="rgba(74,222,128,0.8)"; ctx.font="bold 10px sans-serif"
      ctx.fillText("SPAWN",toPx(z.x,scale)+4,toPx(z.y,scale)+14)
    })

    // Exit zones
    floorPlan.exit_zones.forEach((z,i) => {
      const sel = isItemSelected('exit',i)
      ctx.fillStyle="rgba(248,113,113,0.15)"; ctx.strokeStyle=sel?"#fff":"rgba(248,113,113,0.6)"; ctx.lineWidth=sel?2:1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle="rgba(248,113,113,0.8)"; ctx.font="bold 10px sans-serif"
      ctx.fillText("EXIT",toPx(z.x,scale)+4,toPx(z.y,scale)+14)
    })

    // Obstacles
    floorPlan.obstacles.forEach((o,i) => {
      const sel = isItemSelected('obstacle',i)
      ctx.fillStyle=sel?"rgba(100,116,139,0.6)":"rgba(100,116,139,0.4)"
      ctx.strokeStyle=sel?"#fff":"#94a3b8"; ctx.lineWidth=sel?2:1.5
      ctx.fillRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
      ctx.strokeRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
    })

    // Walls — blue for walls, yellow dashed for doors
    ctx.lineCap="round"
    floorPlan.walls.forEach((w,i) => {
      const sel = isItemSelected('wall',i)
      if (w.isDoor) {
        ctx.setLineDash([8,4])
        ctx.strokeStyle = sel ? "#fff" : "#fbbf24"
        ctx.lineWidth = sel ? 5 : 3
      } else {
        ctx.setLineDash([])
        ctx.strokeStyle = sel ? "#fff" : "#60a5fa"
        ctx.lineWidth = sel ? 5 : 3
      }
      ctx.beginPath(); ctx.moveTo(toPx(w.x1,scale),toPx(w.y1,scale)); ctx.lineTo(toPx(w.x2,scale),toPx(w.y2,scale)); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = sel ? "#fff" : (w.isDoor ? "#fde68a" : "#93c5fd")
      for (const [ex,ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]) {
        ctx.beginPath(); ctx.arc(ex,ey,3,0,Math.PI*2); ctx.fill()
      }
    })

    ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2; ctx.strokeRect(1,1,W-2,H-2)

    // Drawing previews
    if (drawing && startPt && mousePos) {
      if (activeTool==='wall') {
        ctx.setLineDash([5,5]); ctx.strokeStyle="#60a5fa"; ctx.lineWidth=3
        ctx.beginPath(); ctx.moveTo(startPt.x,startPt.y); ctx.lineTo(mousePos.x,mousePos.y); ctx.stroke()
        ctx.setLineDash([])
        const len=Math.hypot(toMeters(mousePos.x-startPt.x,scale),toMeters(mousePos.y-startPt.y,scale)).toFixed(2)
        ctx.fillStyle="#60a5fa"; ctx.font="11px sans-serif"
        ctx.fillText(`${len}m`,(startPt.x+mousePos.x)/2+4,(startPt.y+mousePos.y)/2-4)
      } else if (activeTool==='door') {
        ctx.setLineDash([8,4]); ctx.strokeStyle="#fbbf24"; ctx.lineWidth=4
        ctx.beginPath(); ctx.moveTo(startPt.x,startPt.y); ctx.lineTo(mousePos.x,mousePos.y); ctx.stroke()
        ctx.setLineDash([])
        const len=Math.hypot(toMeters(mousePos.x-startPt.x,scale),toMeters(mousePos.y-startPt.y,scale)).toFixed(2)
        ctx.fillStyle="#fbbf24"; ctx.font="11px sans-serif"
        ctx.fillText(`${len}m gap`,(startPt.x+mousePos.x)/2+4,(startPt.y+mousePos.y)/2-4)
      } else if (['obstacle','spawn','exit'].includes(activeTool)) {
        ctx.setLineDash([5,5])
        const x=Math.min(startPt.x,mousePos.x),y=Math.min(startPt.y,mousePos.y)
        const w=Math.abs(mousePos.x-startPt.x),h=Math.abs(mousePos.y-startPt.y)
        ctx.strokeStyle=activeTool==="spawn"?"#4ade80":activeTool==="exit"?"#f87171":"#94a3b8"
        ctx.lineWidth=2; ctx.strokeRect(x,y,w,h)
        ctx.setLineDash([])
        ctx.fillStyle="#94a3b8"; ctx.font="11px sans-serif"
        ctx.fillText(`${(w/scale).toFixed(2)}×${(h/scale).toFixed(2)}m`,x+4,y-4)
      } else if (activeTool==='select') {
        // Rubber-band selection rectangle
        const x=Math.min(startPt.x,mousePos.x),y=Math.min(startPt.y,mousePos.y)
        const w=Math.abs(mousePos.x-startPt.x),h=Math.abs(mousePos.y-startPt.y)
        ctx.fillStyle="rgba(99,102,241,0.1)"
        ctx.fillRect(x,y,w,h)
        ctx.strokeStyle="#6366f1"; ctx.lineWidth=1.5; ctx.setLineDash([4,3])
        ctx.strokeRect(x,y,w,h)
        ctx.setLineDash([])
      }
    }

    // Snap indicator
    if (snapIndicator) {
      ctx.beginPath(); ctx.arc(snapIndicator.x,snapIndicator.y,7,0,Math.PI*2)
      ctx.strokeStyle="#fbbf24"; ctx.lineWidth=2; ctx.stroke()
    }

    // Select mode info bar
    if (activeTool==='select' && selected.length > 0) {
      ctx.fillStyle="rgba(99,102,241,0.85)"
      ctx.fillRect(0,H-24,W,24)
      ctx.fillStyle="white"; ctx.font="11px sans-serif"
      ctx.fillText(`${selected.length} selected · Del=delete · Ctrl+C=copy · Ctrl+X=cut · Ctrl+V=paste · Ctrl+A=all`,8,H-8)
    }

  }, [floorPlan,drawing,startPt,mousePos,activeTool,snapIndicator,gridSnap,W,H,scale,selected])

  useEffect(()=>{ draw() },[draw])

  const handleStart = useCallback((pos) => {
    if (activeTool==='erase') {
      const mx=toMeters(pos.x,scale),my=toMeters(pos.y,scale)
      const item=findClosestItem(mx,my,floorPlan)
      if (item) {
        pushUndo(floorPlan)
        setFloorPlan(fp => {
          const next={...fp}
          if (item.type==='wall') next.walls=fp.walls.filter((_,i)=>i!==item.index)
          else if (item.type==='obstacle') next.obstacles=fp.obstacles.filter((_,i)=>i!==item.index)
          else if (item.type==='spawn') next.spawn_zones=fp.spawn_zones.filter((_,i)=>i!==item.index)
          else if (item.type==='exit') next.exit_zones=fp.exit_zones.filter((_,i)=>i!==item.index)
          return next
        })
      }
      return
    }
    if (activeTool==='select') {
      // Start rubber-band or single click
      setDrawing(true); setStartPt(pos); setMousePos(pos)
      return
    }
    setDrawing(true); setStartPt(pos); setMousePos(pos)
  }, [activeTool,floorPlan,setFloorPlan,pushUndo,scale])

  const handleMove = useCallback((pos) => {
    setMousePos(pos)
    let snapped=false
    for (const w of floorPlan.walls) {
      for (const [ex,ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]) {
        if (Math.hypot(pos.x-ex,pos.y-ey)<SNAP_RADIUS_PX) { setSnapIndicator({x:ex,y:ey}); snapped=true; break }
      }
      if (snapped) break
    }
    if (!snapped) setSnapIndicator(null)
  }, [floorPlan.walls,scale])

  const handleEnd = useCallback((pos) => {
    if (!drawing||!startPt) return
    setDrawing(false)

    if (activeTool==='select') {
      const x1=toMeters(startPt.x,scale),y1=toMeters(startPt.y,scale)
      const x2=toMeters(pos.x,scale),y2=toMeters(pos.y,scale)
      const dragDist = Math.hypot(x2-x1,y2-y1)

      if (dragDist < 0.2) {
        // Single click — select/deselect one item
        const item = findClosestItem(x1,y1,floorPlan)
        if (!item) {
          setSelected([])
        } else {
          const alreadySelected = selected.some(s=>s.type===item.type&&s.index===item.index)
          if (alreadySelected) {
            setSelected(selected.filter(s=>!(s.type===item.type&&s.index===item.index)))
          } else {
            setSelected([...selected, item])
          }
        }
      } else {
        // Rubber-band select
        const sx=Math.min(x1,x2),sy=Math.min(y1,y2),sw=Math.abs(x2-x1),sh=Math.abs(y2-y1)
        const items = getItemsInRect(floorPlan,sx,sy,sw,sh)
        setSelected(items)
      }
      setStartPt(null); setMousePos(null)
      return
    }

    const x1=toMeters(startPt.x,scale),y1=toMeters(startPt.y,scale)
    const x2=toMeters(pos.x,scale),y2=toMeters(pos.y,scale)
    const r=v=>Math.round(v*100)/100
    pushUndo(floorPlan)

    if (activeTool==='wall') {
      if (Math.hypot(x2-x1,y2-y1)<0.05) return
      setFloorPlan(fp=>({...fp,walls:[...fp.walls,{x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2)}]}))
    } else if (activeTool==='door') {
      if (Math.hypot(x2-x1,y2-y1)<0.1) return
      setFloorPlan(fp=>({...fp,walls:[...fp.walls,{x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2),isDoor:true}]}))
    } else if (activeTool==='obstacle') {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if(ow<0.05||oh<0.05) return
      setFloorPlan(fp=>({...fp,obstacles:[...fp.obstacles,{x:ox,y:oy,width:ow,height:oh}]}))
    } else if (activeTool==='spawn') {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if(ow<0.05||oh<0.05) return
      setFloorPlan(fp=>({...fp,spawn_zones:[...fp.spawn_zones,{x:ox,y:oy,w:ow,h:oh}]}))
    } else if (activeTool==='exit') {
      const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1))
      if(ow<0.05||oh<0.05) return
      setFloorPlan(fp=>({...fp,exit_zones:[...fp.exit_zones,{x:ox,y:oy,w:ow,h:oh}]}))
    }

    setStartPt(null); setMousePos(null); setSnapIndicator(null)
  }, [drawing,startPt,activeTool,floorPlan,setFloorPlan,pushUndo,scale,selected])

  const onMouseDown=useCallback((e)=>{handleStart(getPos(e))},[handleStart,getPos])
  const onMouseMove=useCallback((e)=>{if(drawing||activeTool==='select')handleMove(getPos(e))},[drawing,handleMove,getPos,activeTool])
  const onMouseUp=useCallback((e)=>{handleEnd(getPos(e))},[handleEnd,getPos])
  const onTouchStart=useCallback((e)=>{e.preventDefault();handleStart(getTouchPos(e))},[handleStart,getTouchPos])
  const onTouchMove=useCallback((e)=>{e.preventDefault();handleMove(getTouchPos(e))},[handleMove,getTouchPos])
  const onTouchEnd=useCallback((e)=>{e.preventDefault();handleEnd(getTouchPos(e))},[handleEnd,getTouchPos])

  const getCursor=()=>{
    if(activeTool==='select') return 'default'
    if(activeTool==='erase') return 'pointer'
    return 'crosshair'
  }

  return (
    <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",background:"#1a1d2e",borderRadius:6,border:"1px solid #2d3148",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"#64748b"}}>Snap:</span>
        {SNAP_OPTIONS.map(opt=>(
          <button key={String(opt.value)} onClick={()=>setGridSnap(opt.value)} style={{
            padding:"3px 8px",borderRadius:4,border:"1px solid",
            borderColor:gridSnap===opt.value?"#6366f1":"#2d3148",
            background:gridSnap===opt.value?"#3730a3":"transparent",
            color:gridSnap===opt.value?"white":"#64748b",
            fontSize:11,cursor:"pointer",
          }}>{opt.label}</button>
        ))}
      </div>
      <div style={{position:"relative",width:"100%",maxWidth:W}}>
        <canvas ref={canvasRef} width={W} height={H}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onMouseLeave={()=>{setDrawing(false);setMousePos(null);setSnapIndicator(null)}}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{cursor:getCursor(),borderRadius:4,touchAction:"none",width:"100%",height:"auto"}}
        />
        <div className="canvas-hint">
          {activeTool==="wall"&&"Drag to draw walls · Yellow circle = snap to endpoint"}
          {activeTool==="door"&&"Drag to place a door (yellow dashed = passable gap)"}
          {activeTool==="obstacle"&&"Drag to place a table or obstacle"}
          {activeTool==="spawn"&&"Drag to set where people appear"}
          {activeTool==="exit"&&"Drag to set where people go"}
          {activeTool==="erase"&&"Click any wall, zone or obstacle to erase it"}
          {activeTool==="select"&&"Click to select · Drag to multi-select · Del=delete · Ctrl+C/X/V"}
        </div>
      </div>
    </div>
  )
}
