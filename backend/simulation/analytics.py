import numpy as np


class Analytics:
    """Collects agent position data and computes heat maps and flow metrics."""

    def __init__(self, env_width, env_height, grid_resolution=1.0):
        self.env_width = env_width
        self.env_height = env_height
        self.resolution = grid_resolution  # meters per grid cell

        cols = int(np.ceil(env_width / grid_resolution))
        rows = int(np.ceil(env_height / grid_resolution))
        self.heat_map = np.zeros((rows, cols), dtype=float)
        self.frame_count = 0

    def record_frame(self, agents):
        """Record agent positions into the heat map."""
        self.frame_count += 1
        for agent in agents:
            if agent.reached_destination:
                continue
            col = int(agent.position[0] / self.resolution)
            row = int(agent.position[1] / self.resolution)
            col = np.clip(col, 0, self.heat_map.shape[1] - 1)
            row = np.clip(row, 0, self.heat_map.shape[0] - 1)
            self.heat_map[row, col] += 1

    def get_normalized_heat_map(self):
        """Return heat map normalized to 0–1."""
        max_val = self.heat_map.max()
        if max_val == 0:
            return self.heat_map.tolist()
        return (self.heat_map / max_val).tolist()

    def get_bottlenecks(self, threshold=0.7):
        """Return grid cells where density exceeds threshold (normalized)."""
        norm = self.heat_map / (self.heat_map.max() or 1)
        bottlenecks = []
        rows, cols = np.where(norm >= threshold)
        for r, c in zip(rows, cols):
            bottlenecks.append({
                "x": float(c * self.resolution),
                "y": float(r * self.resolution),
                "intensity": float(norm[r, c]),
            })
        return bottlenecks

    def get_summary(self, agents):
        """Return summary stats after simulation."""
        finished = [a for a in agents if a.reached_destination]
        speeds = [np.linalg.norm(a.velocity) for a in agents]
        return {
            "total_agents": len(agents),
            "agents_exited": len(finished),
            "exit_rate_pct": round(100 * len(finished) / max(len(agents), 1), 1),
            "avg_speed": round(float(np.mean(speeds)), 3) if speeds else 0,
            "bottleneck_count": len(self.get_bottlenecks()),
            "frames_recorded": self.frame_count,
        }
