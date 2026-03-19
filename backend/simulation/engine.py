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
            agent.waypoints = self._build_waypoints(pos, dest)
            agent.current_waypoint_idx = 0
            self.agents.append(agent)

    def _build_waypoints(self, start, destination):
        """
        Waypoints: navigate through each door center in order, then reach exit.
        """
        waypoints = []
        if self.env.doors:
            doors_sorted = sorted(self.env.doors, key=lambda d: np.linalg.norm(np.array(start) - d.center))
            for door in doors_sorted:
                waypoints.append(('door', door.center.copy(), door))
        waypoints.append(('exit', np.array(destination, dtype=float), None))
        return waypoints

    def set_panic(self, panic: bool):
        self.panic = panic
        for agent in self.agents:
            if not agent.reached_destination:
                agent.set_panic(panic)
                new_dest = self.env.random_exit_position()
                agent.destination = new_dest
                agent.waypoints = self._build_waypoints(agent.position, new_dest)
                agent.current_waypoint_idx = 0

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

    def _get_current_target(self, agent):
        idx = getattr(agent, 'current_waypoint_idx', 0)
        waypoints = getattr(agent, 'waypoints', [])
        if not waypoints or idx >= len(waypoints):
            return agent.destination
        _, target_pos, _ = waypoints[idx]
        return target_pos

    def _advance_waypoint(self, agent):
        waypoints = getattr(agent, 'waypoints', [])
        idx = getattr(agent, 'current_waypoint_idx', 0)
        if not waypoints or idx >= len(waypoints):
            return
        wtype, target_pos, door_obj = waypoints[idx]
        dist = np.linalg.norm(agent.position - target_pos)
        threshold = 0.8 if wtype == 'door' else 0.5
        if dist < threshold:
            if wtype == 'door' and door_obj is not None:
                # Pass actual delay from door object
                print(f"[door] agent {agent.id} entering door with delay={door_obj.delay}s")
                agent.enter_door(door_obj.delay)
            agent.current_waypoint_idx = idx + 1

    def _desired_force(self, agent):
        target = self._get_current_target(agent)
        direction = target - agent.position
        dist = np.linalg.norm(direction)
        if dist < 0.01:
            return np.zeros(2)
        desired_velocity = (direction / dist) * agent.desired_speed
        return agent.mass * (desired_velocity - agent.velocity) / 0.5

    def step(self):
        active = [a for a in self.agents if not a.reached_destination]
        for agent in active:
            # Skip waypoint advance if currently waiting in door
            if not agent.in_door:
                self._advance_waypoint(agent)

            f_desired = self._desired_force(agent)
            f_wall = self._wall_force(agent)
            f_agent = self._agent_force(agent, active)

            if agent.in_door:
                total_force = f_desired * 0.05 + f_wall * 0.3
            else:
                total_force = f_desired + f_wall + f_agent

            agent.update(total_force, self.dt)

            r = agent.radius
            agent.position[0] = np.clip(agent.position[0], r, self.env.width - r)
            agent.position[1] = np.clip(agent.position[1], r, self.env.height - r)

            if np.linalg.norm(agent.position - agent.destination) < 0.5:
                agent.reached_destination = True

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
