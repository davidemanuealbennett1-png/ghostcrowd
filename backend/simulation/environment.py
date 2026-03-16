import numpy as np


class Wall:
    """A line segment wall."""
    def __init__(self, x1, y1, x2, y2):
        self.p1 = np.array([x1, y1], dtype=float)
        self.p2 = np.array([x2, y2], dtype=float)

    def closest_point(self, point):
        """Return the closest point on this wall segment to a given point."""
        p = np.array(point, dtype=float)
        seg = self.p2 - self.p1
        seg_len_sq = np.dot(seg, seg)
        if seg_len_sq == 0:
            return self.p1.copy()
        t = np.dot(p - self.p1, seg) / seg_len_sq
        t = np.clip(t, 0.0, 1.0)
        return self.p1 + t * seg


class RectObstacle:
    """A rectangular obstacle (furniture, table, etc.)."""
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        # Build 4 walls from the rectangle
        self.walls = [
            Wall(x, y, x + width, y),
            Wall(x + width, y, x + width, y + height),
            Wall(x + width, y + height, x, y + height),
            Wall(x, y + height, x, y),
        ]

    def closest_point(self, point):
        """Return the closest point on any edge of this rectangle."""
        best = None
        best_dist = float('inf')
        for wall in self.walls:
            cp = wall.closest_point(point)
            d = np.linalg.norm(np.array(point) - cp)
            if d < best_dist:
                best_dist = d
                best = cp
        return best


class Environment:
    """Holds all walls, obstacles, spawn zones, and exit zones."""

    def __init__(self, width, height):
        self.width = width    # meters
        self.height = height  # meters
        self.walls = []
        self.obstacles = []
        self.spawn_zones = []   # list of (x, y, w, h) rects
        self.exit_zones = []    # list of (x, y, w, h) rects

        # Add bounding box walls
        self._add_boundary_walls()

    def _add_boundary_walls(self):
        w, h = self.width, self.height
        self.walls.append(Wall(0, 0, w, 0))       # bottom
        self.walls.append(Wall(w, 0, w, h))       # right
        self.walls.append(Wall(w, h, 0, h))       # top
        self.walls.append(Wall(0, h, 0, 0))       # left

    def add_wall(self, x1, y1, x2, y2):
        self.walls.append(Wall(x1, y1, x2, y2))

    def add_obstacle(self, x, y, width, height):
        self.obstacles.append(RectObstacle(x, y, width, height))

    def add_spawn_zone(self, x, y, w, h):
        self.spawn_zones.append((x, y, w, h))

    def add_exit_zone(self, x, y, w, h):
        self.exit_zones.append((x, y, w, h))

    def random_spawn_position(self):
        """Pick a random position inside a random spawn zone."""
        if not self.spawn_zones:
            # Default: spawn anywhere on left 10% of space
            return np.array([
                np.random.uniform(0.5, self.width * 0.1),
                np.random.uniform(0.5, self.height - 0.5)
            ])
        zone = self.spawn_zones[np.random.randint(len(self.spawn_zones))]
        x, y, w, h = zone
        return np.array([
            np.random.uniform(x, x + w),
            np.random.uniform(y, y + h)
        ])

    def random_exit_position(self):
        """Pick a random position inside a random exit zone."""
        if not self.exit_zones:
            # Default: exit on right 10% of space
            return np.array([
                np.random.uniform(self.width * 0.9, self.width - 0.5),
                np.random.uniform(0.5, self.height - 0.5)
            ])
        zone = self.exit_zones[np.random.randint(len(self.exit_zones))]
        x, y, w, h = zone
        return np.array([
            np.random.uniform(x, x + w),
            np.random.uniform(y, y + h)
        ])

    def get_all_walls(self):
        """Return all walls including obstacle walls."""
        all_walls = list(self.walls)
        for obs in self.obstacles:
            all_walls.extend(obs.walls)
        return all_walls

    def to_dict(self):
        return {
            "width": self.width,
            "height": self.height,
            "walls": [
                {"x1": w.p1[0], "y1": w.p1[1], "x2": w.p2[0], "y2": w.p2[1]}
                for w in self.walls
            ],
            "obstacles": [
                {"x": o.x, "y": o.y, "width": o.width, "height": o.height}
                for o in self.obstacles
            ],
            "spawn_zones": [
                {"x": z[0], "y": z[1], "w": z[2], "h": z[3]}
                for z in self.spawn_zones
            ],
            "exit_zones": [
                {"x": z[0], "y": z[1], "w": z[2], "h": z[3]}
                for z in self.exit_zones
            ],
        }
