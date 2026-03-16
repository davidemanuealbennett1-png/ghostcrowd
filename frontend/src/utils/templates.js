export const TEMPLATES = [
  {
    id: "empty",
    name: "Empty Room",
    icon: "⬜",
    description: "Blank 20×15m room",
    floorPlan: {
      width: 20,
      height: 15,
      walls: [],
      obstacles: [],
      spawn_zones: [{ x: 0.5, y: 1, w: 2, h: 13 }],
      exit_zones: [{ x: 17.5, y: 1, w: 2, h: 13 }],
    },
  },
  {
    id: "cafe",
    name: "Café",
    icon: "☕",
    description: "Tables with aisle, counter blocking rear",
    floorPlan: {
      width: 20,
      height: 15,
      walls: [
        // Counter along back wall
        { x1: 14, y1: 1, x2: 14, y2: 6 },
        { x1: 14, y1: 9, x2: 14, y2: 14 },
      ],
      obstacles: [
        // Tables arranged in grid
        { x: 3, y: 2, width: 2, height: 1.5 },
        { x: 3, y: 5, width: 2, height: 1.5 },
        { x: 3, y: 8, width: 2, height: 1.5 },
        { x: 3, y: 11, width: 2, height: 1.5 },
        { x: 7, y: 2, width: 2, height: 1.5 },
        { x: 7, y: 5, width: 2, height: 1.5 },
        { x: 7, y: 8, width: 2, height: 1.5 },
        { x: 7, y: 11, width: 2, height: 1.5 },
        { x: 11, y: 2, width: 2, height: 1.5 },
        { x: 11, y: 5, width: 2, height: 1.5 },
        { x: 11, y: 8, width: 2, height: 1.5 },
        { x: 11, y: 11, width: 2, height: 1.5 },
      ],
      spawn_zones: [{ x: 0.5, y: 1, w: 1.5, h: 13 }],
      exit_zones: [{ x: 15, y: 6, w: 4, h: 3 }],
    },
  },
  {
    id: "corridor",
    name: "Bottleneck",
    icon: "🚪",
    description: "Classic narrow doorway stress test",
    floorPlan: {
      width: 30,
      height: 12,
      walls: [
        { x1: 0, y1: 6, x2: 12, y2: 6 },
        { x1: 14, y1: 6, x2: 30, y2: 6 },
      ],
      obstacles: [],
      spawn_zones: [{ x: 0.5, y: 0.5, w: 4, h: 5 }],
      exit_zones: [{ x: 25, y: 0.5, w: 4, h: 11 }],
    },
  },
  {
    id: "retail",
    name: "Retail Store",
    icon: "🛍",
    description: "Shelving aisles with checkout at exit",
    floorPlan: {
      width: 24,
      height: 18,
      walls: [],
      obstacles: [
        // Shelving units (tall rectangles)
        { x: 4, y: 2, width: 1, height: 6 },
        { x: 4, y: 10, width: 1, height: 6 },
        { x: 8, y: 2, width: 1, height: 6 },
        { x: 8, y: 10, width: 1, height: 6 },
        { x: 12, y: 2, width: 1, height: 6 },
        { x: 12, y: 10, width: 1, height: 6 },
        { x: 16, y: 2, width: 1, height: 6 },
        { x: 16, y: 10, width: 1, height: 6 },
        // Checkout counter
        { x: 19, y: 7, width: 3, height: 4 },
      ],
      spawn_zones: [{ x: 0.5, y: 1, w: 2, h: 16 }],
      exit_zones: [{ x: 21, y: 1, w: 2, h: 5.5 }, { x: 21, y: 11.5, w: 2, h: 5.5 }],
    },
  },
  {
    id: "event",
    name: "Event Hall",
    icon: "🎉",
    description: "Stage + bar — where will crowds form?",
    floorPlan: {
      width: 32,
      height: 20,
      walls: [],
      obstacles: [
        // Stage
        { x: 12, y: 1, width: 8, height: 4 },
        // Bar counter
        { x: 1, y: 8, width: 5, height: 1.5 },
        // Round tables (approximated as squares)
        { x: 8, y: 8, width: 2, height: 2 },
        { x: 12, y: 8, width: 2, height: 2 },
        { x: 16, y: 8, width: 2, height: 2 },
        { x: 8, y: 13, width: 2, height: 2 },
        { x: 12, y: 13, width: 2, height: 2 },
        { x: 16, y: 13, width: 2, height: 2 },
        { x: 20, y: 8, width: 2, height: 2 },
        { x: 20, y: 13, width: 2, height: 2 },
        // Photo booth / activity area
        { x: 24, y: 14, width: 4, height: 4 },
      ],
      spawn_zones: [{ x: 0.5, y: 0.5, w: 3, h: 19 }],
      exit_zones: [{ x: 28, y: 8, w: 3, h: 4 }],
    },
  },
  {
    id: "classroom",
    name: "Classroom",
    icon: "🏫",
    description: "Desk rows — who gets out fastest?",
    floorPlan: {
      width: 18,
      height: 14,
      walls: [],
      obstacles: [
        // Teacher desk
        { x: 7, y: 1, width: 4, height: 1.5 },
        // Student desks in rows
        { x: 1, y: 4, width: 1.5, height: 1 },
        { x: 4, y: 4, width: 1.5, height: 1 },
        { x: 7, y: 4, width: 1.5, height: 1 },
        { x: 10, y: 4, width: 1.5, height: 1 },
        { x: 13, y: 4, width: 1.5, height: 1 },
        { x: 1, y: 7, width: 1.5, height: 1 },
        { x: 4, y: 7, width: 1.5, height: 1 },
        { x: 7, y: 7, width: 1.5, height: 1 },
        { x: 10, y: 7, width: 1.5, height: 1 },
        { x: 13, y: 7, width: 1.5, height: 1 },
        { x: 1, y: 10, width: 1.5, height: 1 },
        { x: 4, y: 10, width: 1.5, height: 1 },
        { x: 7, y: 10, width: 1.5, height: 1 },
        { x: 10, y: 10, width: 1.5, height: 1 },
        { x: 13, y: 10, width: 1.5, height: 1 },
      ],
      spawn_zones: [{ x: 1, y: 4, w: 14, h: 8 }],
      exit_zones: [{ x: 7.5, y: 12.5, w: 3, h: 1 }],
    },
  },
]
