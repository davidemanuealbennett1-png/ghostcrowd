import numpy as np
from .agent import Agent, AGENT_TYPES
from .environment import Environment

A_SOCIAL = 2000.0
B_SOCIAL = 0.08
A_WALL = 2000.0
B_WALL = 0.08
RELAXATION_TIME = 0.5
NOISE_STRENGTH = 0.1
INTERACTION_RADIUS = 5.0

PANIC_SOCIAL_MULTIPLIER = 0.4
PANIC_NOISE_MULTIPLIER = 3.0


class SimulationEngine:
    def __init__(self, environment: Environment, dt=0.05, panic=False):
        self.env = environment
        self.dt = dt
        self.agents = []
        self.time = 0.0
        self.step_count = 0
        self.panic = panic
        self.all_walls = environment.get_all_walls()
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

    def spawn_agents(self, count, agent_type_distribution=None):
        if agent_type_distribution is None:
            agent_type_distribution = {"customer": 1.0}
        types = list(agent_type_distribution.keys())
        weights = np.array(list(agent_type_distribution.values()), dtype=float)
        weights /= weights.sum()
        for i in range(count):
            pos = self.env.random_spawn_position()
            dest = self.env.random_exit_position()
            agent_type = np.random.choice(types, p=weights)
            agent = Agent(len(self.agents), pos, dest, agent_type=agent_type, panic=self.panic)
            self.agents.append(agent)

    def set_panic(self, panic):
        self.panic = panic
        for agent in self.agents:
            if not agent.reached_destination:
                agent.set_panic(panic)
                if panic and self.env.exit_zones:
                    agent.destination = self.env.random_exit_position()

    def _get_active_arrays(self):
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
        directions = destinations - positions
        dists = np.maximum(np.linalg.norm(directions, axis=1, keepdims=True), 1e-6)
        units = directions / dists
        desired_velocities = units * desired_speeds[:, np.newaxis]
        return masses[:, np.newaxis] * (desired_velocities - velocities) / RELAXATION_TIME

    def _social_forces(self, positions, radii):
        n = len(positions)
        forces = np.zeros((n, 2))
        if n < 2:
            return forces
        diff = positions[:, np.newaxis, :] - positions[np.newaxis, :, :]
        dists = np.linalg.norm(diff, axis=2)
        mask = (dists > 1e-6) & (dists < INTERACTION_RADIUS)
        sum_radii = radii[:, np.newaxis] + radii[np.newaxis, :]
        magnitude = A_SOCIAL * np.exp((sum_radii - dists) / B_SOCIAL)
        if self.panic:
            magnitude *= PANIC_SOCIAL_MULTIPLIER
        magnitude = np.where(mask, magnitude, 0.0)
        safe_dists = np.where(dists > 1e-6, dists, 1.0)
        unit = diff / safe_dists[:, :, np.newaxis]
        return np.sum(magnitude[:, :, np.newaxis] * unit, axis=1)

    def _wall_forces(self, positions, radii):
        n = len(positions)
        forces = np.zeros((n, 2))
        if len(self._wall_p1) == 0:
            return forces
        p1, p2 = self._wall_p1, self._wall_p2
        seg = p2 - p1
        seg_len_sq = np.maximum(np.sum(seg ** 2, axis=1), 1e-10)
        pos_exp = positions[:, np.newaxis, :]
        p1_exp = p1[np.newaxis, :, :]
        seg_exp = seg[np.newaxis, :, :]
        t = np.clip(np.sum((pos_exp - p1_exp) * seg_exp, axis=2) / seg_len_sq[np.newaxis, :], 0.0, 1.0)
        closest = p1_exp + t[:, :, np.newaxis] * seg_exp
        diff = pos_exp - closest
        dists = np.linalg.norm(diff, axis=2)
        nearby = (dists > 1e-6) & (dists < 3.0)
        r_exp = radii[:, np.newaxis]
        magnitude = np.where(nearby, A_WALL * np.exp((r_exp - dists) / B_WALL), 0.0)
        safe_dists = np.where(dists > 1e-6, dists, 1.0)
        unit = diff / safe_dists[:, :, np.newaxis]
        return np.sum(magnitude[:, :, np.newaxis] * unit, axis=1)

    def step(self):
        active, positions, velocities, destinations, desired_speeds, masses, radii = self._get_active_arrays()
        if not active:
            return
        f_desired = self._desired_forces(positions, velocities, destinations, desired_speeds, masses)
        f_social = self._social_forces(positions, radii)
        f_wall = self._wall_forces(positions, radii)
        noise_strength = NOISE_STRENGTH * (PANIC_NOISE_MULTIPLIER if self.panic else 1.0)
        angles = np.random.uniform(0, 2 * np.pi, len(active))
        f_noise = noise_strength * np.stack([np.cos(angles), np.sin(angles)], axis=1)
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
            "panic": self.panic,
        }
