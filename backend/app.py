import asyncio
import json
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulation.engine import SimulationEngine
from simulation.environment import Environment
from simulation.analytics import Analytics

app = FastAPI(title="GhostCrowd Simulation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_environment(floor_plan: dict) -> Environment:
    width = floor_plan.get("width", 20)
    height = floor_plan.get("height", 15)
    env = Environment(width=width, height=height)

    for w in floor_plan.get("walls", []):
        env.add_wall(w["x1"], w["y1"], w["x2"], w["y2"])

    for o in floor_plan.get("obstacles", []):
        env.add_obstacle(o["x"], o["y"], o["width"], o["height"])

    for z in floor_plan.get("spawn_zones", []):
        weight = z.get("weight", 1.0)
        env.add_spawn_zone(z["x"], z["y"], z["w"], z["h"], weight=weight)

    for z in floor_plan.get("exit_zones", []):
        weight = z.get("weight", 1.0)
        env.add_exit_zone(z["x"], z["y"], z["w"], z["h"], weight=weight)

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

        agent_count = min(int(config.get("agent_count", 50)), 500)
        floor_plan = config.get("floor_plan", {})
        dt = float(config.get("dt", 0.05))
        steps_per_frame = int(config.get("steps_per_frame", 3))
        max_steps = int(config.get("max_steps", 3000))
        sim_speed = float(config.get("sim_speed", 1.0))  # 0.25x to 4x

        # Time-varying spawn: list of {time, rate} defining agents/second over time
        spawn_schedule = config.get("spawn_schedule", None)

        env = build_environment(floor_plan)
        sim = SimulationEngine(env, dt=dt)
        analytics = Analytics(env.width, env.height, grid_resolution=1.0)

        # If spawn_schedule is provided, spawn agents gradually
        # Otherwise spawn all at once
        if spawn_schedule:
            # Don't pre-spawn — we'll spawn over time
            spawned = 0
            spawn_queue = 0.0
        else:
            sim.spawn_agents(agent_count)
            spawned = agent_count
            spawn_queue = 0.0

        await websocket.send_json({
            "type": "init",
            "environment": env.to_dict(),
            "agent_count": agent_count,
        })

        step = 0
        # Adjust sleep to control playback speed
        # At 1x speed: ~20ms per frame. At 4x: ~5ms. At 0.25x: ~80ms
        base_sleep = 0.02 / max(sim_speed, 0.1)

        while step < max_steps:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.0)
                data = json.loads(msg)
                if data.get("type") == "cancel":
                    break
                # Allow speed changes mid-simulation
                if "sim_speed" in data:
                    sim_speed = float(data["sim_speed"])
                    base_sleep = 0.02 / max(sim_speed, 0.1)
            except asyncio.TimeoutError:
                pass

            # Gradual spawning based on schedule
            if spawn_schedule and spawned < agent_count:
                current_time = sim.time
                # Find current spawn rate from schedule
                rate = 1.0  # agents per second default
                for entry in spawn_schedule:
                    if current_time >= entry["time"]:
                        rate = entry["rate"]
                spawn_queue += rate * dt * steps_per_frame
                to_spawn = int(spawn_queue)
                if to_spawn > 0:
                    to_spawn = min(to_spawn, agent_count - spawned)
                    sim.spawn_agents(to_spawn)
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
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
