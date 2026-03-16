import { useRef, useEffect } from "react"

const GRID_SIZE = 30
function toPx(m) { return m * GRID_SIZE }

export default function SimulationView({ floorPlan, frame, heatMap, isDone, bottlenecks }) {
  const canvasRef = useRef(null)

  const W = toPx(floorPlan.width)
  const H = toPx(floorPlan.height)

  useEffect(() => {
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

    // Heat map overlay
    if (heatMap) {
      const rows = heatMap.length
      const cols = heatMap[0]?.length || 0
      const cellW = W / cols
      const cellH = H / rows
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const intensity = heatMap[r][c]
          if (intensity < 0.05) continue
          const alpha = intensity * 0.8
          let r2, g2, b2
          if (intensity < 0.33) {
            const t = intensity / 0.33
            r2 = 0; g2 = Math.floor(100 + t * 155); b2 = 255
          } else if (intensity < 0.66) {
            const t = (intensity - 0.33) / 0.33
            r2 = Math.floor(t * 255); g2 = 255; b2 = Math.floor(255 * (1 - t))
          } else {
            const t = (intensity - 0.66) / 0.34
            r2 = 255; g2 = Math.floor(255 * (1 - t)); b2 = 0
          }
          ctx.fillStyle = `rgba(${r2},${g2},${b2},${alpha})`
          ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1)
        }
      }
    }

    // Spawn zones
    for (const z of floorPlan.spawn_zones) {
      ctx.fillStyle = "rgba(74,222,128,0.1)"
      ctx.strokeStyle = "rgba(74,222,128,0.4)"
      ctx.lineWidth = 1
      ctx.fillRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
      ctx.strokeRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
    }

    // Exit zones
    for (const z of floorPlan.exit_zones) {
      ctx.fillStyle = "rgba(248,113,113,0.1)"
      ctx.strokeStyle = "rgba(248,113,113,0.4)"
      ctx.lineWidth = 1
      ctx.fillRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
      ctx.strokeRect(toPx(z.x), toPx(z.y), toPx(z.w), toPx(z.h))
    }

    // Obstacles
    for (const o of floorPlan.obstacles) {
      ctx.fillStyle = "rgba(100,116,139,0.5)"
      ctx.strokeStyle = "#94a3b8"
      ctx.lineWidth = 2
      ctx.fillRect(toPx(o.x), toPx(o.y), toPx(o.width), toPx(o.height))
      ctx.strokeRect(toPx(o.x), toPx(o.y), toPx(o.width), toPx(o.height))
    }

    // Walls
    ctx.strokeStyle = "#60a5fa"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    for (const w of floorPlan.walls) {
      ctx.beginPath()
      ctx.moveTo(toPx(w.x1), toPx(w.y1))
      ctx.lineTo(toPx(w.x2), toPx(w.y2))
      ctx.stroke()
    }

    // Room boundary
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, W - 2, H - 2)

    // Bottleneck markers (shown after simulation)
    if (bottlenecks && bottlenecks.length > 0) {
      for (const b of bottlenecks) {
        const bx = toPx(b.x) + GRID_SIZE / 2
        const by = toPx(b.y) + GRID_SIZE / 2
        const radius = 10 + b.intensity * 10
        ctx.beginPath()
        ctx.arc(bx, by, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(251,191,36,${0.5 + b.intensity * 0.5})`
        ctx.lineWidth = 2
        ctx.stroke()
        // Warning icon
        ctx.fillStyle = `rgba(251,191,36,0.9)`
        ctx.font = "bold 12px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("!", bx, by + 4)
        ctx.textAlign = "left"
      }
    }

    // Agents — colored by local density
    if (frame && frame.agents) {
      // Build density map: count agents in each grid cell
      const densityMap = {}
      for (const agent of frame.agents) {
        if (agent.reached) continue
        const gc = Math.floor(agent.x)
        const gr = Math.floor(agent.y)
        const key = `${gc},${gr}`
        densityMap[key] = (densityMap[key] || 0) + 1
      }
      const maxDensity = Math.max(...Object.values(densityMap), 1)

      for (const agent of frame.agents) {
        if (agent.reached) continue
        const ax = toPx(agent.x)
        const ay = toPx(agent.y)

        const gc = Math.floor(agent.x)
        const gr = Math.floor(agent.y)
        const density = (densityMap[`${gc},${gr}`] || 1) / maxDensity

        // Color by density: sparse=green, dense=red
        const r2 = Math.floor(density * 248 + (1 - density) * 74)
        const g2 = Math.floor(density * 113 + (1 - density) * 222)
        const b2 = Math.floor(density * 113 + (1 - density) * 128)

        ctx.beginPath()
        ctx.arc(ax, ay, 5, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${r2},${g2},${b2})`
        ctx.fill()

        // Velocity arrow
        const speed = Math.hypot(agent.vx, agent.vy)
        if (speed > 0.1) {
          const scale = 8 / 1.5
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(ax + agent.vx * scale, ay + agent.vy * scale)
          ctx.strokeStyle = `rgba(${r2},${g2},${b2},0.4)`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    // Done overlay
    if (isDone && !heatMap) {
      ctx.fillStyle = "rgba(0,0,0,0.35)"
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = "#a78bfa"
      ctx.font = "bold 15px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Done — toggle Heat Map or click Back to Editor", W / 2, H / 2)
      ctx.textAlign = "left"
    }

  }, [frame, heatMap, bottlenecks, floorPlan, isDone, W, H])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ borderRadius: 4 }}
    />
  )
}
