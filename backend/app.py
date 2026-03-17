import asyncio
import json
import traceback
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulation.engine import SimulationEngine
from simulation.environment import Environment
from simulation.analytics import Analytics
from simulation.agent import Agent

app = FastAPI(title="GhostCrowd Simulation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return [int(hex_color[i:i+2], 16) for i in (0, 2, 4)]


def build_environment(floor_plan: dict) -> Environment:
    width = floor_plan.get("width", 20)
    height = floor_plan.get("height", 15)
    env = Environment(width=width, height=height)
    for w in floor_plan.get("walls", []):
        env.add_wall(w["x1"], w["y1"], w["x2"], w["y2"])
    for o in floor_plan.get("obstacles", []):
        env.add_obstacle(o["x"], o["y"], o["width"], o["height"])
    for z in floor_plan.get("spawn_zones", []):
        env.add_spawn_zone(z["x"], z["y"], z["w"], z["h"], weight=z.get("weight", 1.0))
    for z in floor_plan.get("exit_zones", []):
        env.add_exit_zone(z["x"], z["y"], z["w"], z["h"], weight=z.get("weight", 1.0))
    return env


@app.get("/")
def root():
    return {"status": "GhostCrowd API running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/simulate")
async def simulate(websocket: WebSocket):
    await websocket.accept()

    try:
        raw = await websocket.receive_text()
        config = json.loads(raw)
        print(f"[simulate] config received: agent_count={config.get('agent_count')}")

        agent_count = min(int(config.get("agent_count", 50)), 500)
        floor_plan = config.get("floor_plan", {})
        dt = float(config.get("dt", 0.05))
        steps_per_frame = int(config.get("steps_per_frame", 3))
        max_steps = int(config.get("max_steps", 3000))
        sim_speed = float(config.get("sim_speed", 1.0))
        spawn_schedule = config.get("spawn_schedule", None)
        panic_mode = bool(config.get("panic_mode", False))

        # Custom agent type definitions from frontend
        # Format: [{ id, name, color, speedMin, speedMax, proportion }, ...]
        custom_agent_types = config.get("custom_agent_types", None)

        env = build_environment(floor_plan)
        sim = SimulationEngine(env, dt=dt, panic=panic_mode)
        analytics = Analytics(env.width, env.height, grid_resolution=1.0)

        # Build spawn function based on custom types
        def spawn_custom(count):
            if not custom_agent_types:
                sim.spawn_agents(count)
                return

            active = [t for t in custom_agent_types if t.get("proportion", 0) > 0]
            if not active:
                sim.spawn_agents(count)
                return

            total = sum(t["proportion"] for t in active)
            weights = np.array([t["proportion"] / total for t in active])
            type_ids = [t["id"] for t in active]

            for _ in range(count):
                pos = env.random_spawn_position()
                dest = env.random_exit_position()
                chosen_idx = np.random.choice(len(type_ids), p=weights)
                chosen = active[chosen_idx]

                speed_min = float(chosen.get("speedMin", 1.0))
                speed_max = float(chosen.get("speedMax", 1.5))
                color_hex = chosen.get("color", "#a78bfa")
                color_rgb = hex_to_rgb(color_hex)

                agent = Agent.__new__(Agent)
                agent.id = len(sim.agents)
                agent.position = np.array(pos, dtype=float)
                agent.destination = np.array(dest, dtype=float)
                agent.agent_type = chosen["id"]
                agent.panic = panic_mode
                agent.desired_speed = np.random.uniform(speed_min, speed_max)
                if panic_mode:
                    agent.desired_speed *= 2.5
                agent.velocity = np.zeros(2)
                agent.radius = 0.3
                agent.mass = 75.0
                agent.color = color_rgb
                agent.reached_destination = False

                direction = agent.destination - agent.position
                dist = np.linalg.norm(direction)
                if dist > 0:
                    agent.velocity = (direction / dist) * agent.desired_speed * 0.1

                sim.agents.append(agent)

        if spawn_schedule:
            spawned = 0
            spawn_queue = 0.0
        else:
            spawn_custom(agent_count)
            spawned = agent_count
            spawn_queue = 0.0

        print(f"[simulate] spawned {spawned} agents, starting loop")

        await websocket.send_json({
            "type": "init",
            "environment": env.to_dict(),
            "agent_count": agent_count,
        })

        step = 0
        base_sleep = 0.02 / max(sim_speed, 0.1)

        while step < max_steps:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.0)
                data = json.loads(msg)
                if data.get("type") == "cancel":
                    break
                if "sim_speed" in data:
                    sim_speed = float(data["sim_speed"])
                    base_sleep = 0.02 / max(sim_speed, 0.1)
                if data.get("type") == "panic":
                    sim.set_panic(True)
                if data.get("type") == "calm":
                    sim.set_panic(False)
            except asyncio.TimeoutError:
                pass

            if spawn_schedule and spawned < agent_count:
                current_time = sim.time
                rate = 2.0
                for entry in spawn_schedule:
                    if current_time >= entry["time"]:
                        rate = entry["rate"]
                spawn_queue += rate * dt * steps_per_frame
                to_spawn = min(int(spawn_queue), agent_count - spawned)
                if to_spawn > 0:
                    spawn_custom(to_spawn)
                    spawned += to_spawn
                    spawn_queue -= to_spawn

            for _ in range(steps_per_frame):
                sim.step()
                analytics.record_frame(sim.agents)

            step += steps_per_frame
            state = sim.get_state()
            await websocket.send_json({"type": "frame", **state})
            await asyncio.sleep(base_sleep)

            if state["active_count"] == 0 and spawned >= agent_count:
                break

        print(f"[simulate] complete after {step} steps")
        summary = analytics.get_summary(sim.agents)
        heat_map = analytics.get_normalized_heat_map()
        bottlenecks = analytics.get_bottlenecks(threshold=0.6)

        await websocket.send_json({
            "type": "done",
            "summary": summary,
            "heat_map": heat_map,
            "bottlenecks": bottlenecks,
        })

    except WebSocketDisconnect:
        print("[simulate] client disconnected")
    except Exception as e:
        print(f"[simulate] ERROR: {e}")
        traceback.print_exc()
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
