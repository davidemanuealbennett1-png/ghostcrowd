"""
Quick test: spawn 50 agents in a room with a bottleneck and run the simulation.
Run from the backend/ directory with: python test_simulation.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from simulation.environment import Environment
from simulation.engine import SimulationEngine
from simulation.analytics import Analytics


def test_basic_room():
    print("=== Test 1: Basic room (20x15m), 30 agents ===")
    env = Environment(width=20, height=15)
    env.add_spawn_zone(0.5, 1.0, 2.0, 13.0)   # spawn on left
    env.add_exit_zone(17.5, 1.0, 2.0, 13.0)   # exit on right

    sim = SimulationEngine(env, dt=0.05)
    sim.spawn_agents(30)
    analytics = Analytics(20, 15)

    print(f"  Spawned {len(sim.agents)} agents")

    for step in range(500):
        sim.step()
        analytics.record_frame(sim.agents)
        if step % 100 == 0:
            state = sim.get_state()
            print(f"  Step {step:4d} | t={state['time']:.1f}s | active={state['active_count']}")
        if sim.get_state()['active_count'] == 0:
            print(f"  All agents exited at step {step}!")
            break

    summary = analytics.get_summary(sim.agents)
    print(f"  Summary: {summary}")
    print()


def test_bottleneck():
    print("=== Test 2: Bottleneck corridor (30x10m), 50 agents ===")
    env = Environment(width=30, height=10)

    # Add walls creating a narrow doorway in the middle
    # Wall on bottom half: from x=13 to x=14.5 there's a gap (door)
    env.add_wall(0, 5, 13, 5)       # left side of wall
    env.add_wall(14.5, 5, 30, 5)    # right side of wall (gap at 13–14.5)

    env.add_spawn_zone(0.5, 0.5, 3.0, 4.0)   # spawn bottom-left
    env.add_exit_zone(26.0, 0.5, 3.0, 9.0)   # exit on right

    sim = SimulationEngine(env, dt=0.05)
    sim.spawn_agents(50)
    analytics = Analytics(30, 10)

    print(f"  Spawned {len(sim.agents)} agents")

    for step in range(1000):
        sim.step()
        analytics.record_frame(sim.agents)
        if step % 200 == 0:
            state = sim.get_state()
            print(f"  Step {step:4d} | t={state['time']:.1f}s | active={state['active_count']}")
        if sim.get_state()['active_count'] == 0:
            print(f"  All agents exited at step {step}!")
            break

    bottlenecks = analytics.get_bottlenecks(threshold=0.6)
    summary = analytics.get_summary(sim.agents)
    print(f"  Summary: {summary}")
    print(f"  Bottleneck cells detected: {len(bottlenecks)}")
    if bottlenecks:
        top = sorted(bottlenecks, key=lambda b: -b['intensity'])[:3]
        for b in top:
            print(f"    x={b['x']:.1f} y={b['y']:.1f} intensity={b['intensity']:.2f}")
    print()


def test_performance():
    print("=== Test 3: Performance — 200 agents, 500 steps ===")
    import time
    env = Environment(width=40, height=20)
    env.add_spawn_zone(0.5, 0.5, 3.0, 19.0)
    env.add_exit_zone(36.0, 0.5, 3.0, 19.0)

    sim = SimulationEngine(env, dt=0.05)
    sim.spawn_agents(200)

    start = time.time()
    for _ in range(500):
        sim.step()
    elapsed = time.time() - start

    state = sim.get_state()
    print(f"  200 agents × 500 steps in {elapsed:.2f}s ({500/elapsed:.0f} steps/sec)")
    print(f"  Active at end: {state['active_count']}")
    if elapsed < 10:
        print("  ✓ Performance acceptable for web use")
    else:
        print("  ✗ Too slow — optimization needed")
    print()


if __name__ == "__main__":
    test_basic_room()
    test_bottleneck()
    test_performance()
    print("All tests complete.")
