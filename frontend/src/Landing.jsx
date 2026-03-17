import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

function PreviewCanvas() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const SCALE = W / 20

    const obstacles = [
      {x:3,y:2,w:2,h:1.5},{x:3,y:5,w:2,h:1.5},{x:3,y:8,w:2,h:1.5},{x:3,y:11,w:2,h:1.5},
      {x:7,y:2,w:2,h:1.5},{x:7,y:5,w:2,h:1.5},{x:7,y:8,w:2,h:1.5},{x:7,y:11,w:2,h:1.5},
      {x:11,y:2,w:2,h:1.5},{x:11,y:5,w:2,h:1.5},{x:11,y:8,w:2,h:1.5},{x:11,y:11,w:2,h:1.5},
    ]
    const walls = [
      {x1:14,y1:1,x2:14,y2:6},{x1:14,y1:9,x2:14,y2:14}
    ]

    const agents = []
    for (let i = 0; i < 40; i++) {
      agents.push({
        x: 0.5 + Math.random() * 1.5,
        y: 1 + Math.random() * 13,
        vx: Math.random() * 0.8 + 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        destX: 16 + Math.random() * 2,
        destY: 6 + Math.random() * 3,
        reached: false,
      })
    }

    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#161929'
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = '#1e2235'; ctx.lineWidth = 0.5
      for (let x = 0; x <= W; x += SCALE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y <= H; y += SCALE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }

      ctx.fillStyle = 'rgba(74,222,128,0.1)'; ctx.strokeStyle = 'rgba(74,222,128,0.4)'; ctx.lineWidth = 1
      ctx.fillRect(0.5*SCALE, 1*SCALE, 2*SCALE, 13*SCALE)
      ctx.strokeRect(0.5*SCALE, 1*SCALE, 2*SCALE, 13*SCALE)

      ctx.fillStyle = 'rgba(248,113,113,0.1)'; ctx.strokeStyle = 'rgba(248,113,113,0.4)'
      ctx.fillRect(15*SCALE, 6*SCALE, 4*SCALE, 3*SCALE)
      ctx.strokeRect(15*SCALE, 6*SCALE, 4*SCALE, 3*SCALE)

      for (const o of obstacles) {
        ctx.fillStyle = 'rgba(100,116,139,0.45)'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5
        ctx.fillRect(o.x*SCALE, o.y*SCALE, o.w*SCALE, o.h*SCALE)
        ctx.strokeRect(o.x*SCALE, o.y*SCALE, o.w*SCALE, o.h*SCALE)
      }

      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
      for (const w of walls) {
        ctx.beginPath(); ctx.moveTo(w.x1*SCALE, w.y1*SCALE); ctx.lineTo(w.x2*SCALE, w.y2*SCALE); ctx.stroke()
      }

      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2
      ctx.strokeRect(1, 1, W-2, H-2)

      for (const a of agents) {
        if (a.reached) {
          a.x = 0.5 + Math.random() * 1.0; a.y = 1 + Math.random() * 13; a.reached = false; continue
        }
        const dx = a.destX - a.x, dy = a.destY - a.y
        const d = Math.hypot(dx, dy)
        if (d < 0.5) { a.reached = true; continue }
        a.vx += (dx/d * 0.8 - a.vx) * 0.05
        a.vy += (dy/d * 0.8 - a.vy) * 0.05
        for (const b of agents) {
          if (b === a || b.reached) continue
          const rx = a.x - b.x, ry = a.y - b.y, rd = Math.hypot(rx, ry)
          if (rd < 0.8 && rd > 0.01) { a.vx += (rx/rd)*0.04; a.vy += (ry/rd)*0.04 }
        }
        a.x += a.vx * 0.016; a.y += a.vy * 0.016
        a.x = Math.max(0.2, Math.min(19.8, a.x)); a.y = Math.max(0.2, Math.min(14.8, a.y))
        const nearby = agents.filter(b => !b.reached && Math.hypot(b.x-a.x,b.y-a.y) < 1.5).length
        const r2 = Math.min(255, nearby*40), g2 = Math.max(50, 200-nearby*30), b2 = Math.max(50, 200-nearby*30)
        ctx.beginPath(); ctx.arc(a.x*SCALE, a.y*SCALE, 4, 0, Math.PI*2)
        ctx.fillStyle = `rgb(${r2},${g2},${b2})`; ctx.fill()
      }

      animRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="sim-preview-frame">
      <div className="sim-preview-bar">
        <div className="dot dot-red" /><div className="dot dot-yellow" /><div className="dot dot-green" />
        <span className="sim-preview-label">ghostcrowd — café layout · 40 agents</span>
      </div>
      <div className="sim-canvas-wrap">
        <canvas ref={canvasRef} width={820} height={320} style={{ width: '100%', display: 'block' }} />
        <div className="sim-overlay-label">LIVE SIMULATION PREVIEW</div>
      </div>
    </div>
  )
}

