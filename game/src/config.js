// Rustline: every tuning number, colour and place in one place.
// The world is a fixed 3000x2200 industrial city; the renderer shows a 1280x720 camera window.
export const WORLD = { width: 3000, height: 2200 };

// Road centrelines. Roads are 80 wide; buildings never sit on them.
export const ROADS_V = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_H = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 80;

// The river runs along the south edge; the docks sit on its bank.
export const RIVER_Y = 2050;

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 255,
  health: 100,
  regen: 3,
  regenDelay: 4,
  punchRange: 46,
  punchDamage: 25,
  shootRange: 430,
  shootDamage: 34,
  shootCooldown: 0.25,
};

export const CAR = {
  length: 46,
  width: 22,
  maxSpeed: 490,
  reverseSpeed: 170,
  accel: 330,
  brake: 520,
  steer: 3.2,
  grip: 3.2,
  // 220 takes a long 3-star chase to wear down — a Heat Wave run plus the
  // knocks from the earlier jobs — and there are fresh cars to steal.
  integrity: 220,
};

export const POLICE = {
  // Cops are a touch slower than a player's car (490), so a clean getaway is
  // possible — they catch you by numbers and ramming, not by raw speed.
  maxSpeed: 400,
  accel: 380,
  ramDamage: 3,
  ramCooldown: 1.4,
  bustRange: 30,
  bustTime: 1.2,
  // Fresh spawns arrive beyond the 520 px heat-decay range, so a player who
  // has outrun the chase actually gets the 12 s of quiet that drops a star.
  spawnDistance: 800,
  maxActive: 4,
};

export const WANTED = {
  max: 5,
  steal: 1,
  shootCop: 1,
  punchCop: 1,
  decaySeconds: 12,
  decayRange: 520,
};

// Cash the player starts with, and what each job pays.
export const START_CASH = 150;
export const MISSION_PAY = [400, 600, 800, 1000, 2500];
export const BUST_FINE = 100;

export const SAVE_KEY = 'rustline.save.v1';
export const BEST_KEY = 'rustline.best';

export const PALETTE = {
  backdrop: '#0d0f12',
  ground: '#3a3f45',
  groundFoundry: '#413c34',
  groundYards: '#373d38',
  groundRiverside: '#3c4148',
  road: '#23262b',
  roadLine: '#c8a84a',
  sidewalk: '#4a4f56',
  river: '#1d3a4a',
  building: '#5b4a38',
  building2: '#4a5560',
  building3: '#6b5a44',
  roof: '#2e2a24',
  player: '#e8b93c',
  playerCar: '#d97b2b',
  traffic: '#7d8a99',
  parked: '#9a8a6a',
  police: '#20242a',
  policeLightR: '#ff2e2e',
  policeLightB: '#2e6bff',
  truck: '#3f5a3a',
  marker: '#ffd94a',
  markerRing: '#ffffff',
  ped: '#c9a0a0',
  text: '#f2ede4',
  muted: '#a9a294',
  panel: '#1c1e22',
  star: '#ffd94a',
  health: '#57c465',
  healthLow: '#e5534b',
  night: 'rgba(8, 10, 26, 0.16)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Named places. All sit on roads so the playtest and the player can reach them.
export const PLACES = {
  garage: { name: "Marlowe's Garage", x: 700, y: 300 },
  chopShop: { name: "Rusty's Chop Shop", x: 700, y: 1000 },
  railYard: { name: 'Rail Yard', x: 2700, y: 300 },
  docks: { name: 'The Docks', x: 300, y: 1900 },
  safehouse: { name: 'Safehouse', x: 700, y: 300 },
  depot: { name: 'Depot', x: 1500, y: 1100 },
  truckStart: { name: 'Armored Truck', x: 300, y: 1100 },
  deliveries: [
    { name: 'Northside Drop', x: 1900, y: 300 },
    { name: 'Foundry Drop', x: 300, y: 1500 },
    { name: 'Flats Drop', x: 2300, y: 1900 },
  ],
};

// Where the player starts, on foot, and the first car to steal (same road, just south).
export const SPAWN = { x: 700, y: 500 };
export const FIRST_CAR = { x: 700, y: 640, angle: Math.PI / 2, color: '#d97b2b' };

export const DISTRICTS = [
  { name: 'Old Mill', x0: 0, y0: 0, x1: 1100, y1: 700 },
  { name: 'Northside', x0: 1100, y0: 0, x1: 1900, y1: 700 },
  { name: 'The Yards', x0: 1900, y0: 0, x1: 3000, y1: 700 },
  { name: 'Foundry', x0: 0, y0: 700, x1: 1100, y1: 1500 },
  { name: 'Depot', x0: 1100, y0: 700, x1: 1900, y1: 1500 },
  { name: 'Junction', x0: 1900, y0: 700, x1: 3000, y1: 1500 },
  { name: 'Riverside', x0: 0, y0: 1500, x1: 3000, y1: 2200 },
];
