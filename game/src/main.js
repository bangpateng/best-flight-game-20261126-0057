// Elang Laut: Island Run — boot, game loop and state machine.
// States: menu -> flying -> paused -> over (complete / crashed / out of fuel).

import * as THREE from 'three';
import { MISSIONS, RUNWAY, PLANE } from './config.js';
import {
  buildTerrain, buildOcean, buildSky, buildClouds, buildAirfield, terrainHeight,
} from './terrain.js';
import { buildAircraft, animateAircraft, updateDashboard } from './aircraft.js';
import { createFlightState, stepFlight, planeQuaternion } from './physics.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createMissionRunner, scoreBreakdown } from './missions.js';
import { createCameraRig } from './camera.js';
import { getShotSetup, applyShotFlight } from './shots.js';

const WORLD_SEED = 20261126;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSetup = shotName ? getShotSetup(shotName) : null;
const seedParam = Number(params.get('seed') || WORLD_SEED);

// ---------- Renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 12000);

buildTerrain(scene);
buildOcean(scene);
buildSky(scene);
const clouds = buildClouds(scene, WORLD_SEED);
const airfield = buildAirfield(scene, WORLD_SEED);

// ---------- Plane ----------
const { group: planeGroup, parts: planeParts } = buildAircraft();
scene.add(planeGroup);
const flight = createFlightState();
flight.pos.set(0, terrainHeight(0, 1500) + 1.4, 1500);

const rig = createCameraRig(camera, planeGroup);
const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
const mission = createMissionRunner(scene);

// ---------- State ----------
let state = 'menu'; // menu | flying | paused | over
let cameraMode = 'chase';
let selectedMission = 'ring-run';
let freezePhysics = false; // screenshot poses hold the plane still
let time = 0;
let accumulator = 0;
let lastNow = performance.now();
let bestScore = 0;
try {
  bestScore = Number(window.localStorage.getItem('elanglaut-best') || 0) || 0;
} catch { /* storage unavailable: best score just is not kept */ }

// ---------- Overlays ----------
const $ = (id) => document.getElementById(id);
const overlays = {
  menu: $('overlay-menu'),
  pause: $('overlay-pause'),
  end: $('overlay-end'),
};
function showOverlay(name) {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== name);
  }
  $('hud').classList.toggle('hidden', name === 'menu');
}

function fillEndOverlay(kind, title, sub) {
  $('end-title').textContent = title;
  $('end-title').className = `end-title ${kind}`;
  $('end-sub').textContent = sub;
  const b = scoreBreakdown(mission);
  $('end-breakdown').innerHTML =
    `<div><span>Gerbang dilewati</span><b>${mission.nextRing} × 100 = ${b.rings}</b></div>` +
    `<div><span>Pendaratan</span><b>${mission.landed ? b.landing : 0}</b></div>` +
    (b.perfect > 0 ? `<div><span>Pendaratan sempurna</span><b>${b.perfect}</b></div>` : '') +
    `<div><span>Bonus waktu</span><b>${mission.landed ? b.timeBonus : 0}</b></div>` +
    `<div class="total"><span>Total skor</span><b>${mission.score}</b></div>`;
  $('end-best').textContent = bestScore > 0 ? `Skor terbaik: ${bestScore}` : '';
}

function startMission(missionId) {
  selectedMission = missionId;
  mission.start(missionId, seedParam);
  // Park the plane at the runway threshold, facing north.
  flight.pos.set(0, terrainHeight(0, 1480) + PLANE.groundClearance, 1480);
  flight.yaw = 0;
  flight.pitch = 0;
  flight.roll = 0;
  flight.speed = 0;
  flight.throttle = 0;
  flight.onGround = true;
  flight.stalled = false;
  cameraMode = 'chase';
  hud.setMission(mission.mission.name);
  hud.toast(`${mission.mission.name} — lewati semua gerbang, lalu mendarat!`, 3600);
  audio.unlock();
  state = 'flying';
  showOverlay(null);
}

function endMission(kind, title, sub) {
  state = 'over';
  if (mission.score > bestScore) {
    bestScore = mission.score;
    try {
      window.localStorage.setItem('elanglaut-best', String(bestScore));
    } catch { /* ignore */ }
  }
  fillEndOverlay(kind, title, sub);
  showOverlay('end');
}

// Mission cards on the menu.
document.querySelectorAll('[data-mission]').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('[data-mission]').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMission = card.dataset.mission;
    audio.unlock();
  });
});
$('btn-start').addEventListener('click', () => startMission(selectedMission));
$('btn-again').addEventListener('click', () => startMission(selectedMission));
$('btn-menu').addEventListener('click', () => {
  state = 'menu';
  showOverlay('menu');
});
$('btn-resume').addEventListener('click', () => {
  state = 'flying';
  showOverlay(null);
});
$('btn-quit').addEventListener('click', () => {
  state = 'menu';
  showOverlay('menu');
});
$('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  $('btn-mute').textContent = audio.isMuted() ? 'Suara: Mati' : 'Suara: Hidup';
});
if (bestScore > 0) $('menu-best').textContent = `Skor terbaik: ${bestScore}`;

