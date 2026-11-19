// Vice Bay — tuning, palette and city layout in one place.
// The world is a 2560x1920 neon coastal city at night; the camera shows a
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

export const PLAYER_FOOT = { radius: 10, speed: 170 };

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

export const TRAFFIC = { count: 14, speed: 150, radius: 15 };
export const PEDS = { count: 18, speed: 55, radius: 8 };

export const WANTED_MAX = 5;
// Cops on the street per wanted star.
export const COPS_PER_STAR = [0, 1, 2, 3, 4, 5];

export const JOB_COUNT = 5;
export const JOB_TIME = 150; // seconds per job
export const GARAGE_REPAIR_COST = 200;
export const CAR_STEAL_WANTED = 1;

export const PALETTE = {
  backdrop: '#070a12',
  asphalt: '#23262e',
  roadLine: '#3a3f4d',
  sidewalk: '#2e3240',
  buildingA: '#1c2130',
  buildingB: '#252b3d',
  buildingC: '#31253a',
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonAmber: '#ffb020',
  neonGreen: '#34d399',
  sand: '#8a6f4d',
  water: '#0b2a4a',
  park: '#14301f',
  player: '#ffd23f',
  playerCar: '#ffd23f',
  cop: '#3b82f6',
  copLightR: '#ef4444',
  copLightB: '#3b82f6',
  traffic: '#9aa3b2',
  ped: '#e5e7eb',
  package: '#34d399',
  text: '#eef1f5',
  muted: '#9aa3b2',
  panel: '#141826',
  star: '#ffd23f',
  damage: '#ef4444',
  cash: '#34d399',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best cash is kept between visits (this browser only). */
export const BEST_KEY = 'vice-bay.best';
