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
        t = np.clip(np.dot(p - self.p1, seg) / seg_len_sq, 0.0, 1.0)
        return self.p1 + t * seg

    def length(self):
        return np.linalg.norm(self.p2 - self.p1)


class Door:
    def __init__(self, x1, y1, x2, y2, delay=0.0):
        self.p1 = np.array([x1, y1], dtype=float)
        self.p2 = np.array([x2, y2], dtype=float)
        self.center = (self.p1 + self.p2) / 2
        self.delay = delay
        self.width = np.linalg.norm(self.p2 - self.p1)

    def agent_is_in_door(self, position, threshold=0.8):
        p = np.array(position, dtype=float)
        seg = self.p2 - self.p1
        seg_len_sq = np.dot(seg, seg)
        if seg_len_sq == 0:
            return np.linalg.norm(p - self.center) < threshold
        t = np.clip(np.dot(p - self.p1, seg) / seg_len_sq, 0.0, 1.0)
        cp = self.p1 + t * seg
        return np.linalg.norm(p - cp) < threshold


class RectObstacle:
    def __init__(self, x, y, width, height):
        self.x = x; self.y = y
        self.width = width; self.height = height
        self.walls = [
            Wall(x, y, x+width, y),
            Wall(x+width, y, x+width, y+height),
            Wall(x+width, y+height, x, y+height),
            Wall(x, y+height, x, y),
        ]


def _project_point_onto_segment(point, p1, p2):
    """Project point onto segment p1->p2, return (t, closest_point)."""
    seg = p2 - p1
    seg_len_sq = np.dot(seg, seg)
    if seg_len_sq == 0:
        return 0.0, p1.copy()
    t = np.clip(np.dot(point - p1, seg) / seg_len_sq, 0.0, 1.0)
    return t, p1 + t * seg


def _cut_gap_in_wall(wall, gap_center, gap_half_width):
    """
    Cut a gap in a wall at gap_center with given half-width.
    Returns list of Wall segments with the gap removed.
    If gap doesn't overlap the wall, return the wall unchanged.
    """
    p1, p2 = wall.p1, wall.p2
    seg = p2 - p1
    seg_len = np.linalg.norm(seg)
    if seg_len < 1e-6:
        return [wall]

    seg_dir = seg / seg_len

    # Project gap center onto this wall
    t_center, closest = _project_point_onto_segment(gap_center, p1, p2)
    dist_to_wall = np.linalg.norm(gap_center - closest)

    # Only cut if gap center is close to this wall
    if dist_to_wall > 1.0:
        return [wall]

    # Compute gap start and end along wall
    t_half = gap_half_width / seg_len
    t_start = max(0.0, t_center - t_half)
    t_end = min(1.0, t_center + t_half)

    # Don't cut if gap is too small or doesn't really overlap
    if t_end - t_start < 0.01:
        return [wall]

    result = []
    # Left segment
    if t_start > 0.01:
        result.append(Wall(p1[0], p1[1], (p1+t_start*seg)[0], (p1+t_start*seg)[1]))
    # Right segment
    if t_end < 0.99:
        right_start = p1 + t_end * seg
        result.append(Wall(right_start[0], right_start[1], p2[0], p2[1]))

    return result if result else [wall]


class Environment:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.walls = []
        self.doors = []
        self.obstacles = []
        self.spawn_zones = []
        self.exit_zones = []
        self._boundary_walls = []
        self._add_boundary_walls()

    def _add_boundary_walls(self):
        w, h = self.width, self.height
        self._boundary_walls = [
            Wall(0, 0, w, 0),
            Wall(w, 0, w, h),
            Wall(w, h, 0, h),
            Wall(0, h, 0, 0),
        ]
        self.walls = list(self._boundary_walls)

    def add_wall(self, x1, y1, x2, y2, is_door=False, door_delay=0.0):
        if is_door:
            door = Door(x1, y1, x2, y2, delay=door_delay)
            self.doors.append(door)
            # Cut gap in any existing wall that this door overlaps
            self._cut_door_gap(door)
        else:
            self.walls.append(Wall(x1, y1, x2, y2))

    def _cut_door_gap(self, door):
        """Remove the door gap from existing walls."""
        gap_center = door.center
        gap_half = door.width / 2 + 0.1  # small extra margin

        new_walls = []
        for wall in self.walls:
            segments = _cut_gap_in_wall(wall, gap_center, gap_half)
            new_walls.extend(segments)
        self.walls = new_walls

    def add_obstacle(self, x, y, width, height):
        self.obstacles.append(RectObstacle(x, y, width, height))

    def add_spawn_zone(self, x, y, w, h, weight=1.0):
        self.spawn_zones.append((x, y, w, h, weight))

    def add_exit_zone(self, x, y, w, h, weight=1.0):
        self.exit_zones.append((x, y, w, h, weight))

    def random_spawn_position(self):
        if not self.spawn_zones:
            return np.array([np.random.uniform(0.5, self.width*0.1), np.random.uniform(0.5, self.height-0.5)])
        weights = np.array([z[4] for z in self.spawn_zones], dtype=float)
        weights /= weights.sum()
        idx = np.random.choice(len(self.spawn_zones), p=weights)
        x, y, w, h, _ = self.spawn_zones[idx]
        return np.array([np.random.uniform(x, x+w), np.random.uniform(y, y+h)])

    def random_exit_position(self):
        if not self.exit_zones:
            return np.array([np.random.uniform(self.width*0.9, self.width-0.5), np.random.uniform(0.5, self.height-0.5)])
        weights = np.array([z[4] for z in self.exit_zones], dtype=float)
        weights /= weights.sum()
        idx = np.random.choice(len(self.exit_zones), p=weights)
        x, y, w, h, _ = self.exit_zones[idx]
        return np.array([np.random.uniform(x, x+w), np.random.uniform(y, y+h)])

    def get_all_walls(self):
        all_walls = list(self.walls)
        for obs in self.obstacles:
            all_walls.extend(obs.walls)
        return all_walls

    def get_nearest_door(self, position, max_dist=4.0):
        pos = np.array(position)
        best, best_dist = None, max_dist
        for door in self.doors:
            d = np.linalg.norm(pos - door.center)
            if d < best_dist:
                best_dist = d; best = door
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
