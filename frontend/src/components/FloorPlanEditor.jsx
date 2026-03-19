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
  return { x: snapToGrid(x, toPx(gridSizeM,scale)), y: snapToGrid(y, toPx(gridSizeM,scale)) }
}

const SNAP_OPTIONS = [
  { label: '1m', value: 1.0 },
  { label: '0.5m', value: 0.5 },
  { label: '0.25m', value: 0.25 },
  { label: '0.1m', value: 0.1 },
  { label: 'Free', value: null },
]

function ptInRect(px, py, rx, ry, rw, rh) { return px>=rx && px<=rx+rw && py>=ry && py<=ry+rh }

function getItemsInRect(floorPlan, sx, sy, sw, sh) {
  const sel = []
  floorPlan.walls.forEach((w,i) => { if (ptInRect((w.x1+w.x2)/2,(w.y1+w.y2)/2,sx,sy,sw,sh)) sel.push({type:'wall',index:i}) })
  floorPlan.obstacles.forEach((o,i) => { if (ptInRect(o.x+o.width/2,o.y+o.height/2,sx,sy,sw,sh)) sel.push({type:'obstacle',index:i}) })
  floorPlan.spawn_zones.forEach((z,i) => { if (ptInRect(z.x+z.w/2,z.y+z.h/2,sx,sy,sw,sh)) sel.push({type:'spawn',index:i}) })
  floorPlan.exit_zones.forEach((z,i) => { if (ptInRect(z.x+z.w/2,z.y+z.h/2,sx,sy,sw,sh)) sel.push({type:'exit',index:i}) })
  return sel
}

function findClosestItem(mx, my, floorPlan) {
  let best = null, bestDist = 1.5
  floorPlan.walls.forEach((w,i) => { const d=Math.hypot((w.x1+w.x2)/2-mx,(w.y1+w.y2)/2-my); if(d<bestDist){bestDist=d;best={type:'wall',index:i}} })
  floorPlan.obstacles.forEach((o,i) => { const d=Math.hypot(o.x+o.width/2-mx,o.y+o.height/2-my); if(d<bestDist){bestDist=d;best={type:'obstacle',index:i}} })
  floorPlan.spawn_zones.forEach((z,i) => { const d=Math.hypot(z.x+z.w/2-mx,z.y+z.h/2-my); if(d<bestDist){bestDist=d;best={type:'spawn',index:i}} })
  floorPlan.exit_zones.forEach((z,i) => { const d=Math.hypot(z.x+z.w/2-mx,z.y+z.h/2-my); if(d<bestDist){bestDist=d;best={type:'exit',index:i}} })
  return best
}

function getItemData(fp, item) {
  if (item.type==='wall') return {...fp.walls[item.index]}
  if (item.type==='obstacle') return {...fp.obstacles[item.index]}
  if (item.type==='spawn') return {...fp.spawn_zones[item.index]}
  if (item.type==='exit') return {...fp.exit_zones[item.index]}
  return null
}

