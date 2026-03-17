import { useState, useRef } from 'react'

export default function RoomSettings({ floorPlan, setFloorPlan, backgroundImage, setBackgroundImage, disabled }) {
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(floorPlan.width)
  const [height, setHeight] = useState(floorPlan.height)
  const fileRef = useRef(null)

  const applySize = () => {
    const w = Math.max(5, Math.min(50, Number(width)))
    const h = Math.max(5, Math.min(40, Number(height)))
    setFloorPlan(fp => ({ ...fp, width: w, height: h }))
    setOpen(false)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setBackgroundImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setBackgroundImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <button
        className={`tool-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        title="Room settings"
      >
        ⚙️
      </button>
      <div className="tool-label">Room</div>

      {open && (
        <div style={{
          position: 'absolute',
          left: '56px',
          top: 0,
          background: '#1a1d2e',
          border: '1px solid #2d3148',
          borderRadius: 8,
          padding: 16,
          width: 220,
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            Room Settings
          </div>

          {/* Room size */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Room size (meters)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                value={width}
                onChange={e => setWidth(e.target.value)}
                min={5} max={50}
                style={{ width: 60, padding: '4px 8px', background: '#0f1117', border: '1px solid #2d3148', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }}
              />
              <span style={{ color: '#64748b', fontSize: 12 }}>×</span>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(e.target.value)}
                min={5} max={40}
                style={{ width: 60, padding: '4px 8px', background: '#0f1117', border: '1px solid #2d3148', borderRadius: 6, color: '#e2e8f0', fontSize: 13 }}
              />
              <button
                onClick={applySize}
                style={{ padding: '4px 10px', background: '#6366f1', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, cursor: 'pointer' }}
              >
                Apply
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Width × Height · max 50×40m</div>
          </div>

          {/* Background image */}
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Background image</div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
              Upload a floor plan photo to trace over
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="bg-upload"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <label
                htmlFor="bg-upload"
                style={{ padding: '6px 12px', background: '#2d3148', border: '1px solid #3d4266', borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer' }}
              >
                {backgroundImage ? '🔄 Change' : '📷 Upload'}
              </label>
              {backgroundImage && (
                <button
                  onClick={clearImage}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
