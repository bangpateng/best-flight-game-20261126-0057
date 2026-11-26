// The island: terrain height, mesh, ocean, sky, runway, village and clouds.
// One height function drives both the mesh and the flight model, so what you
// see is exactly what you can crash into.

import * as THREE from 'three';
import { WORLD, RUNWAY } from './config.js';
import { fbm, hash2, mulberry32, clamp, lerp, smoothstep } from './random.js';

const ISLAND_CX = 0;
const ISLAND_CZ = 0;

// Height of the ground in metres at world (x, z). Ocean floor is below 0.
export function terrainHeight(x, z) {
  const dx = x - ISLAND_CX;
  const dz = z - ISLAND_CZ;
  const d = Math.sqrt(dx * dx + dz * dz);
  const island = smoothstep(WORLD.islandRadius, 950, d); // 1 deep inside, 0 at sea

  // Rolling hills.
  const hills = fbm(x * 0.0011 + 7.3, z * 0.0011 + 2.9, 4);
  let h = Math.pow(hills, 1.6) * 300;

  // The big mountain in the north-west.
  const mx = x + 700;
  const mz = z + 600;
  h += 260 * Math.exp(-(mx * mx + mz * mz) / (2 * 420 * 420));

  // The eastern lagoon: a shallow bay that cuts into the island.
  const lx = x - 950;
  const lz = z + 250;
  const lagoon = Math.exp(-(lx * lx + lz * lz) / (2 * 380 * 380));
  h = h * (1 - 0.85 * lagoon) - 14 * lagoon;

  h *= island;
  // Below the waterline the seabed keeps sloping down gently.
  h += (1 - island) * -18;

  // Flatten the runway strip.
  const rw = runwayBlend(x, z);
  h = lerp(h, RUNWAY.elevation, rw);

  // Flatten the little fishing village on the south-east coast.
  const vx = x - 420;
  const vz = z - 320;
  const village = Math.exp(-(vx * vx + vz * vz) / (2 * 130 * 130));
  h = lerp(h, 9, village * 0.8);

  return h;
}

// 0 outside the runway rectangle, 1 deep inside it (feathered edges).
// The flat core is wide enough to hold the visible strip with margin.
export function runwayBlend(x, z) {
  const ex = smoothstep(RUNWAY.halfWidth + 120, RUNWAY.halfWidth - 10, Math.abs(x - RUNWAY.centerX));
  const zIn = smoothstep(RUNWAY.zMin - 200, RUNWAY.zMin + 40, z) *
    (1 - smoothstep(RUNWAY.zMax - 40, RUNWAY.zMax + 200, z));
  return clamp(ex * zIn, 0, 1);
}

export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centerX) < RUNWAY.halfWidth &&
    z > RUNWAY.zMin &&
    z < RUNWAY.zMax
  );
}

function groundColor(x, z, h, slopeUp, out) {
  // slopeUp ~1 on flat ground, ~0 on cliffs.
  const n1 = fbm(x * 0.02 + 3.1, z * 0.02 + 8.7, 2);
  const n2 = fbm(x * 0.008 + 11.0, z * 0.008 + 4.4, 3);
  const d = Math.hypot(x, z);
  // Sand only at the shoreline (and around the lagoon), not inland.
  const nearCoast = d > 1250 || (Math.hypot(x - 950, z + 250) < 480 && h < 8);
  if (h < 1.2) {
    // Wet sand at the waterline.
    out.setRGB(0.76, 0.68, 0.5);
  } else if (h < 8 && nearCoast) {
    // Dry beach sand.
    out.setRGB(0.87 + n1 * 0.06, 0.78 + n1 * 0.05, 0.58);
  } else if (h > 300 || slopeUp < 0.55) {
    // Bare rock: mountain top and steep faces.
    const g = 0.42 + n1 * 0.12;
    out.setRGB(g, g * 0.96, g * 0.9);
  } else if (n2 > 0.58) {
    // Jungle patches.
    out.setRGB(0.08 + n1 * 0.05, 0.3 + n1 * 0.09, 0.12);
  } else {
    // Grass, greener in the valleys, drier on the ridges.
    const dry = n1 * 0.14;
    out.setRGB(0.2 + dry, 0.38 + n1 * 0.12 - dry * 0.4, 0.14 + n1 * 0.05);
  }
  return out;
}

