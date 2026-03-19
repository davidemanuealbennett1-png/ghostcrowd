import numpy as np


class Wall:
    def __init__(self, x1, y1, x2, y2):
        self.p1 = np.array([x1, y1], dtype=float)
        self.p2 = np.array([x2, y2], dtype=float)

    def closest_point(self, point):
        p = np.array(point, dtype=float)
        seg = self.p2 - self.p1
        seg_len_sq = np.dot(seg, seg)
        if seg_len_sq == 0:
            return self.p1.copy()
        t = np.dot(p - self.p1, seg) / seg_len_sq
        t = np.clip(t, 0.0, 1.0)
        return self.p1 + t * seg


class Door:
    """A passable gap — agents are attracted through it."""
    def __init__(self, x1, y1, x2, y2, delay=0.0):
        self.p1 = np.array([x1, y1], dtype=float)
        self.p2 = np.array([x2, y2], dtype=float)
        self.center = (self.p1 + self.p2) / 2
        self.delay = delay  # seconds to pass through
        # Door width for proximity check
        self.width = np.linalg.norm(self.p2 - self.p1)

    def closest_point(self, point):
        p = np.array(point, dtype=float)
        seg = self.p2 - self.p1
        seg_len_sq = np.dot(seg, seg)
        if seg_len_sq == 0:
            return self.p1.copy()
        t = np.dot(p - self.p1, seg) / seg_len_sq
        t = np.clip(t, 0.0, 1.0)
        return self.p1 + t * seg

    def agent_is_in_door(self, position, threshold=0.8):
        """Check if agent is within the door zone."""
        cp = self.closest_point(position)
        return np.linalg.norm(position - cp) < threshold


class RectObstacle:
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.walls = [
            Wall(x, y, x + width, y),
            Wall(x + width, y, x + width, y + height),
            Wall(x + width, y + height, x, y + height),
            Wall(x, y + height, x, y),
        ]

    def closest_point(self, point):
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
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.walls = []
        self.doors = []
        self.obstacles = []
        self.spawn_zones = []
        self.exit_zones = []
        self._add_boundary_walls()

    def _add_boundary_walls(self):
        w, h = self.width, self.height
        self.walls.append(Wall(0, 0, w, 0))
        self.walls.append(Wall(w, 0, w, h))
        self.walls.append(Wall(w, h, 0, h))
        self.walls.append(Wall(0, h, 0, 0))

    def add_wall(self, x1, y1, x2, y2, is_door=False, door_delay=0.0):
        if is_door:
            self.doors.append(Door(x1, y1, x2, y2, delay=door_delay))
        else:
            self.walls.append(Wall(x1, y1, x2, y2))

    def add_obstacle(self, x, y, width, height):
        self.obstacles.append(RectObstacle(x, y, width, height))

    def add_spawn_zone(self, x, y, w, h, weight=1.0):
        self.spawn_zones.append((x, y, w, h, weight))

    def add_exit_zone(self, x, y, w, h, weight=1.0):
        self.exit_zones.append((x, y, w, h, weight))

    def random_spawn_position(self):
        if not self.spawn_zones:
            return np.array([
                np.random.uniform(0.5, self.width * 0.1),
                np.random.uniform(0.5, self.height - 0.5)
            ])
        weights = np.array([z[4] for z in self.spawn_zones], dtype=float)
        weights /= weights.sum()
        idx = np.random.choice(len(self.spawn_zones), p=weights)
        x, y, w, h, _ = self.spawn_zones[idx]
        return np.array([np.random.uniform(x, x + w), np.random.uniform(y, y + h)])

    def random_exit_position(self):
        if not self.exit_zones:
            return np.array([
                np.random.uniform(self.width * 0.9, self.width - 0.5),
                np.random.uniform(0.5, self.height - 0.5)
            ])
        weights = np.array([z[4] for z in self.exit_zones], dtype=float)
        weights /= weights.sum()
        idx = np.random.choice(len(self.exit_zones), p=weights)
        x, y, w, h, _ = self.exit_zones[idx]
        return np.array([np.random.uniform(x, x + w), np.random.uniform(y, y + h)])

    def get_all_walls(self):
        all_walls = list(self.walls)
        for obs in self.obstacles:
            all_walls.extend(obs.walls)
        return all_walls

    def get_nearest_door(self, position, max_dist=3.0):
        """Return nearest door if agent is close enough to be attracted through it."""
        best = None
        best_dist = max_dist
        for door in self.doors:
            d = np.linalg.norm(position - door.center)
            if d < best_dist:
                best_dist = d
                best = door
        return best

    def to_dict(self):
        return {
            "width": self.width,
            "height": self.height,
            "walls": [{"x1": w.p1[0], "y1": w.p1[1], "x2": w.p2[0], "y2": w.p2[1]} for w in self.walls],
            "obstacles": [{"x": o.x, "y": o.y, "width": o.width, "height": o.height} for o in self.obstacles],
            "spawn_zones": [{"x": z[0], "y": z[1], "w": z[2], "h": z[3], "weight": z[4]} for z in self.spawn_zones],
            "exit_zones": [{"x": z[0], "y": z[1], "w": z[2], "h": z[3], "weight": z[4]} for z in self.exit_zones],
            "doors": [{"x1": d.p1[0], "y1": d.p1[1], "x2": d.p2[0], "y2": d.p2[1], "delay": d.delay} for d in self.doors],
        }
