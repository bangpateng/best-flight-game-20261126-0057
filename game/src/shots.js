// Deterministic screenshot poses. ?shot=start|play|cockpit|end&seed=1 puts the
// plane, the mission and the camera in a fixed state, and freezes the flight
// model so every rendered frame is the same composed shot.

import { terrainHeight } from './terrain.js';

export function getShotSetup(name) {
  switch (name) {
    case 'start':
      return {
        missionId: 'ring-run',
        camera: 'chase',
        flight: {
          x: 0, z: 1480, yaw: 0, pitch: 0, roll: 0,
          speed: 12, throttle: 0.55, onGround: true,
        },
        debug: { nextRing: 0, score: 0, fuel: 100, timeLeft: 260 },
        overlay: null,
      };
    case 'play':
      return {
        missionId: 'ring-run',
        camera: 'chase',
        flight: {
          x: 480, z: 60, y: 205, yaw: -0.5, pitch: 0.02, roll: -0.42,
          speed: 62, throttle: 0.78, onGround: false,
        },
        debug: { nextRing: 2, score: 225, fuel: 91, timeLeft: 212 },
        overlay: null,
      };
    case 'cockpit':
      return {
        missionId: 'ring-run',
        camera: 'cockpit',
        flight: {
          x: -120, z: 420, y: 168, yaw: -1.15, pitch: 0.0, roll: 0.06,
          speed: 56, throttle: 0.7, onGround: false,
        },
        debug: { nextRing: 1, score: 100, fuel: 96, timeLeft: 238 },
        overlay: null,
      };
    case 'end':
      return {
        missionId: 'ring-run',
        camera: 'chase',
        flight: {
          x: 0, z: 1150, yaw: 0, pitch: 0, roll: 0,
          speed: 0, throttle: 0, onGround: true,
        },
        debug: { nextRing: 8, score: 1242, fuel: 62, timeLeft: 96, phase: 'returning', landed: true },
        overlay: 'complete',
      };
    default:
      return null;
  }
}

// Place the flight state exactly as the shot asks.
export function applyShotFlight(flight, setup) {
  const f = setup.flight;
  flight.pos.set(f.x, f.y !== undefined ? f.y : terrainHeight(f.x, f.z) + 1.75, f.z);
  flight.yaw = f.yaw;
  flight.pitch = f.pitch;
  flight.roll = f.roll;
  flight.speed = f.speed;
  flight.throttle = f.throttle;
  flight.onGround = f.onGround;
  flight.stalled = false;
  flight.headingDeg = ((-f.yaw * 180) / Math.PI % 360 + 360) % 360;
}
