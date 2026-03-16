import numpy as np


class Agent:
    """A single pedestrian in the simulation."""

    def __init__(self, agent_id, position, destination, desired_speed=None):
        self.id = agent_id
        self.position = np.array(position, dtype=float)
        self.destination = np.array(destination, dtype=float)
        self.desired_speed = desired_speed if desired_speed else np.random.uniform(1.2, 1.5)
        self.velocity = np.zeros(2)
        self.radius = 0.3  # meters (body size)
        self.mass = 80.0   # kg
        self.reached_destination = False

        # Give agent a small random initial velocity toward destination
        direction = self.destination - self.position
        dist = np.linalg.norm(direction)
        if dist > 0:
            self.velocity = (direction / dist) * self.desired_speed * 0.1

    def update(self, force, dt):
        """Update velocity and position given net force and timestep."""
        acceleration = force / self.mass
        self.velocity += acceleration * dt

        # Cap speed at 2x desired speed (people don't sprint forever)
        speed = np.linalg.norm(self.velocity)
        max_speed = self.desired_speed * 2.0
        if speed > max_speed:
            self.velocity = (self.velocity / speed) * max_speed

        self.position += self.velocity * dt

        # Check if reached destination
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
        }
