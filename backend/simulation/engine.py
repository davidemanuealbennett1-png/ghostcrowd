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
        total = np.zeros(2)
        A, B = 2000.0, 0.08
        for wall in self._all_walls:
            cp = wall.closest_point(agent.position)
            diff = agent.position - cp
            dist = np.linalg.norm(diff)
            if dist < 1e-6:
                diff = np.array([0.0, 0.01]); dist = 0.01
            overlap = agent.radius - dist
            force_mag = A * np.exp(-dist / B)
            if overlap > 0:
                force_mag += 50000 * overlap
            total += force_mag * (diff / dist)
        return total

    def _agent_force(self, agent, others):
        total = np.zeros(2)
        A, B = 2000.0, 0.08
        for other in others:
            if other.id == agent.id or other.reached_destination:
                continue
            diff = agent.position - other.position
            dist = np.linalg.norm(diff)
            if dist < 1e-6:
                diff = np.array([np.random.uniform(-0.1,0.1), np.random.uniform(-0.1,0.1)])
                dist = np.linalg.norm(diff)
            overlap = agent.radius + other.radius - dist
            force_mag = A * np.exp(-dist / B)
            if overlap > 0:
                force_mag += 50000 * overlap
            total += force_mag * (diff / dist)
        return total

    def _desired_force(self, agent):
        direction = agent.destination - agent.position
        dist = np.linalg.norm(direction)
        if dist < 0.01:
            return np.zeros(2)
        desired_velocity = (direction / dist) * agent.desired_speed
        return agent.mass * (desired_velocity - agent.velocity) / 0.5

    def _check_door_zones(self, agent):
        """
        Check if agent is physically inside any door zone.
        Triggers delay for any agent passing through — regardless of approach angle.
        Uses a cooldown so the same door doesn't re-trigger immediately.
        """
        if agent.in_door:
            return  # already waiting

        if not hasattr(agent, '_door_cooldown'):
            agent._door_cooldown = {}

        for door in self.env.doors:
            door_id = id(door)
            # Cooldown: don't re-trigger same door for 5 seconds after passing through
            cooldown_until = agent._door_cooldown.get(door_id, 0)
            if self.time < cooldown_until:
                continue

            if door.agent_is_in_door(agent.position, threshold=0.5):
                if door.delay > 0:
                    agent.enter_door(door.delay)
                    # Set cooldown so agent doesn't re-trigger on the way out
                    agent._door_cooldown[door_id] = self.time + door.delay + 1.0
                else:
                    # 0 delay — just set cooldown so we don't keep checking
                    agent._door_cooldown[door_id] = self.time + 2.0
                break

    def step(self):
        active = [a for a in self.agents if not a.reached_destination]

        for agent in active:
            # Check if agent is in a door zone
            self._check_door_zones(agent)

            f_desired = self._desired_force(agent)
            f_wall = self._wall_force(agent)
            f_agent = self._agent_force(agent, active)

            if agent.in_door:
                # Near-stop during door delay
                total_force = f_desired * 0.05 + f_wall * 0.3
            else:
                total_force = f_desired + f_wall + f_agent

            agent.update(total_force, self.dt)

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