// ---------- Shot mode (deterministic screenshots) ----------
if (shotSetup) {
  mission.start(shotSetup.missionId, seedParam);
  applyShotFlight(flight, shotSetup);
  mission.debugSet(shotSetup.debug);
  cameraMode = shotSetup.camera;
  hud.setMission(mission.mission.name);
  freezePhysics = true;
  state = 'flying';
  showOverlay(null);
  if (shotSetup.overlay === 'complete') {
    fillEndOverlay('win', 'MISI SELESAI!', 'Semua gerbang dilewati — pendaratan mulus di landasan 07.');
    overlays.end.classList.remove('hidden');
    $('hud').classList.remove('hidden');
  }
} else {
  showOverlay('menu');
}

// ---------- Main loop ----------
function fixedStep(dt) {
  const inp = input.poll();
  const event = freezePhysics ? null : stepFlight(flight, inp, dt, mission.wind);
  // In a screenshot pose the mission clock and fuel hold still too.
  const mev = freezePhysics ? null : mission.update(dt, flight, event);

  if (mev === 'ring') {
    audio.chime();
    hud.toast(`Gerbang ${mission.nextRing}/${mission.ringsTotal} — +100`, 1800);
  } else if (mev === 'all-rings') {
    audio.chime();
    hud.toast('Semua gerbang dilewati! Kembali dan mendarat di landasan.', 4000);
  } else if (mev === 'hard-landing') {
    audio.thud();
    rig.addShake(0.7);
    hud.toast('Pendaratan keras! Kerusakan +25.', 2600);
  } else if (mev === 'touch-and-go') {
    hud.toast('Touch-and-go! Gas lagi untuk lepas landas.', 2400);
  } else if (mev === 'landed') {
    audio.fanfare();
    endMission('win', 'MISI SELESAI!', 'Semua gerbang dilewati — pendaratan mulus di landasan 07.');
  } else if (mev === 'crashed') {
    audio.thud();
    rig.addShake(1.2);
    flight.throttle = 0;
    endMission('lose', 'PESAWAT JATUH', mission.failReason);
  } else if (mev === 'out-of-fuel') {
    flight.throttle = 0;
    endMission('lose', 'BAHAN BAKAR HABIS', mission.failReason);
  } else if (mev === 'time-up') {
    endMission('lose', 'WAKTU HABIS', mission.failReason);
  }

  // One-shot keys.
  if (input.wasPressed('KeyC')) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    hud.toast(cameraMode === 'cockpit' ? 'Kamera kokpit' : 'Kamera kejar', 1400);
  }
  if (input.wasPressed('KeyM')) {
    audio.setMuted(!audio.isMuted());
    $('btn-mute').textContent = audio.isMuted() ? 'Suara: Mati' : 'Suara: Hidup';
  }
  if (input.wasPressed('KeyR')) startMission(selectedMission);
  if (input.wasPressed('KeyP')) {
    state = 'paused';
    showOverlay('pause');
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - lastNow) / 1000, 0.25);
  lastNow = now;
  time += dt;

  if (state === 'flying') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      fixedStep(STEP);
      accumulator -= STEP;
      steps += 1;
      if (state !== 'flying') break;
    }
    if (steps === 5) accumulator = 0;
  } else if (state === 'paused') {
    if (input.wasPressed('KeyP')) {
      state = 'flying';
      showOverlay(null);
    }
  }

  // Visuals always run: plane pose, prop, clouds, rings, windsock.
  planeGroup.position.copy(flight.pos);
  planeGroup.rotation.copy(planeQuaternion(flight));
  animateAircraft(planeParts, flight.throttle, dt, time);
  updateDashboard(planeParts, flight);
  clouds.update(dt);
  airfield.update(dt, mission.mission ? mission.mission.wind : 0, time);
  mission.pulse(time);

  if (state === 'menu') {
    // Slow orbit around the parked plane as a menu backdrop.
    const a = time * 0.12;
    camera.position.set(
      flight.pos.x + Math.sin(a) * 26,
      flight.pos.y + 7 + Math.sin(time * 0.3) * 1.5,
      flight.pos.z + Math.cos(a) * 26,
    );
    camera.lookAt(flight.pos.x, flight.pos.y + 1, flight.pos.z);
    camera.fov = 58;
    camera.updateProjectionMatrix();
  } else if (cameraMode === 'cockpit') {
    rig.updateCockpit(flight, dt, time);
  } else {
    rig.updateChase(flight, dt, time, !!shotSetup);
  }
  // From the pilot's seat the propeller is a blur disc, not distinct blades.
  const showBlades = state === 'menu' || cameraMode !== 'cockpit';
  planeParts.blades.forEach((b) => { b.visible = showBlades; });

  if (state === 'flying' || state === 'over') {
    hud.update({
      flight,
      score: mission.score,
      ringsDone: mission.nextRing,
      ringsTotal: mission.ringsTotal,
      timeLeft: mission.timeLeft,
      fuel: mission.fuel,
      damage: mission.damage,
      ringPositions: mission.rings,
      nextRing: mission.nextRing,
    });
    audio.update(flight.throttle, flight.speed, state === 'flying' && !flight.onGround);
    audio.alarm(state === 'flying' && mission.fuel < 20 && mission.fuel > 0);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(frame);
