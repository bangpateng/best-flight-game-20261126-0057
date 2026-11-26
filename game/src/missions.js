// Missions: ring courses, fuel, timer, damage, scoring and landing.
// One mission runs at a time; the course is a sequence of glowing rings and
// the sortie ends when the plane lands back on the runway.

import * as THREE from 'three';
import { MISSIONS, RUNWAY, SCORE, COLORS } from './config.js';
import { terrainHeight, onRunway } from './terrain.js';
import { mulberry32, clamp } from './random.js';
import { rollout } from './physics.js';

export function createMissionRunner(scene) {
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);
  const ringGeo = new THREE.TorusGeometry(26, 2.4, 12, 42);
  const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 1, 8, 1, true);

  let mission = null;
  let rings = [];
  let ringMeshes = [];
  let beam = null;
  let nextRing = 0;
  let score = 0;
  let fuel = 100;
  let damage = 0;
  let timeLeft = 0;
  let lastRingAt = 0;
  let elapsed = 0;
  let phase = 'idle'; // idle | flying | returning | done | failed
  let failReason = '';
  let landed = false;
  let wind = { x: 0, z: 0 };
  let windBase = { x: 0, z: 0 };
  let gustPhase = 0;

  function clearRings() {
    for (const m of ringMeshes) {
      ringGroup.remove(m);
      m.material.dispose();
    }
    ringMeshes = [];
    if (beam) {
      ringGroup.remove(beam);
      beam = null;
    }
  }

  function buildRings(seed) {
    clearRings();
    const rand = mulberry32(seed);
    rings = mission.rings.map((r) => ({
      x: r.x + (rand() - 0.5) * 24,
      y: r.y + (rand() - 0.5) * 14,
      z: r.z + (rand() - 0.5) * 24,
    }));
    rings.forEach((r, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.ringIdle,
        emissive: COLORS.ringIdle,
        emissiveIntensity: 0.55,
        roughness: 0.35,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set(r.x, r.y, r.z);
      // Face the ring along the course: look at the next ring (or the runway).
      const target = rings[i + 1] || { x: RUNWAY.centerX, y: RUNWAY.elevation + 40, z: RUNWAY.centerZ };
      mesh.lookAt(target.x, target.y, target.z);
      ringGroup.add(mesh);
      ringMeshes.push(mesh);
    });
    // Light beam under the next ring, so the pilot can always find it.
    beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: COLORS.ringNext, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
    );
    ringGroup.add(beam);
  }

  function refreshRingColors() {
    ringMeshes.forEach((m, i) => {
      const col = i < nextRing ? COLORS.ringDone : i === nextRing ? COLORS.ringNext : COLORS.ringIdle;
      m.material.color.setHex(col);
      m.material.emissive.setHex(col);
      m.material.emissiveIntensity = i === nextRing ? 1.1 : 0.55;
    });
  }

  function start(missionId, seed = 20261126) {
    mission = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    buildRings(seed + mission.rings.length * 131);
    nextRing = 0;
    score = 0;
    fuel = mission.fuel;
    damage = 0;
    timeLeft = mission.timeLimit;
    elapsed = 0;
    lastRingAt = 0;
    phase = 'flying';
    failReason = '';
    landed = false;
    const ang = seed % 360 * (Math.PI / 180);
    windBase = { x: Math.cos(ang) * 4 * mission.wind, z: Math.sin(ang) * 4 * mission.wind };
    wind = { ...windBase };
    gustPhase = 0;
    refreshRingColors();
    updateBeam();
    return mission;
  }

  function updateBeam() {
    if (!beam || nextRing >= rings.length) {
      if (beam) beam.visible = false;
      return;
    }
    const r = rings[nextRing];
    const ground = terrainHeight(r.x, r.z);
    const height = Math.max(10, r.y - ground);
    beam.visible = true;
    beam.scale.set(1, height, 1);
    beam.position.set(r.x, ground + height / 2, r.z);
  }

  function ringPassed(flight) {
    if (nextRing >= rings.length) return false;
    const r = rings[nextRing];
    const dx = flight.pos.x - r.x;
    const dy = flight.pos.y - r.y;
    const dz = flight.pos.z - r.z;
    return dx * dx + dy * dy + dz * dz < 26 * 26;
  }

  // Called every fixed step while flying. Returns an event for the main loop:
  // 'ring' | 'all-rings' | 'landed' | 'crashed' | 'out-of-fuel' | 'time-up' | null.
  // crashReason is filled when the plane hits terrain or water.
  function update(dt, flight, event) {
    if (phase !== 'flying' && phase !== 'returning') return null;
    elapsed += dt;
    timeLeft -= dt;
    gustPhase += dt;
    // Wind gusts: slow sine swell on top of the base wind.
    const gust = 1 + Math.sin(gustPhase * 0.45) * 0.6 * mission.wind;
    wind.x = windBase.x * gust;
    wind.z = windBase.z * gust;

    // Fuel burn scales with throttle.
    const burn = (0.22 + flight.throttle * 0.4) * (mission.fuel / 100);
    fuel -= burn * dt;
    if (fuel <= 0) {
      fuel = 0;
      phase = 'failed';
      failReason = 'Bahan bakar habis — pesawat meluncur jatuh.';
      return 'out-of-fuel';
    }
    if (timeLeft <= 0) {
      timeLeft = 0;
      phase = 'failed';
      failReason = 'Waktu habis sebelum semua gerbang dilewati.';
      return 'time-up';
    }

    if (event === 'terrain' || event === 'water') {
      phase = 'failed';
      failReason = event === 'water'
        ? 'Mendarat darurat di laut — pesawat tenggelam.'
        : 'Menabrak daratan. Terbang lebih tinggi lain kali.';
      return 'crashed';
    }

    if (event === 'touchdown') {
      const level = Math.abs(flight.roll) < 0.18 && Math.abs(flight.pitch) < 0.14;
      const gentle = flight.verticalSpeed > -5;
      const slow = flight.speed < 58;
      const onStrip = onRunway(flight.pos.x, flight.pos.z);
      const veryHard = flight.verticalSpeed < -9 || Math.abs(flight.roll) > 0.45;
      if (onStrip && level && gentle && slow) {
        if (phase === 'returning') {
          // Clean landing: finish the sortie.
          phase = 'done';
          landed = true;
          const timeBonus = Math.round(timeLeft) * SCORE.timeBonusPerSecond;
          const perfect = flight.verticalSpeed > -3 && Math.abs(flight.roll) < 0.08;
          score += SCORE.landing + timeBonus + (perfect ? SCORE.perfectLanding : 0);
          rollout(flight, dt);
          flight.onGround = true;
          return 'landed';
        }
        // Touch-and-go mid-mission: roll on the strip, take off again.
        flight.onGround = true;
        return 'touch-and-go';
      }
      if (!onStrip || veryHard) {
        phase = 'failed';
        failReason = !onStrip
          ? 'Mendarat di luar landasan — pesawat rusak.'
          : 'Pendaratan terlalu keras. Sayap tidak selamat.';
        return 'crashed';
      }
      // A rough-but-survivable touchdown on the strip: bounce with damage.
      damage += SCORE.damagePerHardLanding;
      flight.pos.y = terrainHeight(flight.pos.x, flight.pos.z) + 6;
      flight.pitch = 0.12;
      if (damage >= 100) {
        phase = 'failed';
        failReason = 'Pesawat rusak parah setelah pendaratan keras.';
        return 'crashed';
      }
      return 'hard-landing';
    }

    if (phase === 'flying' && ringPassed(flight)) {
      const fast = elapsed - lastRingAt < 12 && nextRing > 0;
      score += SCORE.ring + (fast ? SCORE.ringFastBonus : 0);
      lastRingAt = elapsed;
      nextRing += 1;
      refreshRingColors();
      updateBeam();
      if (nextRing >= rings.length) {
        phase = 'returning';
        return 'all-rings';
      }
      return 'ring';
    }
    return null;
  }

  function pulse(time) {
    if (nextRing < ringMeshes.length) {
      const s = 1 + Math.sin(time * 4) * 0.04;
      ringMeshes[nextRing].scale.setScalar(s);
      if (beam) beam.material.opacity = 0.1 + Math.sin(time * 2.4) * 0.05;
    }
  }

  return {
    start,
    update,
    pulse,
    // Screenshot poses set the mission state directly; never used in play.
    debugSet(patch) {
      if (!patch) return;
      if (typeof patch.nextRing === 'number') {
        nextRing = Math.max(0, Math.min(rings.length, patch.nextRing));
        refreshRingColors();
        updateBeam();
      }
      if (typeof patch.score === 'number') score = patch.score;
      if (typeof patch.fuel === 'number') fuel = patch.fuel;
      if (typeof patch.timeLeft === 'number') timeLeft = patch.timeLeft;
      if (patch.phase) phase = patch.phase;
      if (patch.landed) landed = true;
    },
    get mission() { return mission; },
    get rings() { return rings; },
    get nextRing() { return nextRing; },
    get score() { return score; },
    get fuel() { return fuel; },
    get damage() { return damage; },
    get timeLeft() { return timeLeft; },
    get phase() { return phase; },
    get failReason() { return failReason; },
    get landed() { return landed; },
    get wind() { return wind; },
    get ringsTotal() { return rings.length; },
  };
}

// Score breakdown shown on the mission-complete screen.
export function scoreBreakdown(runner) {
  const rings = runner.nextRing * SCORE.ring;
  const landing = runner.landed ? SCORE.landing : 0;
  const timeBonus = runner.landed ? Math.round(runner.timeLeft) * SCORE.timeBonusPerSecond : 0;
  // Whatever is left of the total after the named rows is the perfect-landing bonus.
  const perfect = Math.max(0, runner.score - rings - landing - timeBonus);
  return { rings, landing, timeBonus, perfect, total: runner.score };
}
