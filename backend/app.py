import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulation.engine import SimulationEngine
from simulation.environment import Environment
from simulation.analytics import Analytics

app = FastAPI(title="GhostCrowd Simulation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_environment(floor_plan: dict) -> Environment:
    """
    Build an Environment from the floor plan JSON sent by the frontend.

    Expected floor_plan format:
    {
        "width": 20,
        "height": 15,
        "walls": [{"x1":0,"y1":5,"x2":13,"y2":5}, ...],
        "obstacles": [{"x":5,"y":5,"width":2,"height":2}, ...],
        "spawn_zones": [{"x":0.5,"y":1,"w":2,"h":13}],
        "exit_zones":  [{"x":17.5,"y":1,"w":2,"h":13}]
    }
    """
    width = floor_plan.get("width", 20)
    height = floor_plan.get("height", 15)
    env = Environment(width=width, height=height)

    for w in floor_plan.get("walls", []):
        env.add_wall(w["x1"], w["y1"], w["x2"], w["y2"])

    for o in floor_plan.get("obstacles", []):
        env.add_obstacle(o["x"], o["y"], o["width"], o["height"])

    for z in floor_plan.get("spawn_zones", []):
        env.add_spawn_zone(z["x"], z["y"], z["w"], z["h"])

    for z in floor_plan.get("exit_zones", []):
        env.add_exit_zone(z["x"], z["y"], z["w"], z["h"])

    return env


@app.get("/")
def root():
    return {"status": "GhostCrowd API running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/simulate")
async def simulate(websocket: WebSocket):
    """
    WebSocket endpoint for real-time simulation streaming.

    Client sends one JSON message to start:
    {
        "agent_count": 50,
        "floor_plan": { ... },
        "dt": 0.05,           # optional
        "steps_per_frame": 3  # optional, how many sim steps per update sent
    }

    Server streams back frames:
    {
        "type": "frame",
        "time": 1.5,
        "step": 30,
        "agents": [{"id":0,"x":5.2,"y":3.1,"vx":0.8,"vy":0.2,"reached":false}, ...],
        "active_count": 45,
        "total_count": 50
    }

    When done:
    {
        "type": "done",
        "summary": { ... },
        "heat_map": [[...], ...],
        "bottlenecks": [...]
    }
    """
    await websocket.accept()

    try:
        # Wait for the config message from the client
        raw = await websocket.receive_text()
        config = json.loads(raw)

        agent_count = min(int(config.get("agent_count", 50)), 500)
        floor_plan = config.get("floor_plan", {})
        dt = float(config.get("dt", 0.05))
        steps_per_frame = int(config.get("steps_per_frame", 3))
        max_steps = int(config.get("max_steps", 3000))

        # Build environment and engine
        env = build_environment(floor_plan)
        sim = SimulationEngine(env, dt=dt)
        sim.spawn_agents(agent_count)
        analytics = Analytics(env.width, env.height, grid_resolution=1.0)

        # Send initial environment info
        await websocket.send_json({
            "type": "init",
            "environment": env.to_dict(),
            "agent_count": agent_count,
        })

        # Run simulation, streaming frames
        step = 0
        while step < max_steps:
            # Check for client disconnect or cancel message
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.0)
                data = json.loads(msg)
                if data.get("type") == "cancel":
                    break
            except asyncio.TimeoutError:
                pass  # No message from client, continue normally

            # Run several sim steps per frame for performance
            for _ in range(steps_per_frame):
                sim.step()
                analytics.record_frame(sim.agents)

            step += steps_per_frame
            state = sim.get_state()

            # Send frame to client
            await websocket.send_json({
                "type": "frame",
                **state,
            })

            # Yield control so other coroutines can run
            await asyncio.sleep(0)

            if state["active_count"] == 0:
                break

        # Send final results
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