export function buildTerrain(scene) {
  const size = WORLD.terrainSize;
  const seg = 240;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Slope from finite differences, for rock vs grass.
    const hx = terrainHeight(x + 6, z) - terrainHeight(x - 6, z);
    const hz = terrainHeight(x, z + 6) - terrainHeight(x, z - 6);
    n.set(-hx / 12, 1, -hz / 12).normalize();
    groundColor(x, z, h, n.y, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

export function buildOcean(scene) {
  const geo = new THREE.CircleGeometry(WORLD.oceanRadius, 64);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x1a6f9e,
    transparent: true,
    opacity: 0.94,
    shininess: 120,
    specular: 0x99ccdd,
  });
  const ocean = new THREE.Mesh(geo, mat);
  ocean.position.y = WORLD.waterLevel;
  scene.add(ocean);

  // Foam ring where the sea meets the sand.
  const foamGeo = new THREE.RingGeometry(1380, 1760, 64);
  foamGeo.rotateX(-Math.PI / 2);
  const foam = new THREE.Mesh(
    foamGeo,
    new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  foam.position.y = 0.4;
  scene.add(foam);
  return ocean;
}

export function buildSky(scene) {
  // Gradient dome with a warm sun glow, drawn behind everything.
  const geo = new THREE.SphereGeometry(8800, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(WORLD.skyTop) },
      horizon: { value: new THREE.Color(WORLD.skyHorizon) },
      sunDir: { value: new THREE.Vector3(0.55, 0.42, -0.72).normalize() },
      sunColor: { value: new THREE.Color(0xffe6b0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w; // pin to the far plane
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        float t = clamp(vDir.y * 1.6 + 0.18, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(t, 0.8));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 350.0) * 0.85 + pow(s, 24.0) * 0.10);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);

  scene.fog = new THREE.Fog(WORLD.fogColor, WORLD.fogNear, WORLD.fogFar);

  const sun = new THREE.DirectionalLight(0xffe0b3, 2.4);
  sun.position.set(2200, 1700, -2900);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9fc8e8, 0x3f6b4f, 1.1);
  scene.add(hemi);
  return { sun, hemi };
}

export function buildClouds(scene, seed) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 10, 8);
  // Unlit white: clouds read bright from below as well as from above.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 });
  const puffs = [];
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const blobs = 4 + Math.floor(rand() * 4);
    const spread = 34 + rand() * 50;
    for (let b = 0; b < blobs; b++) {
      const s = new THREE.Mesh(geo, mat);
      const r = 15 + rand() * 24;
      s.scale.set(r * (1.2 + rand() * 0.6), r * (0.75 + rand() * 0.3), r);
      s.position.set((rand() - 0.5) * spread, (rand() - 0.5) * 8, (rand() - 0.5) * spread * 0.6);
      cloud.add(s);
    }
    const ang = rand() * Math.PI * 2;
    const rad = 700 + rand() * 2600;
    cloud.position.set(Math.cos(ang) * rad, 380 + rand() * 260, Math.sin(ang) * rad);
    cloud.userData.drift = 2 + rand() * 3;
    group.add(cloud);
    puffs.push(cloud);
  }
  scene.add(group);
  return {
    group,
    update(dt) {
      for (const c of puffs) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 3400) c.position.x = -3400;
      }
    },
  };
}

