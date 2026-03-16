import numpy as np
from .agent import Agent
from .environment import Environment


# Social Force Model parameters (Helbing & Molnar 1995)
A_SOCIAL = 2000.0
B_SOCIAL = 0.08
A_WALL = 2000.0
B_WALL = 0.08
RELAXATION_TIME = 0.5
NOISE_STRENGTH = 0.1
INTERACTION_RADIUS = 5.0


class SimulationEngine:
    def __init__(self, environment: Environment, dt=0.05):
        self.env = environment
        self.dt = dt
        self.agents = []
        self.time = 0.0
        self.step_count = 0
        self.all_walls = environment.get_all_walls()

        # Precompute wall segments as numpy arrays for vectorized math
        self._wall_p1 = None
        self._wall_p2 = None
        self._precompute_walls()

    def _precompute_walls(self):
        walls = self.all_walls
        if not walls:
            self._wall_p1 = np.zeros((0, 2))
            self._wall_p2 = np.zeros((0, 2))
            return
        self._wall_p1 = np.array([w.p1 for w in walls], dtype=float)
        self._wall_p2 = np.array([w.p2 for w in walls], dtype=float)

    def spawn_agents(self, count):
        for i in range(count):
            pos = self.env.random_spawn_position()
            dest = self.env.random_exit_position()
            agent = Agent(i, pos, dest)
            self.agents.append(agent)

    def _get_active_arrays(self):
        """Extract numpy arrays for all active agents."""
        active = [a for a in self.agents if not a.reached_destination]
        if not active:
            return active, None, None, None, None, None, None
        positions = np.array([a.position for a in active])
        velocities = np.array([a.velocity for a in active])
        destinations = np.array([a.destination for a in active])
        desired_speeds = np.array([a.desired_speed for a in active])
        masses = np.array([a.mass for a in active])
        radii = np.array([a.radius for a in active])
        return active, positions, velocities, destinations, desired_speeds, masses, radii

    def _desired_forces(self, positions, velocities, destinations, desired_speeds, masses):
        """Vectorized desired force for all agents."""
        directions = destinations - positions
        dists = np.linalg.norm(directions, axis=1, keepdims=True)
        dists = np.maximum(dists, 1e-6)
        units = directions / dists
        desired_velocities = units * desired_speeds[:, np.newaxis]
        forces = masses[:, np.newaxis] * (desired_velocities - velocities) / RELAXATION_TIME
        return forces

    def _social_forces(self, positions, radii):
        """Vectorized social repulsion between all agent pairs."""
        n = len(positions)
        forces = np.zeros((n, 2))
        if n < 2:
            return forces

        diff = positions[:, np.newaxis, :] - positions[np.newaxis, :, :]
        dists = np.linalg.norm(diff, axis=2)

        mask = (dists > 1e-6) & (dists < INTERACTION_RADIUS)
        sum_radii = radii[:, np.newaxis] + radii[np.newaxis, :]
        magnitude = A_SOCIAL * np.exp((sum_radii - dists) / B_SOCIAL)
        magnitude = np.where(mask, magnitude, 0.0)

        safe_dists = np.where(dists > 1e-6, dists, 1.0)
        unit = diff / safe_dists[:, :, np.newaxis]
        forces = np.sum(magnitude[:, :, np.newaxis] * unit, axis=1)
        return forces

    def _wall_forces(self, positions, radii):
        """Vectorized wall repulsion for all agents."""
        n = len(positions)
        forces = np.zeros((n, 2))

        if len(self._wall_p1) == 0:
            return forces

        p1 = self._wall_p1
        p2 = self._wall_p2
        seg = p2 - p1
        seg_len_sq = np.maximum(np.sum(seg ** 2, axis=1), 1e-10)

        pos_exp = positions[:, np.newaxis, :]
        p1_exp = p1[np.newaxis, :, :]
        seg_exp = seg[np.newaxis, :, :]

        t = np.sum((pos_exp - p1_exp) * seg_exp, axis=2) / seg_len_sq[np.newaxis, :]
        t = np.clip(t, 0.0, 1.0)

        closest = p1_exp + t[:, :, np.newaxis] * seg_exp
        diff = pos_exp - closest
        dists = np.linalg.norm(diff, axis=2)

        nearby = (dists > 1e-6) & (dists < 3.0)
        r_exp = radii[:, np.newaxis]
        magnitude = A_WALL * np.exp((r_exp - dists) / B_WALL)
        magnitude = np.where(nearby, magnitude, 0.0)

        safe_dists = np.where(dists > 1e-6, dists, 1.0)
        unit = diff / safe_dists[:, :, np.newaxis]
        forces = np.sum(magnitude[:, :, np.newaxis] * unit, axis=1)
        return forces

    def step(self):
        """Advance simulation by one timestep (fully vectorized)."""
        active, positions, velocities, destinations, desired_speeds, masses, radii = \
            self._get_active_arrays()

        if not active:
            return

        f_desired = self._desired_forces(positions, velocities, destinations, desired_speeds, masses)
        f_social = self._social_forces(positions, radii)
        f_wall = self._wall_forces(positions, radii)

        angles = np.random.uniform(0, 2 * np.pi, len(active))
        f_noise = NOISE_STRENGTH * np.stack([np.cos(angles), np.sin(angles)], axis=1)

        total_forces = f_desired + f_social + f_wall + f_noise

        for i, agent in enumerate(active):
            agent.update(total_forces[i], self.dt)

        self.time += self.dt
        self.step_count += 1

    def run(self, max_steps=2000):
        for _ in range(max_steps):
            self.step()
            if all(a.reached_destination for a in self.agents):
                break

    def get_state(self):
        return {
            "time": round(self.time, 3),
            "step": self.step_count,
            "agents": [a.to_dict() for a in self.agents],
            "active_count": sum(1 for a in self.agents if not a.reached_destination),
            "total_count": len(self.agents),
        }
