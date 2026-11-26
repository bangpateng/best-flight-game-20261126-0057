// Arcade flight model. The plane flies like a light island-hopper: throttle
// sets speed, elevator sets pitch, ailerons bank the wings and the bank turns
// the nose. Stalling below minimum speed drops the nose and sinks the plane.

import * as THREE from 'three';
import { PLANE } from './config.js';
import { terrainHeight } from './terrain.js';
import { clamp } from './random.js';

export function createFlightState() {
  return {
    pos: new THREE.Vector3(0, 10, 1500),
    yaw: 0, // 0 = north (-Z). Positive yaw turns toward west.
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    stalled: false,
    onGround: true,
    headingDeg: 0,
  };
}

// Forward vector from yaw/pitch. Matches Euler order 'YXZ' on the mesh.
export function forwardVector(yaw, pitch, out) {
  const cp = Math.cos(pitch);
  out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  return out;
}

const _fwd = new THREE.Vector3();
const _prevY = { value: 0 };

// One fixed step. input: {pitch: -1..1, roll: -1..1, throttleDelta, brake}.
// wind: {x, z} drift in m/s, already scaled by mission wind strength.
// Returns an event string: 'stall' | 'terrain' | 'water' | null.
export function stepFlight(state, input, dt, wind) {
  // Throttle: W/S (or Shift/Ctrl) move it, clamped 0..1.
  if (input.throttleDelta) {
    state.throttle = clamp(state.throttle + input.throttleDelta * dt, 0, 1);
  }
  if (input.brake) {
    state.throttle = Math.max(0, state.throttle - 0.8 * dt);
    state.speed = Math.max(0, state.speed - 14 * dt);
  }

  // Target speed from throttle; climbing costs speed, diving gains it.
  const climbPenalty = Math.max(0, state.pitch) * 26;
  const diveBonus = Math.max(0, -state.pitch) * 18;
  const target = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed) - climbPenalty + diveBonus;
  const rate = state.onGround ? PLANE.accelRate * 1.4 : PLANE.accelRate;
  state.speed += clamp(target - state.speed, -rate * dt, rate * dt);
  state.speed = Math.max(0, state.speed);

  // Controls: on the ground the plane only rolls; in the air it flies.
  if (!state.onGround) {
    state.pitch += input.pitch * PLANE.pitchRate * dt;
    state.pitch = clamp(state.pitch, -PLANE.maxPitch, PLANE.maxPitch);
    state.roll += input.roll * PLANE.rollRate * dt;
    state.roll = clamp(state.roll, -PLANE.maxRoll, PLANE.maxRoll);
    // Banked turn: the nose follows the bank.
    const speedFactor = clamp(state.speed / PLANE.cruiseSpeed, 0.25, 1.4);
    state.yaw -= Math.sin(state.roll) * PLANE.turnFactor * speedFactor * dt;
    // The wings level themselves when the stick is centred, but the pitch
    // holds where the pilot left it (trim): levelling the pitch too would
    // kill every landing approach the moment the stick is released.
    if (Math.abs(input.roll) < 0.05) state.roll *= Math.max(0, 1 - 0.7 * dt);
  } else {
    // Taxi: rudder steering with the roll keys, slow and heavy.
    state.yaw -= input.roll * 0.35 * dt * clamp(state.speed / 12, 0, 1);
    state.roll *= Math.max(0, 1 - 4 * dt);
    // Rotate for take-off: enough speed plus a pull on the stick lifts off.
    if (state.speed > 38 && input.pitch > 0.2) {
      state.onGround = false;
      state.pitch = 0.08;
    } else {
      state.pitch *= Math.max(0, 1 - 4 * dt);
    }
  }

  // Stall: below minimum speed the wing quits and the nose drops.
  state.stalled = !state.onGround && state.speed < PLANE.minSpeed;
  if (state.stalled) {
    state.pitch = Math.max(state.pitch - 0.25 * dt, -0.3);
  }

  // Move.
  forwardVector(state.yaw, state.pitch, _fwd);
  const prevY = state.pos.y;
  state.pos.addScaledVector(_fwd, state.speed * dt);
  state.pos.x += wind.x * dt;
  state.pos.z += wind.z * dt;
  if (state.stalled) state.pos.y -= PLANE.stallSink * dt;
  state.verticalSpeed = (state.pos.y - prevY) / Math.max(dt, 1e-4);
  state.headingDeg = ((-state.yaw * 180) / Math.PI % 360 + 360) % 360;

  // Ground and water.
  const ground = terrainHeight(state.pos.x, state.pos.z);
  const clearance = state.pos.y - ground;
  if (clearance <= PLANE.groundClearance) {
    state.pos.y = ground + PLANE.groundClearance;
    if (state.onGround) return null;
    // Touchdown: only a gentle, level, slow arrival on the runway counts as
    // a landing; anything else is a crash. The caller decides via the event.
    return 'touchdown';
  }
  state.onGround = false;
  if (state.pos.y <= 0.6) {
    state.pos.y = 0.6;
    return 'water';
  }
  // Soft world edge: steer back toward the island instead of a hard wall.
  const r = Math.hypot(state.pos.x, state.pos.z);
  if (r > 4200) {
    const toCentre = Math.atan2(-state.pos.x, -state.pos.z);
    let dy = toCentre - state.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    state.yaw += clamp(dy, -1, 1) * 0.4 * dt;
  }
  return null;
}

// Called when the plane is rolling on the runway after a good touchdown.
export function rollout(state, dt) {
  state.speed = Math.max(0, state.speed - 10 * dt);
  state.throttle = 0;
  forwardVector(state.yaw, 0, _fwd);
  state.pos.addScaledVector(_fwd, state.speed * dt);
  const ground = terrainHeight(state.pos.x, state.pos.z);
  state.pos.y = ground + PLANE.groundClearance;
  state.onGround = true;
}

export function planeQuaternion(state) {
  // Roll is negated: with Euler order 'YXZ' a positive Z rotation lifts the
  // right wing, while a positive roll input means "bank right".
  return new THREE.Euler(state.pitch, state.yaw, -state.roll, 'YXZ');
}
