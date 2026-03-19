import numpy as np
from .agent import Agent
from .environment import Environment


class SimulationEngine:
    def __init__(self, environment: Environment, dt: float = 0.05, panic: bool = False):
        self.env = environment
        self.dt = dt
        self.agents = []
        self.time = 0.0
        self.panic = panic
        self._all_walls = environment.get_all_walls()

    def spawn_agents(self, count: int):
        for i in range(count):
            pos = self.env.random_spawn_position()
            dest = self.env.random_exit_position()
            agent = Agent(
                agent_id=len(self.agents),
                position=pos,
                destination=dest,
                agent_type="customer",
                panic=self.panic,
            )
            self.agents.append(agent)

    def set_panic(self, panic: bool):
        self.panic = panic
        for agent in self.agents:
            if not agent.reached_destination:
                agent.set_panic(panic)
                agent.destination = self.env.random_exit_position()

    def _wall_force(self, agent):
        """Repulsion from all walls and obstacles."""
        total = np.zeros(2)
        A = 2000.0
        B = 0.08
        for wall in self._all_walls:
            cp = wall.closest_point(agent.position)
            diff = agent.position - cp
            dist = np.linalg.norm(diff)
            if dist < 1e-6:
                diff = np.array([0.0, 0.01])
                dist = 0.01
            overlap = agent.radius - dist
            force_mag = A * np.exp(-dist / B)
            if overlap > 0:
                force_mag += 50000 * overlap
            total += force_mag * (diff / dist)
        return total

    def _agent_force(self, agent, others):
        """Repulsion from other agents."""
        total = np.zeros(2)
        A = 2000.0
        B = 0.08
        for other in others:
            if other.id == agent.id or other.reached_destination:
                continue
            diff = agent.position - other.position
            dist = np.linalg.norm(diff)
            if dist < 1e-6:
                diff = np.array([np.random.uniform(-0.1, 0.1), np.random.uniform(-0.1, 0.1)])
                dist = np.linalg.norm(diff)
            overlap = agent.radius + other.radius - dist
            force_mag = A * np.exp(-dist / B)
            if overlap > 0:
                force_mag += 50000 * overlap
            total += force_mag * (diff / dist)
        return total

    def _desired_force(self, agent):
        """Force toward destination (or toward nearest door if one is nearby)."""
        # Check if there's a door between agent and destination
        nearest_door = self.env.get_nearest_door(agent.position, max_dist=4.0)

        if nearest_door is not None and not nearest_door.agent_is_in_door(agent.position, threshold=0.5):
            # Agent is near a door but not in it yet — attract toward door center
            target = nearest_door.center
        else:
            target = agent.destination

        direction = target - agent.position
        dist = np.linalg.norm(direction)
        if dist < 0.01:
            return np.zeros(2)

        desired_velocity = (direction / dist) * agent.desired_speed
        relaxation_time = 0.5
        return agent.mass * (desired_velocity - agent.velocity) / relaxation_time

    def _door_check(self, agent):
        """Check if agent is entering a door and apply delay."""
        for door in self.env.doors:
            if door.agent_is_in_door(agent.position, threshold=0.6):
                agent.enter_door(door.delay)
                break

    def step(self):
        active = [a for a in self.agents if not a.reached_destination]

        for agent in active:
            # Check door entry
            self._door_check(agent)

            # Compute forces
            f_desired = self._desired_force(agent)
            f_wall = self._wall_force(agent)
            f_agent = self._agent_force(agent, active)

            # If agent is in door delay, dampen movement heavily
            if agent.in_door:
                total_force = f_desired * 0.05 + f_wall * 0.3
            else:
                total_force = f_desired + f_wall + f_agent

            agent.update(total_force, self.dt)

            # Clamp to environment bounds
            r = agent.radius
            agent.position[0] = np.clip(agent.position[0], r, self.env.width - r)
            agent.position[1] = np.clip(agent.position[1], r, self.env.height - r)

        self.time += self.dt

    def get_state(self):
        active = [a for a in self.agents if not a.reached_destination]
        return {
            "time": round(self.time, 2),
            "agents": [a.to_dict() for a in self.agents],
            "active_count": len(active),
            "total_count": len(self.agents),
            "panic": self.panic,
        }