// Get bounding box center of a clipboard set
function getClipboardCenter(items) {
  let xs = [], ys = []
  items.forEach(item => {
    const d = item.data
    if (item.type==='wall') { xs.push(d.x1,d.x2); ys.push(d.y1,d.y2) }
    else if (item.type==='obstacle') { xs.push(d.x+d.width/2); ys.push(d.y+d.height/2) }
    else if (item.type==='spawn'||item.type==='exit') { xs.push(d.x+d.w/2); ys.push(d.y+d.h/2) }
  })
  if (xs.length === 0) return { cx: 0, cy: 0 }
  return { cx: (Math.min(...xs)+Math.max(...xs))/2, cy: (Math.min(...ys)+Math.max(...ys))/2 }
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
  const [selected, setSelected] = useState([])
  const [clipboard, setClipboard] = useState([])
  const [pasteMode, setPasteMode] = useState(false) // waiting for click to place
  const bgImgRef = useRef(null)

  const scale = DISPLAY_SCALE
  const W = toPx(floorPlan.width, scale)
  const H = toPx(floorPlan.height, scale)

  useEffect(() => {
    if (backgroundImage) { const img=new Image(); img.onload=()=>{bgImgRef.current=img}; img.src=backgroundImage }
    else bgImgRef.current=null
  }, [backgroundImage])

  const pushUndo = useCallback((prevState) => {
    setUndoStack(s=>[...s.slice(-30),prevState]); setRedoStack([])
  }, [setUndoStack, setRedoStack])

  const getPosFromCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const sx=canvas.width/rect.width, sy=canvas.height/rect.height
    const rawX=(clientX-rect.left)*sx, rawY=(clientY-rect.top)*sy
    if (gridSnap===null) return {x:rawX,y:rawY}
    return snapPoint(rawX,rawY,floorPlan,gridSnap,scale)
  }, [floorPlan,gridSnap,scale])

  const getPos = useCallback((e)=>getPosFromCoords(e.clientX,e.clientY),[getPosFromCoords])
  const getTouchPos = useCallback((e)=>{const t=e.touches[0]||e.changedTouches[0];return getPosFromCoords(t.clientX,t.clientY)},[getPosFromCoords])

  const deleteSelected = useCallback(() => {
    if (selected.length===0) return
    pushUndo(floorPlan)
    setFloorPlan(fp => {
      const wi=new Set(selected.filter(s=>s.type==='wall').map(s=>s.index))
      const oi=new Set(selected.filter(s=>s.type==='obstacle').map(s=>s.index))
      const si=new Set(selected.filter(s=>s.type==='spawn').map(s=>s.index))
      const ei=new Set(selected.filter(s=>s.type==='exit').map(s=>s.index))
      return {...fp,walls:fp.walls.filter((_,i)=>!wi.has(i)),obstacles:fp.obstacles.filter((_,i)=>!oi.has(i)),spawn_zones:fp.spawn_zones.filter((_,i)=>!si.has(i)),exit_zones:fp.exit_zones.filter((_,i)=>!ei.has(i))}
    })
    setSelected([])
  }, [selected,floorPlan,pushUndo,setFloorPlan])

  const copySelected = useCallback((cut=false) => {
    if (selected.length===0) return
    const items = selected.map(s=>({type:s.type,data:getItemData(floorPlan,s)})).filter(i=>i.data)
    setClipboard(items)
    setPasteMode(true) // enter paste mode — next click places items
    if (cut) deleteSelected()
  }, [selected,floorPlan,deleteSelected])

  // Place clipboard items at a target position (in meters)
  const pasteAt = useCallback((targetX, targetY) => {
    if (clipboard.length===0) return
    const {cx,cy} = getClipboardCenter(clipboard)
    const dx=targetX-cx, dy=targetY-cy
    const r=v=>Math.round(v*100)/100
    pushUndo(floorPlan)
    setFloorPlan(fp => {
      const next={...fp,walls:[...fp.walls],obstacles:[...fp.obstacles],spawn_zones:[...fp.spawn_zones],exit_zones:[...fp.exit_zones]}
      clipboard.forEach(item => {
        const d=item.data
        if (item.type==='wall') next.walls.push({...d,x1:r(d.x1+dx),y1:r(d.y1+dy),x2:r(d.x2+dx),y2:r(d.y2+dy)})
        else if (item.type==='obstacle') next.obstacles.push({...d,x:r(d.x+dx),y:r(d.y+dy)})
        else if (item.type==='spawn') next.spawn_zones.push({...d,x:r(d.x+dx),y:r(d.y+dy)})
        else if (item.type==='exit') next.exit_zones.push({...d,x:r(d.x+dx),y:r(d.y+dy)})
      })
      return next
    })
    setPasteMode(false)
  }, [clipboard,floorPlan,pushUndo,setFloorPlan])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName==='INPUT') return
      if (activeTool!=='select') { if (e.key==='Escape') setPasteMode(false); return }
      if (e.key==='Escape') { setPasteMode(false); setSelected([]) }
      if (e.key==='Delete'||e.key==='Backspace') { e.preventDefault(); deleteSelected() }
      if ((e.ctrlKey||e.metaKey)&&e.key==='c') { e.preventDefault(); copySelected(false) }
      if ((e.ctrlKey||e.metaKey)&&e.key==='x') { e.preventDefault(); copySelected(true) }
      if ((e.ctrlKey||e.metaKey)&&e.key==='v') {
        e.preventDefault()
        if (clipboard.length>0) setPasteMode(true)
      }
      if ((e.ctrlKey||e.metaKey)&&e.key==='a') {
        e.preventDefault()
        const all=[]
        floorPlan.walls.forEach((_,i)=>all.push({type:'wall',index:i}))
        floorPlan.obstacles.forEach((_,i)=>all.push({type:'obstacle',index:i}))
        floorPlan.spawn_zones.forEach((_,i)=>all.push({type:'spawn',index:i}))
        floorPlan.exit_zones.forEach((_,i)=>all.push({type:'exit',index:i}))
        setSelected(all)
      }
    }
    window.addEventListener('keydown',handleKey)
    return ()=>window.removeEventListener('keydown',handleKey)
  }, [activeTool,deleteSelected,copySelected,pasteAt,clipboard,floorPlan])

  const isItemSelected=(type,index)=>selected.some(s=>s.type===type&&s.index===index)

  const draw = useCallback(() => {
    const canvas=canvasRef.current; if(!canvas) return
    const ctx=canvas.getContext("2d")
    ctx.clearRect(0,0,W,H)
    ctx.fillStyle="#161929"; ctx.fillRect(0,0,W,H)
    if (bgImgRef.current){ctx.globalAlpha=0.35;ctx.drawImage(bgImgRef.current,0,0,W,H);ctx.globalAlpha=1.0}

    const gridSizePx=gridSnap?toPx(gridSnap,scale):toPx(0.5,scale)
    const majorGridPx=toPx(1.0,scale)
    ctx.strokeStyle="#161f33";ctx.lineWidth=0.4
    for(let x=0;x<=W;x+=gridSizePx){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<=H;y+=gridSizePx){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle="#1e2235";ctx.lineWidth=0.7
    for(let x=0;x<=W;x+=majorGridPx){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<=H;y+=majorGridPx){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}

    floorPlan.spawn_zones.forEach((z,i)=>{
      const sel=isItemSelected('spawn',i)
      ctx.fillStyle="rgba(74,222,128,0.15)";ctx.strokeStyle=sel?"#fff":"rgba(74,222,128,0.6)";ctx.lineWidth=sel?2:1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle="rgba(74,222,128,0.8)";ctx.font="bold 10px sans-serif"
      ctx.fillText("SPAWN",toPx(z.x,scale)+4,toPx(z.y,scale)+14)
    })

    floorPlan.exit_zones.forEach((z,i)=>{
      const sel=isItemSelected('exit',i)
      ctx.fillStyle="rgba(248,113,113,0.15)";ctx.strokeStyle=sel?"#fff":"rgba(248,113,113,0.6)";ctx.lineWidth=sel?2:1.5
      ctx.fillRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.strokeRect(toPx(z.x,scale),toPx(z.y,scale),toPx(z.w,scale),toPx(z.h,scale))
      ctx.fillStyle="rgba(248,113,113,0.8)";ctx.font="bold 10px sans-serif"
      ctx.fillText("EXIT",toPx(z.x,scale)+4,toPx(z.y,scale)+14)
    })

    floorPlan.obstacles.forEach((o,i)=>{
      const sel=isItemSelected('obstacle',i)
      ctx.fillStyle=sel?"rgba(100,116,139,0.6)":"rgba(100,116,139,0.4)"
      ctx.strokeStyle=sel?"#fff":"#94a3b8";ctx.lineWidth=sel?2:1.5
      ctx.fillRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
      ctx.strokeRect(toPx(o.x,scale),toPx(o.y,scale),toPx(o.width,scale),toPx(o.height,scale))
    })

    ctx.lineCap="round"
    floorPlan.walls.forEach((w,i)=>{
      const sel=isItemSelected('wall',i)
      if(w.isDoor){ctx.setLineDash([8,4]);ctx.strokeStyle=sel?"#fff":"#fbbf24";ctx.lineWidth=sel?5:3}
      else{ctx.setLineDash([]);ctx.strokeStyle=sel?"#fff":"#60a5fa";ctx.lineWidth=sel?5:3}
      ctx.beginPath();ctx.moveTo(toPx(w.x1,scale),toPx(w.y1,scale));ctx.lineTo(toPx(w.x2,scale),toPx(w.y2,scale));ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle=sel?"#fff":(w.isDoor?"#fde68a":"#93c5fd")
      for(const [ex,ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]){ctx.beginPath();ctx.arc(ex,ey,3,0,Math.PI*2);ctx.fill()}
    })

    ctx.strokeStyle="#3b82f6";ctx.lineWidth=2;ctx.strokeRect(1,1,W-2,H-2)

    // Drawing previews
    if(drawing&&startPt&&mousePos){
      if(activeTool==='wall'){
        ctx.setLineDash([5,5]);ctx.strokeStyle="#60a5fa";ctx.lineWidth=3
        ctx.beginPath();ctx.moveTo(startPt.x,startPt.y);ctx.lineTo(mousePos.x,mousePos.y);ctx.stroke()
        ctx.setLineDash([])
        const len=Math.hypot(toMeters(mousePos.x-startPt.x,scale),toMeters(mousePos.y-startPt.y,scale)).toFixed(2)
        ctx.fillStyle="#60a5fa";ctx.font="11px sans-serif"
        ctx.fillText(`${len}m`,(startPt.x+mousePos.x)/2+4,(startPt.y+mousePos.y)/2-4)
      } else if(activeTool==='door'){
        ctx.setLineDash([8,4]);ctx.strokeStyle="#fbbf24";ctx.lineWidth=4
        ctx.beginPath();ctx.moveTo(startPt.x,startPt.y);ctx.lineTo(mousePos.x,mousePos.y);ctx.stroke()
        ctx.setLineDash([])
        const len=Math.hypot(toMeters(mousePos.x-startPt.x,scale),toMeters(mousePos.y-startPt.y,scale)).toFixed(2)
        ctx.fillStyle="#fbbf24";ctx.font="11px sans-serif"
        ctx.fillText(`${len}m gap`,(startPt.x+mousePos.x)/2+4,(startPt.y+mousePos.y)/2-4)
      } else if(['obstacle','spawn','exit'].includes(activeTool)){
        ctx.setLineDash([5,5])
        const x=Math.min(startPt.x,mousePos.x),y=Math.min(startPt.y,mousePos.y)
        const w=Math.abs(mousePos.x-startPt.x),h=Math.abs(mousePos.y-startPt.y)
        ctx.strokeStyle=activeTool==="spawn"?"#4ade80":activeTool==="exit"?"#f87171":"#94a3b8"
        ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.setLineDash([])
        ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif"
        ctx.fillText(`${(w/scale).toFixed(2)}×${(h/scale).toFixed(2)}m`,x+4,y-4)
      } else if(activeTool==='select'){
        const x=Math.min(startPt.x,mousePos.x),y=Math.min(startPt.y,mousePos.y)
        const w=Math.abs(mousePos.x-startPt.x),h=Math.abs(mousePos.y-startPt.y)
        ctx.fillStyle="rgba(99,102,241,0.1)";ctx.fillRect(x,y,w,h)
        ctx.strokeStyle="#6366f1";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([])
      }
    }

    // Paste mode ghost preview
    if(pasteMode&&mousePos&&clipboard.length>0){
      const mx=toMeters(mousePos.x,scale),my=toMeters(mousePos.y,scale)
      const {cx,cy}=getClipboardCenter(clipboard)
      const dx=mx-cx,dy=my-cy
      ctx.globalAlpha=0.45
      clipboard.forEach(item=>{
        const d=item.data
        if(item.type==='wall'){
          ctx.strokeStyle=d.isDoor?"#fbbf24":"#60a5fa";ctx.lineWidth=3;ctx.lineCap="round"
          if(d.isDoor)ctx.setLineDash([8,4])
          ctx.beginPath();ctx.moveTo(toPx(d.x1+dx,scale),toPx(d.y1+dy,scale));ctx.lineTo(toPx(d.x2+dx,scale),toPx(d.y2+dy,scale));ctx.stroke()
          ctx.setLineDash([])
        } else if(item.type==='obstacle'){
          ctx.fillStyle="rgba(100,116,139,0.5)";ctx.strokeStyle="#94a3b8";ctx.lineWidth=1.5
          ctx.fillRect(toPx(d.x+dx,scale),toPx(d.y+dy,scale),toPx(d.width,scale),toPx(d.height,scale))
          ctx.strokeRect(toPx(d.x+dx,scale),toPx(d.y+dy,scale),toPx(d.width,scale),toPx(d.height,scale))
        } else if(item.type==='spawn'){
          ctx.fillStyle="rgba(74,222,128,0.2)";ctx.strokeStyle="rgba(74,222,128,0.6)";ctx.lineWidth=1.5
          ctx.fillRect(toPx(d.x+dx,scale),toPx(d.y+dy,scale),toPx(d.w,scale),toPx(d.h,scale))
          ctx.strokeRect(toPx(d.x+dx,scale),toPx(d.y+dy,scale),toPx(d.w,scale),toPx(d.h,scale))
        } else if(item.type==='exit'){
          ctx.fillStyle="rgba(248,113,113,0.2)";ctx.strokeStyle="rgba(248,113,113,0.6)";ctx.lineWidth=1.5
          ctx.fillRect(toPx(d.x+dx,scale),toPx(d.y+dy,scale),toPx(d.w,scale),toPx(d.h,scale))
          ctx.strokeRect(toPx(d.x+dx,scale),toPx(d.y+dy,scale),toPx(d.w,scale),toPx(d.h,scale))
        }
      })
      ctx.globalAlpha=1.0
      ctx.fillStyle="#6366f1";ctx.font="bold 12px sans-serif";ctx.textAlign="center"
      ctx.fillText("Click to paste · Esc to cancel",mousePos.x,mousePos.y-14)
      ctx.textAlign="left"
    }

    if(snapIndicator){ctx.beginPath();ctx.arc(snapIndicator.x,snapIndicator.y,7,0,Math.PI*2);ctx.strokeStyle="#fbbf24";ctx.lineWidth=2;ctx.stroke()}

    if(activeTool==='select'&&selected.length>0&&!pasteMode){
      ctx.fillStyle="rgba(99,102,241,0.85)";ctx.fillRect(0,H-24,W,24)
      ctx.fillStyle="white";ctx.font="11px sans-serif"
      ctx.fillText(`${selected.length} selected · Del · Ctrl+C · Ctrl+X · Ctrl+V=paste · Ctrl+A=all · Esc=deselect`,8,H-8)
    }

    if(pasteMode){
      ctx.fillStyle="rgba(251,191,36,0.9)";ctx.fillRect(0,H-24,W,24)
      ctx.fillStyle="#1a1d2e";ctx.font="bold 11px sans-serif"
      ctx.fillText("PASTE MODE — move mouse to position, click to place, Esc to cancel",8,H-8)
    }

  }, [floorPlan,drawing,startPt,mousePos,activeTool,snapIndicator,gridSnap,W,H,scale,selected,pasteMode,clipboard])

  useEffect(()=>{draw()},[draw])

  const handleStart = useCallback((pos) => {
    // In paste mode, clicking places items
    if(pasteMode){
      const mx=toMeters(pos.x,scale),my=toMeters(pos.y,scale)
      pasteAt(mx,my)
      return
    }
    if(activeTool==='erase'){
      const mx=toMeters(pos.x,scale),my=toMeters(pos.y,scale)
      const item=findClosestItem(mx,my,floorPlan)
      if(item){
        pushUndo(floorPlan)
        setFloorPlan(fp=>{
          const next={...fp}
          if(item.type==='wall')next.walls=fp.walls.filter((_,i)=>i!==item.index)
          else if(item.type==='obstacle')next.obstacles=fp.obstacles.filter((_,i)=>i!==item.index)
          else if(item.type==='spawn')next.spawn_zones=fp.spawn_zones.filter((_,i)=>i!==item.index)
          else if(item.type==='exit')next.exit_zones=fp.exit_zones.filter((_,i)=>i!==item.index)
          return next
        })
      }
      return
    }
    setDrawing(true);setStartPt(pos);setMousePos(pos)
  }, [activeTool,floorPlan,setFloorPlan,pushUndo,scale,pasteMode,pasteAt])

  const handleMove = useCallback((pos) => {
    setMousePos(pos)
    let snapped=false
    for(const w of floorPlan.walls){
      for(const [ex,ey] of [[toPx(w.x1,scale),toPx(w.y1,scale)],[toPx(w.x2,scale),toPx(w.y2,scale)]]){
        if(Math.hypot(pos.x-ex,pos.y-ey)<SNAP_RADIUS_PX){setSnapIndicator({x:ex,y:ey});snapped=true;break}
      }
      if(snapped)break
    }
    if(!snapped)setSnapIndicator(null)
  }, [floorPlan.walls,scale])

  const handleEnd = useCallback((pos) => {
    if(!drawing||!startPt)return
    setDrawing(false)
    if(activeTool==='select'){
      const x1=toMeters(startPt.x,scale),y1=toMeters(startPt.y,scale)
      const x2=toMeters(pos.x,scale),y2=toMeters(pos.y,scale)
      if(Math.hypot(x2-x1,y2-y1)<0.2){
        const item=findClosestItem(x1,y1,floorPlan)
        if(!item){setSelected([])}
        else{
          const already=selected.some(s=>s.type===item.type&&s.index===item.index)
          setSelected(already?selected.filter(s=>!(s.type===item.type&&s.index===item.index)):[...selected,item])
        }
      } else {
        const sx=Math.min(x1,x2),sy=Math.min(y1,y2),sw=Math.abs(x2-x1),sh=Math.abs(y2-y1)
        setSelected(getItemsInRect(floorPlan,sx,sy,sw,sh))
      }
      setStartPt(null);setMousePos(null);return
    }
    const x1=toMeters(startPt.x,scale),y1=toMeters(startPt.y,scale)
    const x2=toMeters(pos.x,scale),y2=toMeters(pos.y,scale)
    const r=v=>Math.round(v*100)/100
    pushUndo(floorPlan)
    if(activeTool==='wall'){if(Math.hypot(x2-x1,y2-y1)<0.05)return;setFloorPlan(fp=>({...fp,walls:[...fp.walls,{x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2)}]}))}
    else if(activeTool==='door'){if(Math.hypot(x2-x1,y2-y1)<0.1)return;setFloorPlan(fp=>({...fp,walls:[...fp.walls,{x1:r(x1),y1:r(y1),x2:r(x2),y2:r(y2),isDoor:true}]}))}
    else if(activeTool==='obstacle'){const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1));if(ow<0.05||oh<0.05)return;setFloorPlan(fp=>({...fp,obstacles:[...fp.obstacles,{x:ox,y:oy,width:ow,height:oh}]}))}
    else if(activeTool==='spawn'){const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1));if(ow<0.05||oh<0.05)return;setFloorPlan(fp=>({...fp,spawn_zones:[...fp.spawn_zones,{x:ox,y:oy,w:ow,h:oh}]}))}
    else if(activeTool==='exit'){const ox=r(Math.min(x1,x2)),oy=r(Math.min(y1,y2)),ow=r(Math.abs(x2-x1)),oh=r(Math.abs(y2-y1));if(ow<0.05||oh<0.05)return;setFloorPlan(fp=>({...fp,exit_zones:[...fp.exit_zones,{x:ox,y:oy,w:ow,h:oh}]}))}
    setStartPt(null);setMousePos(null);setSnapIndicator(null)
  }, [drawing,startPt,activeTool,floorPlan,setFloorPlan,pushUndo,scale,selected])

  const onMouseDown=useCallback((e)=>{handleStart(getPos(e))},[handleStart,getPos])
  const onMouseMove=useCallback((e)=>{handleMove(getPos(e))},[handleMove,getPos])
  const onMouseUp=useCallback((e)=>{handleEnd(getPos(e))},[handleEnd,getPos])
  const onTouchStart=useCallback((e)=>{e.preventDefault();handleStart(getTouchPos(e))},[handleStart,getTouchPos])
  const onTouchMove=useCallback((e)=>{e.preventDefault();handleMove(getTouchPos(e))},[handleMove,getTouchPos])
  const onTouchEnd=useCallback((e)=>{e.preventDefault();handleEnd(getTouchPos(e))},[handleEnd,getTouchPos])

  const getCursor=()=>{
    if(pasteMode) return 'copy'
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
            color:gridSnap===opt.value?"white":"#64748b",fontSize:11,cursor:"pointer",
          }}>{opt.label}</button>
        ))}
      </div>
      <div style={{position:"relative",width:"100%",maxWidth:W}}>
        <canvas ref={canvasRef} width={W} height={H}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onMouseLeave={()=>{if(!pasteMode){setDrawing(false);setMousePos(null);setSnapIndicator(null)}}}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{cursor:getCursor(),borderRadius:4,touchAction:"none",width:"100%",height:"auto"}}
        />
        <div className="canvas-hint">
          {!pasteMode&&activeTool==="wall"&&"Drag to draw walls · Yellow circle = snap to endpoint"}
          {!pasteMode&&activeTool==="door"&&"Drag to place a door (yellow dashed = passable gap)"}
          {!pasteMode&&activeTool==="obstacle"&&"Drag to place a table or obstacle"}
          {!pasteMode&&activeTool==="spawn"&&"Drag to set where people appear"}
          {!pasteMode&&activeTool==="exit"&&"Drag to set where people go"}
          {!pasteMode&&activeTool==="erase"&&"Click any wall, zone or obstacle to erase it"}
          {!pasteMode&&activeTool==="select"&&"Drag to multi-select · Click=select · Del · Ctrl+C/X/V · Ctrl+A=all"}
          {pasteMode&&"Move mouse to position and click to paste · Esc to cancel"}
        </div>
      </div>
    </div>
  )
}
