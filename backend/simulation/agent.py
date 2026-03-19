import numpy as np

AGENT_TYPES = {
    "customer": {"speed_range": (1.0, 1.5), "radius": 0.3, "mass": 80.0, "color": [167,139,250], "panic_speed_multiplier": 2.5},
    "staff":    {"speed_range": (1.4, 1.8), "radius": 0.3, "mass": 75.0, "color": [52,211,153],  "panic_speed_multiplier": 1.5},
    "child":    {"speed_range": (0.7, 1.0), "radius": 0.2, "mass": 40.0, "color": [251,191,36],  "panic_speed_multiplier": 2.0},
    "elderly":  {"speed_range": (0.5, 0.8), "radius": 0.3, "mass": 70.0, "color": [148,163,184], "panic_speed_multiplier": 1.2},
}


class Agent:
    def __init__(self, agent_id, position, destination, agent_type="customer", panic=False):
        self.id = agent_id
        self.position = np.array(position, dtype=float)
        self.destination = np.array(destination, dtype=float)
        self.agent_type = agent_type
        self.panic = panic

        type_cfg = AGENT_TYPES.get(agent_type, AGENT_TYPES["customer"])
        base_speed = np.random.uniform(*type_cfg["speed_range"])
        if panic:
            base_speed *= type_cfg["panic_speed_multiplier"]

        self.desired_speed = base_speed
        self.base_desired_speed = base_speed
        self.velocity = np.zeros(2)
        self.radius = type_cfg["radius"]
        self.mass = type_cfg["mass"]
        self.color = type_cfg["color"]
        self.reached_destination = False

        # Door state
        self.door_delay_remaining = 0.0
        self.in_door = False

        # Waypoints
        self.waypoints = []
        self.current_waypoint_idx = 0

        direction = self.destination - self.position
        dist = np.linalg.norm(direction)
        if dist > 0:
            self.velocity = (direction / dist) * self.desired_speed * 0.1

    def set_panic(self, panic):
        if self.panic == panic:
            return
        self.panic = panic
        type_cfg = AGENT_TYPES.get(self.agent_type, AGENT_TYPES["customer"])
        base_speed = np.random.uniform(*type_cfg["speed_range"])
        if panic:
            base_speed *= type_cfg["panic_speed_multiplier"]
        self.desired_speed = base_speed
        self.base_desired_speed = base_speed

    def enter_door(self, delay_seconds):
        """Called when agent reaches a door waypoint."""
        if self.in_door:
            return  # already processing a door
        if delay_seconds <= 0:
            # No delay — pass straight through
            self.in_door = False
            self.door_delay_remaining = 0.0
        else:
            self.in_door = True
            self.door_delay_remaining = float(delay_seconds)
            self.desired_speed = 0.05  # near-stop

    def update(self, force, dt):
        # Handle door delay countdown
        if self.in_door:
            self.door_delay_remaining -= dt
            if self.door_delay_remaining <= 0:
                self.in_door = False
                self.door_delay_remaining = 0.0
                self.desired_speed = self.base_desired_speed  # restore full speed

        acceleration = force / self.mass
        self.velocity += acceleration * dt
        speed = np.linalg.norm(self.velocity)
        max_speed = self.desired_speed * 2.0
        if speed > max_speed:
            self.velocity = (self.velocity / speed) * max_speed
        self.position += self.velocity * dt

        dist_to_dest = np.linalg.norm(self.destination - self.position)
        if dist_to_dest < 0.5:
            self.reached_destination = True

    def to_dict(self):
        return {
            "id": self.id,
            "x": float(self.position[0]),
            "y": float(self.position[1]),
            "vx": float(self.velocity[0]),
            "vy": float(self.velocity[1]),
            "reached": self.reached_destination,
            "type": self.agent_type,
            "color": self.color,
            "panic": self.panic,
            "in_door": self.in_door,
        }
