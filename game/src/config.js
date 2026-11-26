// Elang Laut: Island Run — tuning constants, world layout and missions.
// All distances in metres, speeds in m/s, angles in radians.

export const WORLD = {
  terrainSize: 5200,
  terrainSegments: 200,
  oceanRadius: 6500,
  waterLevel: 0,
  islandRadius: 1750,
  fogNear: 1800,
  fogFar: 7200,
  skyTop: 0x5ea4dd,
  skyHorizon: 0xd9edfa,
  fogColor: 0xcfe5f2,
};

export const RUNWAY = {
  // Flat strip on the south coast, heading north (toward -Z).
  centerX: 0,
  centerZ: 1200,
  halfWidth: 55,
  zMin: 860,
  zMax: 1540,
  elevation: 3,
  headingDeg: 0, // runway heading: north
};

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle, level flight
  minSpeed: 28, // below this the wing stalls
  cruiseSpeed: 62,
  accelRate: 9, // m/s^2 toward target speed
  pitchRate: 0.85, // rad/s at full elevator
  rollRate: 1.7, // rad/s at full aileron
  maxPitch: 0.62,
  maxRoll: 1.15,
  turnFactor: 0.85, // how strongly bank turns the nose
  stallSink: 14, // extra m/s sink when stalled
  groundClearance: 1.75, // metres above terrain before impact (wheels touch)
  fuelBurnCruise: 0.32, // fuel units per second at cruise throttle
  fuelBurnFull: 0.55,
};

// Ring course layouts. Ring = {x, y, z} centre, radius 26 m.
// The course always starts just past the runway and ends back over it,
// so every mission finishes with a landing.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: '8 gerbang, satu putaran pulau. Terbang bersih, mendarat mulus.',
    timeLimit: 260,
    fuel: 100,
    wind: 0.0,
    rings: [
      { x: 0, y: 120, z: 700 },
      { x: 350, y: 180, z: 250 },
      { x: 720, y: 240, z: -260 },
      { x: 260, y: 300, z: -820 },
      { x: -460, y: 260, z: -660 },
      { x: -860, y: 200, z: -40 },
      { x: -520, y: 150, z: 680 },
      { x: 0, y: 130, z: 1150 },
    ],
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    tagline: '10 gerbang mengelilingi kepulauan. Angin sepoi, bahan bakar pas-pasan.',
    timeLimit: 330,
    fuel: 100,
    wind: 0.25,
    rings: [
      { x: 0, y: 120, z: 700 },
      { x: 480, y: 170, z: 420 },
      { x: 1050, y: 220, z: -120 },
      { x: 900, y: 280, z: -850 },
      { x: 120, y: 320, z: -1150 },
      { x: -700, y: 290, z: -950 },
      { x: -1250, y: 230, z: -350 },
      { x: -1100, y: 180, z: 500 },
      { x: -480, y: 150, z: 950 },
      { x: 0, y: 130, z: 1150 },
    ],
  },
  {
    id: 'storm-courier',
    name: 'Storm Courier',
    tagline: '8 gerbang rendah di tengah badai. Kurir pos pulau tidak kenal cuaca.',
    timeLimit: 230,
    fuel: 88,
    wind: 0.9,
    rings: [
      { x: 0, y: 95, z: 650 },
      { x: 300, y: 130, z: 150 },
      { x: 620, y: 170, z: -420 },
      { x: 80, y: 210, z: -900 },
      { x: -620, y: 180, z: -560 },
      { x: -780, y: 140, z: 180 },
      { x: -420, y: 110, z: 760 },
      { x: 0, y: 110, z: 1150 },
    ],
  },
];

export const SCORE = {
  ring: 100,
  ringFastBonus: 25, // extra when a ring is taken within 12 s of the previous one
  landing: 150,
  timeBonusPerSecond: 2, // per second left on the clock at landing
  perfectLanding: 100, // touchdown slower than 3 m/s descent, wings level
  damagePerHardLanding: 25,
};

export const COLORS = {
  fuselage: 0xf2e8d5,
  wingTeal: 0x0e7c7b,
  stripeOrange: 0xff7a1a,
  canopy: 0x18324a,
  propDark: 0x2b2b30,
  ringNext: 0xff8c1a,
  ringDone: 0x37d67a,
  ringIdle: 0x3fa7ff,
};