// Runway, tower, hangar, windsock, village huts and palm trees.
export function buildAirfield(scene, seed) {
  const rand = mulberry32(seed ^ 0x9e37);
  const group = new THREE.Group();
  const y0 = RUNWAY.elevation;

  // Asphalt strip, raised slightly above the flattened ground so it reads.
  // 88 m wide, 600 m long: sits entirely on the flat core of the blend.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(88, 0.5, 600),
    new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.9 }),
  );
  strip.position.set(RUNWAY.centerX, y0 - 0.1, RUNWAY.centerZ);
  group.add(strip);

  // Centreline dashes and threshold bars.
  const paint = new THREE.MeshBasicMaterial({ color: 0xf5f5ee });
  for (let z = RUNWAY.zMin + 130; z < RUNWAY.zMax - 100; z += 90) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 42), paint);
    dash.position.set(0, y0 + 0.25, z);
    group.add(dash);
  }
  for (const z of [RUNWAY.zMin + 55, RUNWAY.zMax - 55]) {
    for (let x = -36; x <= 36; x += 12) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 16), paint);
      bar.position.set(x, y0 + 0.25, z);
      group.add(bar);
    }
  }
  // Big runway numbers "07" at the south threshold, drawn as boxes.
  const numMat = new THREE.MeshBasicMaterial({ color: 0xf5f5ee });
  const num = (cx, cz, shape) => {
    for (const [ox, oz, w, d] of shape) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), numMat);
      m.position.set(cx + ox, y0 + 0.25, cz + oz);
      group.add(m);
    }
  };
  num(-28, RUNWAY.zMin + 100, [[0, -14, 16, 4], [0, 0, 16, 4], [0, 14, 16, 4], [-6, -7, 4, 12], [6, 7, 4, 12]]);
  num(28, RUNWAY.zMin + 100, [[0, -14, 16, 4], [0, 0, 16, 4], [0, 14, 16, 4], [6, -7, 4, 12], [-6, 7, 4, 12]]);

  // Edge lights.
  const lightGeo = new THREE.SphereGeometry(1.1, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let z = RUNWAY.zMin + 60; z <= RUNWAY.zMax - 60; z += 80) {
    for (const x of [-48, 48]) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(x, y0 + 0.6, z);
      group.add(l);
    }
  }

  // Control tower.
  const towerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 9, 42, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.85 }),
  );
  towerBase.position.set(95, y0 + 21, 1010);
  group.add(towerBase);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 9, 9, 10),
    new THREE.MeshStandardMaterial({ color: 0x2b4a63, roughness: 0.35, metalness: 0.4 }),
  );
  cab.position.set(95, y0 + 46, 1010);
  group.add(cab);
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 14, 6),
    new THREE.MeshStandardMaterial({ color: 0x666666 }),
  );
  antenna.position.set(95, y0 + 56, 1010);
  group.add(antenna);

  // Hangar with a simple gable roof (two angled slabs).
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(46, 16, 34),
    new THREE.MeshStandardMaterial({ color: 0x7d9bb0, roughness: 0.7, metalness: 0.25 }),
  );
  hangar.position.set(-105, y0 + 8, 1330);
  group.add(hangar);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5d7f95, roughness: 0.7, metalness: 0.25 });
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 20), roofMat);
    slab.position.set(-105, y0 + 19.5, 1330 + side * 8);
    slab.rotation.x = side * -0.32;
    group.add(slab);
  }

  // Windsock: pole + orange cone that swings with the wind.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xdddddd }),
  );
  pole.position.set(48, y0 + 6, 920);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 9, 10),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(48, y0 + 11.4, 920);
  group.add(sock);

  // Fishing village: huts with pyramid roofs.
  const hutColors = [0xd9a05b, 0xc98a4b, 0xe0b070, 0xb98a5a];
  for (let i = 0; i < 9; i++) {
    const hx = 380 + (rand() - 0.5) * 160;
    const hz = 300 + (rand() - 0.5) * 140;
    const hy = terrainHeight(hx, hz);
    const w = 9 + rand() * 5;
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(w, 6, w * 0.8),
      new THREE.MeshStandardMaterial({ color: hutColors[i % hutColors.length], roughness: 0.9 }),
    );
    hut.position.set(hx, hy + 3, hz);
    hut.rotation.y = rand() * Math.PI;
    group.add(hut);
    const roofHut = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.85, 5, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.95 }),
    );
    roofHut.position.set(hx, hy + 8.4, hz);
    roofHut.rotation.y = Math.PI / 4 + hut.rotation.y;
    group.add(roofHut);
  }

  // Palm trees: instanced trunks + crowns along the coast.
  const palmSpots = [];
  let guard = 0;
  while (palmSpots.length < 170 && guard++ < 4000) {
    const ang = rand() * Math.PI * 2;
    const rad = 1150 + rand() * 450;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const h = terrainHeight(x, z);
    if (h < 2.5 || h > 42) continue;
    if (onRunway(x, z)) continue;
    const vx = x - 420;
    const vz = z - 320;
    if (vx * vx + vz * vz < 130 * 130) continue; // keep the village clear
    palmSpots.push([x, h, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 13, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.IcosahedronGeometry(4.4, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1, flatShading: true });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  palmSpots.forEach(([x, h, z], i) => {
    const lean = (hash2(i, 7) - 0.5) * 0.16;
    e.set(lean, hash2(i, 3) * Math.PI * 2, (hash2(i, 11) - 0.5) * 0.16);
    q.setFromEuler(e);
    s.set(1, 0.9 + hash2(i, 5) * 0.35, 1);
    m4.compose(new THREE.Vector3(x, h + 6.2, z), q, s);
    trunks.setMatrixAt(i, m4);
    s.set(1, 0.55, 1);
    m4.compose(new THREE.Vector3(x, h + 13.6, z), q, s);
    crowns.setMatrixAt(i, m4);
  });
  group.add(trunks);
  group.add(crowns);

  scene.add(group);
  return {
    group,
    windsock: sock,
    update(dt, windStrength, time) {
      // The sock streams with the wind and flutters a little.
      sock.rotation.y = Math.PI * 0.5 + Math.sin(time * 0.7) * 0.08 * (1 + windStrength);
      sock.rotation.z = Math.PI / 2 - 0.25 - windStrength * 0.35;
    },
  };
}
