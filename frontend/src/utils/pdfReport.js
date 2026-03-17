import { jsPDF } from 'jspdf'

export async function generatePDFReport({ floorPlanName, results, bottlenecks, agentTypes, agentCount, floorPlan, canvasElement }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const margin = 20
  let y = margin

  // ── Header ──
  doc.setFillColor(15, 17, 23)
  doc.rect(0, 0, W, 40, 'F')
  doc.setTextColor(167, 139, 250)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('👻 GhostCrowd', margin, 18)
  doc.setFontSize(11)
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'normal')
  doc.text('Pedestrian Flow Simulation Report', margin, 28)
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 35)
  y = 52

  // ── Floor Plan Name ──
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(floorPlanName || 'Untitled Floor Plan', margin, y)
  y += 10

  // ── Divider ──
  doc.setDrawColor(167, 139, 250)
  doc.setLineWidth(0.5)
  doc.line(margin, y, W - margin, y)
  y += 8

  // ── Simulation Parameters ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Simulation Parameters', margin, y)
  y += 7

  const params = [
    ['Room size', `${floorPlan.width}m × ${floorPlan.height}m`],
    ['Total agents', String(agentCount)],
    ['Spawn zones', String(floorPlan.spawn_zones?.length || 0)],
    ['Exit zones', String(floorPlan.exit_zones?.length || 0)],
    ['Obstacles', String(floorPlan.obstacles?.length || 0)],
    ['Custom walls', String(floorPlan.walls?.length || 0)],
  ]

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  for (const [label, value] of params) {
    doc.setTextColor(100, 116, 139)
    doc.text(label, margin, y)
    doc.setTextColor(30, 30, 30)
    doc.text(value, margin + 50, y)
    y += 6
  }
  y += 4

  // ── Agent Types ──
  if (agentTypes?.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(50, 50, 50)
    doc.text('Agent Types', margin, y)
    y += 7

    const total = agentTypes.reduce((s, t) => s + (t.proportion || 0), 0)
    for (const t of agentTypes.filter(t => t.proportion > 0)) {
      const pct = total > 0 ? Math.round((t.proportion / total) * 100) : 0
      // Color swatch
      const rgb = hexToRgb(t.color || '#a78bfa')
      doc.setFillColor(rgb[0], rgb[1], rgb[2])
      doc.roundedRect(margin, y - 3.5, 4, 4, 0.5, 0.5, 'F')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      doc.text(`${t.name}`, margin + 6, y)
      doc.setTextColor(100, 116, 139)
      doc.text(`${pct}% · ${t.speedMin}–${t.speedMax} m/s`, margin + 50, y)
      y += 6
    }
    y += 4
  }

  // ── Results ──
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, W - margin, y)
  y += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50, 50, 50)
  doc.text('Simulation Results', margin, y)
  y += 7

  if (results) {
    const exitPct = results.exit_rate_pct
    const exitColor = exitPct >= 90 ? [74, 222, 128] : exitPct >= 60 ? [251, 191, 36] : [248, 113, 113]
    const bottleneckColor = results.bottleneck_count === 0 ? [74, 222, 128] : results.bottleneck_count <= 3 ? [251, 191, 36] : [248, 113, 113]

    const resultRows = [
      ['Total agents', String(results.total_agents), [30,30,30]],
      ['Agents exited', String(results.agents_exited), exitColor],
      ['Exit rate', `${results.exit_rate_pct}%`, exitColor],
      ['Average speed', `${results.avg_speed} m/s`, [30,30,30]],
      ['Bottleneck zones', String(results.bottleneck_count), bottleneckColor],
    ]

    doc.setFontSize(10)
    for (const [label, value, color] of resultRows) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(label, margin, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(color[0], color[1], color[2])
      doc.text(value, margin + 50, y)
      y += 6
    }
    y += 4

    // Verdict
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    if (exitPct >= 90) {
      doc.setTextColor(74, 222, 128)
      doc.text('✓ Good flow — most agents reached the exit.', margin, y)
    } else if (exitPct >= 60) {
      doc.setTextColor(251, 191, 36)
      doc.text('⚠ Some agents got stuck. Check bottleneck zones.', margin, y)
    } else {
      doc.setTextColor(248, 113, 113)
      doc.text('✗ Poor flow — consider widening exits or removing obstacles.', margin, y)
    }
    y += 10
  }

  // ── Bottleneck Details ──
  if (bottlenecks?.length > 0) {
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, W - margin, y)
    y += 8

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(50, 50, 50)
    doc.text('Bottleneck Zones', margin, y)
    y += 7

    const top = [...bottlenecks].sort((a, b) => b.intensity - a.intensity).slice(0, 5)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (let i = 0; i < top.length; i++) {
      const b = top[i]
      const intensity = Math.round(b.intensity * 100)
      doc.setTextColor(100, 116, 139)
      doc.text(`Zone ${i + 1}`, margin, y)
      doc.setTextColor(30, 30, 30)
      doc.text(`Position: (${b.x.toFixed(1)}m, ${b.y.toFixed(1)}m)`, margin + 20, y)
      doc.setTextColor(251, 191, 36)
      doc.text(`Intensity: ${intensity}%`, margin + 90, y)
      y += 6
    }
    y += 4
  }

  // ── Heat Map Image ──
  if (canvasElement) {
    try {
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, W - margin, y)
      y += 8

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(50, 50, 50)
      doc.text('Heat Map', margin, y)
      y += 6

      const imgData = canvasElement.toDataURL('image/png')
      const imgW = W - margin * 2
      const imgH = imgW * (canvasElement.height / canvasElement.width)

      // Check if we need a new page
      if (y + imgH > H - margin) {
        doc.addPage()
        y = margin
      }

      doc.addImage(imgData, 'PNG', margin, y, imgW, imgH)
      y += imgH + 8
    } catch (e) {
      console.warn('Could not add canvas image to PDF:', e)
    }
  }

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.text('Generated by GhostCrowd · ghostcrowd.app', margin, H - 10)
    doc.text(`Page ${i} of ${pageCount}`, W - margin - 20, H - 10)
  }

  doc.save(`ghostcrowd-${(floorPlanName || 'report').toLowerCase().replace(/\s+/g, '-')}.pdf`)
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