export default function Landing() {
  const plans = [
    {
      tier: 'Free', price: '$0', sub: '',
      desc: 'For individuals exploring their space layout.',
      features: ['1 floor plan', 'Up to 50 agents', 'Basic heat map', 'All drawing tools', '6 templates'],
      dimmed: ['PDF export', 'Share via link', 'Unlimited plans'],
      cta: 'Get started free', ctaStyle: 'outline', featured: false,
    },
    {
      tier: 'Basic', price: '$12', sub: '/month',
      desc: 'A taste of the full experience.',
      features: ['3 floor plans', 'Up to 100 agents', 'Heat map', 'All drawing tools'],
      dimmed: ['PDF export', 'Share via link', 'Bottleneck markers'],
      cta: 'Start Basic', ctaStyle: 'outline', featured: false,
    },
    {
      tier: 'Premium', price: '$19', sub: '/month',
      desc: 'The full GhostCrowd experience.',
      features: ['Unlimited floor plans', 'Up to 500 agents', 'Heat maps + bottleneck detection', 'PDF report export', 'Share simulations via link', 'All agent types', 'Priority support'],
      dimmed: [],
      cta: 'Start Premium', ctaStyle: 'primary', featured: true,
    },
    {
      tier: 'Max', price: '$49', sub: '/month',
      desc: 'For consultants and multi-location operators.',
      features: ['Up to 2,000 agents', 'Team collaboration', 'White-label PDF reports', 'API access', 'Priority support', 'Dedicated onboarding'],
      dimmed: [],
      cta: 'Start Max', ctaStyle: 'outline', featured: false,
    },
  ]

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-logo">👻 GhostCrowd</span>
        <ul className="landing-nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#use-cases">Who it's for</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><Link to="/app" className="nav-cta">Try free →</Link></li>
        </ul>
      </nav>

      <div className="hero">
        <div className="hero-glow" /><div className="hero-glow2" />
        <div className="badge">⚡ No CAD skills required · Free to start</div>
        <h1>See how people move<br /><span className="accent">before you move a chair.</span></h1>
        <p className="hero-sub">Sketch any floor plan. Watch hundreds of simulated people flow through it. Find the bottlenecks before your customers do.</p>
        <div className="hero-buttons">
          <Link to="/app" className="btn-hero btn-primary">▶ Try it free</Link>
          <a href="#how" className="btn-hero btn-outline">See how it works</a>
        </div>
        <div className="sim-preview"><PreviewCanvas /></div>
      </div>

      <section id="how" className="section">
        <div className="section-label">How it works</div>
        <h2 className="section-title">Three steps from idea<br />to insight.</h2>
        <p className="section-sub">No 3D models. No CAD files. No engineering degree. Just draw and simulate.</p>
        <div className="steps">
          {[
            { n: '01', title: 'Sketch your space', body: 'Draw walls, place tables, mark doors. Use a template or start from scratch. Fine grid snapping supports measurements like 5.75m × 12.3m.' },
            { n: '02', title: 'Run the simulation', body: 'Set how many people and hit run. The Social Force Model — the same physics used by airports and stadiums — calculates every movement in real time.' },
            { n: '03', title: 'Read the results', body: 'See where crowds form. Toggle the heat map. Yellow markers flag exact bottleneck zones. Export a PDF report. Adjust and rerun.' },
          ].map(s => (
            <div className="step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="use-cases" className="section section-alt">
        <div className="section-label">Who it's for</div>
        <h2 className="section-title">If people move through<br />your space, this is for you.</h2>
        <div className="use-cases">
          {[
            { icon: '☕', title: 'Restaurant & Café Owners', body: '"Will this new table layout create a bottleneck near the kitchen?"' },
            { icon: '🎉', title: 'Event Planners', body: '"If I put the bar here and the stage there, where will people crowd?"' },
            { icon: '🛍', title: 'Retail Store Managers', body: '"Which shelf arrangement drives the most foot traffic past high-margin products?"' },
            { icon: '💼', title: 'Office Managers', body: '"Is this open office layout going to create dead zones or congestion?"' },
            { icon: '🎓', title: 'Teachers', body: '"Which classroom desk arrangement allows the best flow during transitions?"' },
            { icon: '🏛', title: 'Architects', body: '"Quick pedestrian check before the real CAD work starts."' },
          ].map(u => (
            <div className="use-case" key={u.title}>
              <div className="use-case-icon">{u.icon}</div>
              <h4>{u.title}</h4>
              <p>{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="section">
        <div className="section-label">Pricing</div>
        <h2 className="section-title">Starts free.<br />Scales with you.</h2>
        <p className="section-sub">Enterprise tools charge $10,000+/year. We charge $19/month.</p>
        <div className="pricing-grid">
          {plans.map(p => (
            <div className={`pricing-card ${p.featured ? 'featured' : ''}`} key={p.tier}>
              {p.featured && <div className="pricing-badge">Most popular</div>}
              <div className="pricing-tier">{p.tier}</div>
              <div className="pricing-price">{p.price}<span>{p.sub}</span></div>
              <div className="pricing-desc">{p.desc}</div>
              <ul className="pricing-features">
                {p.features.map(f => <li key={f}>{f}</li>)}
                {p.dimmed.map(f => <li key={f} className="dim">{f}</li>)}
              </ul>
              <Link to="/app" className={`pricing-btn pricing-btn-${p.ctaStyle}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <div className="cta-band">
        <h2>Your next layout decision<br />shouldn't be a guess.</h2>
        <p>Free to start. No credit card. Results in 60 seconds.</p>
        <Link to="/app" className="btn-hero btn-primary" style={{ fontSize: 16, padding: '16px 40px' }}>
          ▶ Simulate your space — free
        </Link>
      </div>

      <footer className="landing-footer">
        <div>👻 <strong>GhostCrowd</strong> · Pedestrian flow simulation for everyone</div>
        <div>Built with the Social Force Model (Helbing & Molnár, 1995)</div>
      </footer>
    </div>
  )
}
