import { useRef, useEffect } from "react"

const GRID_SIZE = 30
function toPx(m) { return m * GRID_SIZE }

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function lerp(a, b, t) { return a + (b - a) * t }

export default function SimulationView({ floorPlan, frame, heatMap, isDone, bottlenecks, agentTypes }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  // Two frame buffers for interpolation
  const prevFrame = useRef(null)
  const nextFrame = useRef(null)
  const frameTimestamp = useRef(0)   // when nextFrame arrived
  const frameDuration = useRef(100)  // ms between frames (auto-detected)
  const lastFrameArrival = useRef(0)

  const latestHeatMap = useRef(heatMap)
  const latestBottlenecks = useRef(bottlenecks)
  const isDoneRef = useRef(isDone)

  const W = toPx(floorPlan.width)
  const H = toPx(floorPlan.height)

  // When a new frame arrives from WebSocket, shift buffers
  useEffect(() => {
    if (!frame) return
    const now = performance.now()
    if (lastFrameArrival.current > 0) {
      const gap = now - lastFrameArrival.current
      // Smooth the estimated frame duration
      frameDuration.current = frameDuration.current * 0.8 + gap * 0.2
    }
    lastFrameArrival.current = now
    frameTimestamp.current = now
    prevFrame.current = nextFrame.current || frame
    nextFrame.current = frame
  }, [frame])

  useEffect(() => { latestHeatMap.current = heatMap }, [heatMap])
  useEffect(() => { latestBottlenecks.current = bottlenecks }, [bottlenecks])
  useEffect(() => { isDoneRef.current = isDone }, [isDone])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")

    const colorMap = {}
    if (agentTypes) {
      for (const t of agentTypes) colorMap[t.id] = hexToRgb(t.color)
    }
    const DEFAULT_COLORS = {
      customer: [167,139,250], staff: [52,211,153],
      child: [251,191,36], elderly: [148,163,184]
    }

    // Build a lookup of prev positions by agent id
    const getPrevPositions = (prev, next) => {
      if (!prev?.agents) return {}
      const map = {}
      for (const a of prev.agents) map[a.id] = a
      return map
    }

    const drawFrame = () => {
      const heatMap = latestHeatMap.current
      const bottlenecks = latestBottlenecks.current
      const isDone = isDoneRef.current
      const now = performance.now()

      // Compute interpolation factor (0 = prev frame, 1 = next frame)
      const elapsed = now - frameTimestamp.current
      const t = Math.min(elapsed / Math.max(frameDuration.current, 16), 1.0)

      const prev = prevFrame.current
      const next = nextFrame.current
      const prevPositions = getPrevPositions(prev, next)

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = "#161929"
      ctx.fillRect(0, 0, W, H)

      // Grid
      ctx.strokeStyle = "#1e2235"; ctx.lineWidth = 0.5
      for (let x = 0; x <= W; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y <= H; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }

      // Heat map
      if (heatMap) {
        const rows = heatMap.length, cols = heatMap[0]?.length || 0
        const cellW = W/cols, cellH = H/rows
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const intensity = heatMap[r][c]
            if (intensity < 0.05) continue
            let r2, g2, b2
            if (intensity < 0.33) { const t2=intensity/0.33; r2=0; g2=Math.floor(100+t2*155); b2=255 }
            else if (intensity < 0.66) { const t2=(intensity-0.33)/0.33; r2=Math.floor(t2*255); g2=255; b2=Math.floor(255*(1-t2)) }
            else { const t2=(intensity-0.66)/0.34; r2=255; g2=Math.floor(255*(1-t2)); b2=0 }
            ctx.fillStyle = `rgba(${r2},${g2},${b2},${intensity*0.8})`
            ctx.fillRect(c*cellW, r*cellH, cellW+1, cellH+1)
          }
        }
      }

      // Spawn zones
      for (const z of floorPlan.spawn_zones) {
        ctx.fillStyle="rgba(74,222,128,0.1)"; ctx.strokeStyle="rgba(74,222,128,0.4)"; ctx.lineWidth=1
        ctx.fillRect(toPx(z.x),toPx(z.y),toPx(z.w),toPx(z.h))
        ctx.strokeRect(toPx(z.x),toPx(z.y),toPx(z.w),toPx(z.h))
      }

      // Exit zones
      for (const z of floorPlan.exit_zones) {
        ctx.fillStyle="rgba(248,113,113,0.1)"; ctx.strokeStyle="rgba(248,113,113,0.4)"; ctx.lineWidth=1
        ctx.fillRect(toPx(z.x),toPx(z.y),toPx(z.w),toPx(z.h))
        ctx.strokeRect(toPx(z.x),toPx(z.y),toPx(z.w),toPx(z.h))
      }

      // Obstacles
      for (const o of floorPlan.obstacles) {
        ctx.fillStyle="rgba(100,116,139,0.5)"; ctx.strokeStyle="#94a3b8"; ctx.lineWidth=2
        ctx.fillRect(toPx(o.x),toPx(o.y),toPx(o.width),toPx(o.height))
        ctx.strokeRect(toPx(o.x),toPx(o.y),toPx(o.width),toPx(o.height))
      }

      // Walls and doors
      ctx.lineCap="round"
      for (const w of floorPlan.walls) {
        if (w.isDoor) {
          ctx.setLineDash([8,4]); ctx.strokeStyle="#fbbf24"; ctx.lineWidth=3
        } else {
          ctx.setLineDash([]); ctx.strokeStyle="#60a5fa"; ctx.lineWidth=3
        }
        ctx.beginPath(); ctx.moveTo(toPx(w.x1),toPx(w.y1)); ctx.lineTo(toPx(w.x2),toPx(w.y2)); ctx.stroke()
      }
      ctx.setLineDash([])

      ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2; ctx.strokeRect(1,1,W-2,H-2)

      // Bottlenecks
      if (bottlenecks?.length > 0) {
        for (const b of bottlenecks) {
          const bx=toPx(b.x)+GRID_SIZE/2, by=toPx(b.y)+GRID_SIZE/2
          ctx.beginPath(); ctx.arc(bx,by,10+b.intensity*10,0,Math.PI*2)
          ctx.strokeStyle=`rgba(251,191,36,${0.5+b.intensity*0.5})`; ctx.lineWidth=2; ctx.stroke()
          ctx.fillStyle="rgba(251,191,36,0.9)"; ctx.font="bold 12px sans-serif"; ctx.textAlign="center"
          ctx.fillText("!",bx,by+4); ctx.textAlign="left"
        }
      }

      if (next?.panic) { ctx.fillStyle="rgba(220,38,38,0.06)"; ctx.fillRect(0,0,W,H) }

      // Draw agents with interpolated positions
      if (next?.agents) {
        const densityMap = {}
        for (const agent of next.agents) {
          if (agent.reached) continue
          const key=`${Math.floor(agent.x)},${Math.floor(agent.y)}`
          densityMap[key]=(densityMap[key]||0)+1
        }
        const maxDensity = Math.max(...Object.values(densityMap), 1)

        for (const agent of next.agents) {
          if (agent.reached) continue

          // Interpolate position between prev and next frame
          const prevAgent = prevPositions[agent.id]
          let ax, ay
          if (prevAgent && !prevAgent.reached) {
            ax = toPx(lerp(prevAgent.x, agent.x, t))
            ay = toPx(lerp(prevAgent.y, agent.y, t))
          } else {
            ax = toPx(agent.x)
            ay = toPx(agent.y)
          }

          const baseColor = agent.color || colorMap[agent.type] || DEFAULT_COLORS[agent.type] || [167,139,250]
          const density=(densityMap[`${Math.floor(agent.x)},${Math.floor(agent.y)}`]||1)/maxDensity
          let r2=Math.floor(baseColor[0]*(1-density*0.6)+248*density*0.6)
          let g2=Math.floor(baseColor[1]*(1-density*0.6)+113*density*0.6)
          let b2=Math.floor(baseColor[2]*(1-density*0.6)+113*density*0.6)
          if (agent.panic){r2=Math.min(255,r2+80);g2=Math.max(0,g2-40);b2=Math.max(0,b2-40)}

          // Door delay ring
          if (agent.in_door) {
            ctx.beginPath(); ctx.arc(ax,ay,9,0,Math.PI*2)
            ctx.strokeStyle="rgba(251,191,36,0.7)"; ctx.lineWidth=2; ctx.stroke()
          }

          ctx.beginPath(); ctx.arc(ax,ay,5,0,Math.PI*2)
          ctx.fillStyle=`rgb(${r2},${g2},${b2})`; ctx.fill()

          const speed=Math.hypot(agent.vx,agent.vy)
          if (speed>0.1) {
            ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+agent.vx*5,ay+agent.vy*5)
            ctx.strokeStyle=`rgba(${r2},${g2},${b2},0.35)`; ctx.lineWidth=1; ctx.stroke()
          }
        }
      }

      if (isDone && !heatMap) {
        ctx.fillStyle="rgba(0,0,0,0.35)"; ctx.fillRect(0,0,W,H)
        ctx.fillStyle="#a78bfa"; ctx.font="bold 15px sans-serif"; ctx.textAlign="center"
        ctx.fillText("Done — toggle Heat Map or click ↩ Edit",W/2,H/2)
        ctx.textAlign="left"
      }

      rafRef.current = requestAnimationFrame(drawFrame)
    }

    rafRef.current = requestAnimationFrame(drawFrame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [floorPlan, W, H, agentTypes])

  return <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 4 }} />
}
