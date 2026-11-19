// Vice Bay II — tuning, palette and city layout in one place.
// The world is a 2560x1920 sun-soaked coastal city by day; the camera shows a
// 1280x720 window of it, so no rule depends on the screen size.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 2560, height: 1920 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

// Road grid: centre-lines every 320 px; roads are 96 px wide.
export const ROAD_W = 96;
export const ROADS_X = [320, 640, 960, 1280, 1600, 1920, 2240];
export const ROADS_Y = [320, 640, 960, 1280, 1600];
// South of this y the beach and water begin (visual only, not drivable).
export const BEACH_Y = 1760;

export const CAR = {
  radius: 16,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  grip: 6.0,
  driftGrip: 1.6,
  drag: 0.55,
  health: 100,
  damagePerHit: 9,
};

export const PLAYER_FOOT = { radius: 10, speed: 170, health: 100 };

export const COP = {
  radius: 16,
  accel: 400,
  maxSpeed: 470,
  turnRate: 2.9,
  grip: 6.5,
  drag: 0.55,
  ramDamage: 7,
  // How long the player must stay unseen before wanted drops a star.
  loseSightSeconds: 4,
  sightRange: 520,
};

export const HELI = { radius: 22, speed: 300, sightRange: 700 };

export const TRAFFIC = { count: 22, speed: 150, radius: 15 };
export const PEDS = { count: 30, speed: 55, radius: 8 };

export const WANTED_MAX = 5;
// Cops on the street per wanted star.
export const COPS_PER_STAR = [0, 1, 2, 3, 4, 5];

export const JOB_COUNT = 10;
export const JOB_TIME = 150; // seconds per job (jobs may override with `time`)
export const GARAGE_REPAIR_COST = 200;
export const CAR_STEAL_WANTED = 1;

// Garage upgrades: 3 levels each, cost grows per level.
export const UPGRADES = {
  engine: { name: 'Engine', base: 500, max: 3 },
  armor: { name: 'Armor', base: 500, max: 3 },
  tires: { name: 'Tires', base: 400, max: 3 },
};
export function upgradeCost(kind, level) {
  return UPGRADES[kind].base * (level + 1);
}
export function carMaxHealth(upgrades) {
  return CAR.health + (upgrades?.armor || 0) * 50;
}
export function carMaxSpeed(upgrades) {
  return CAR.maxSpeed + (upgrades?.engine || 0) * 45;
}
export function carGrip(upgrades) {
  return CAR.grip + (upgrades?.tires || 0) * 0.9;
}

// Weapons: pistol is the starter; the SMG is bought at the gun shop.
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 1, fireRate: 0.28, bulletSpeed: 620, spread: 0.05, mag: Infinity },
  smg: { name: 'SMG', damage: 1, fireRate: 0.1, bulletSpeed: 720, spread: 0.12, mag: Infinity },
};
export const SMG_COST = 1500;
export const AMMO_COST = 100;
export const AMMO_PACK = 60;
export const START_AMMO = 120;

export const RADIO_STATIONS = ['Wave 98 · Synthwave', 'Funk Bay FM', 'Palm Coast Chill'];

export const PALETTE = {
  backdrop: '#8ec9e8',
  asphalt: '#5b6068',
  roadLine: '#f5d76e',
  sidewalk: '#c9c2b4',
  buildingA: '#f2b8a0',
  buildingB: '#a8d8c8',
  buildingC: '#f7d774',
  buildingD: '#f5a8c0',
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonAmber: '#ffb020',
  neonGreen: '#34d399',
  sand: '#f2ddab',
  water: '#2fb3c9',
  waterDeep: '#1d8fb0',
  park: '#7ec850',
  palmTrunk: '#8a6a45',
  palmLeaf: '#2f9e44',
  player: '#ffd23f',
  playerCar: '#e11d48',
  cop: '#1e40af',
  copLightR: '#ef4444',
  copLightB: '#3b82f6',
  traffic: '#e8e8e8',
  ped: '#334155',
  package: '#16a34a',
  text: '#16202b',
  muted: '#475569',
  panel: '#fff7e6',
  star: '#f59e0b',
  damage: '#dc2626',
  cash: '#15803d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best cash is kept between visits (this browser only). */
export const BEST_KEY = 'vice-bay.best';
/** Full save: cash, job, upgrades, respect, weapon, ammo (this browser only). */
export const SAVE_KEY = 'vice-bay-ii.save';
