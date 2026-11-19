// Vice Bay II rules and state, with no drawing and no browser in it: the player's
// car and on-foot body, cop cars, the police helicopter, roadblocks, gang
// shooters, traffic, pedestrians, the city, the ten jobs, the wanted level,
// cash, respect, weapons, upgrades and the camera. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. Nothing here allocates after
// createWorld returns (bullets and gang shooters reuse fixed pools).
import {
  AMMO_COST, AMMO_PACK, BEACH_Y, CAR, CAR_STEAL_WANTED, COP, COPS_PER_STAR, GARAGE_REPAIR_COST,
  HELI, JOB_COUNT, JOB_TIME, PEDS, PLAYER_FOOT, ROADS_X, ROADS_Y, ROAD_W, SMG_COST, START_AMMO,
  STEP, TRAFFIC, UPGRADES, WANTED_MAX, WEAPONS, WORLD, carGrip, carMaxHealth, carMaxSpeed,
  upgradeCost,
} from './config.js';
import { createCity, insideBuilding, onRoad, resolveBuildings } from './city.js';
import { JOBS } from './missions.js';

export const EVENT_PICKUP = 1;
export const EVENT_DELIVER = 2;
export const EVENT_BUSTED = 4;
export const EVENT_WRECKED = 8;
export const EVENT_WIN = 16;
export const EVENT_HIT = 32;
export const EVENT_JOB = 64;
export const EVENT_STEAL = 128;
export const EVENT_SHOOT = 256;
export const EVENT_KILL = 512;
export const EVENT_SAVE = 1024;

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v < hi ? v : hi;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment a->b is not blocked by a building (sampled). */
function lineOfSight(city, ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(d / 24));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (insideBuilding(city, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

export function createWorld(random) {
  const city = createCity(random);

  // The player's car (one object, reused when a car is stolen).
  const playerCar = { x: 0, y: 0, angle: 0, vx: 0, vy: 0, health: CAR.health, radius: CAR.radius };
  const player = { x: 0, y: 0, angle: -Math.PI / 2, inCar: true, bustedTimer: 0, radius: PLAYER_FOOT.radius };

  const cops = [];
  for (let i = 0; i < COPS_PER_STAR[WANTED_MAX]; i += 1) {
    cops.push({ active: false, x: 0, y: 0, angle: 0, vx: 0, vy: 0, radius: COP.radius, seen: false });
  }
  const traffic = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    traffic.push({ active: false, x: 0, y: 0, angle: 0, vx: 0, vy: 0, speed: 0, vertical: true, dir: 1, radius: TRAFFIC.radius, color: 0 });
  }
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    peds.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, down: 0, scatter: 0, radius: PEDS.radius });
  }
  // Gang shooters guarding two pickups (fixed pool, reused per job).
  const gang = [];
  for (let i = 0; i < 3; i += 1) {
    gang.push({ active: false, x: 0, y: 0, angle: 0, health: 3, shootTimer: 1, radius: 12 });
  }
  // Bullets, player and gang alike (fixed pool).
  const bullets = [];
  for (let i = 0; i < 24; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, fromGang: false });
  }
  // Roadblock cars (fixed pool of two).
  const roadblocks = [];
  for (let i = 0; i < 2; i += 1) {
    roadblocks.push({ active: false, x: 0, y: 0, angle: 0, radius: 16, vx: 0, vy: 0 });
  }

  const state = {
    city,
    player,
    playerCar,
    cops,
    traffic,
    peds,
    gang,
    bullets,
    roadblocks,
    heli: { active: false, x: 0, y: 0, angle: 0, rotor: 0, locked: false },
    wanted: 0,
    unseenTimer: 0,
    cash: 0,
    respect: 0,
    jobIndex: 0,
    jobStage: 'pickup', // 'pickup' | 'deliver' | 'done'
    jobTimer: JOB_TIME,
    hasPackage: false,
    message: '',
    messageTimer: 0,
    camera: { x: 0, y: 0 },
    elapsed: 0,
    busted: false,
    wrecked: false,
    won: false,
    // v5: combat, upgrades, radio, save.
    weapon: 'pistol',
    ammo: START_AMMO,
    playerHealth: PLAYER_FOOT.health,
    upgrades: { engine: 0, armor: 0, tires: 0 },
    radio: 0,
    fireTimer: 0,
    muzzle: 0,
    saveFlash: 0,
    lastHurt: -99,
    roadblockTimer: 0,
    heatWarnTimer: 0,
  };

  function spawnTrafficCar(t) {
    // Pick a road and a direction, put the car on it away from the player.
    const vertical = random() < 0.5;
    t.vertical = vertical;
    t.dir = random() < 0.5 ? 1 : -1;
    if (vertical) {
      const cx = ROADS_X[Math.floor(random() * ROADS_X.length)];
      t.x = cx + (random() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4);
      t.y = 60 + random() * (WORLD.height - 220);
      t.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const cy = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      t.y = cy + (random() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4);
      t.x = 60 + random() * (WORLD.width - 120);
      t.angle = t.dir > 0 ? 0 : Math.PI;
    }
    t.speed = TRAFFIC.speed * (0.85 + random() * 0.3);
    t.vx = Math.cos(t.angle) * t.speed;
    t.vy = Math.sin(t.angle) * t.speed;
    t.color = Math.floor(random() * 4);
    t.active = true;
  }

  function spawnPed(p) {
    // Walk a sidewalk beside a road.
    const vertical = random() < 0.5;
    if (vertical) {
      const cx = ROADS_X[Math.floor(random() * ROADS_X.length)];
      p.x = cx + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      p.y = 60 + random() * (WORLD.height - 220);
      p.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const cy = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      p.y = cy + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      p.x = 60 + random() * (WORLD.width - 120);
      p.angle = random() < 0.5 ? 0 : Math.PI;
    }
    p.speed = PEDS.speed * (0.8 + random() * 0.4);
    p.down = 0;
    p.scatter = 0;
    p.active = true;
  }

  function spawnCop(c) {
    // Appear on a road near (but not on top of) the player, already moving.
    const px = player.inCar ? playerCar.x : player.x;
    const py = player.inCar ? playerCar.y : player.y;
    let x = px;
    let y = py;
    for (let tries = 0; tries < 12; tries += 1) {
      const road = ROADS_X[Math.floor(random() * ROADS_X.length)];
      const roadY = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      if (random() < 0.5) { x = road; y = clamp(py + (random() - 0.5) * 900, 80, WORLD.height - 80); }
      else { x = clamp(px + (random() - 0.5) * 900, 80, WORLD.width - 80); y = roadY; }
      if (dist(x, y, px, py) > 320) break;
    }
    c.x = x;
    c.y = y;
    c.angle = Math.atan2(py - y, px - x);
    c.vx = 0;
    c.vy = 0;
    // Dispatched to the player's last known spot: it starts the chase hot.
    c.seen = true;
    c.active = true;
  }

  function spawnGang(job) {
    // Three shooters in a loose ring around the pickup.
    for (let i = 0; i < gang.length; i += 1) {
      const g = gang[i];
      const a = (i / gang.length) * TAU + 0.5;
      g.x = job.pickup.x + Math.cos(a) * 110;
      g.y = job.pickup.y + Math.sin(a) * 110;
      if (insideBuilding(city, g.x, g.y)) { g.x = job.pickup.x + Math.cos(a) * 70; g.y = job.pickup.y + Math.sin(a) * 70; }
      g.angle = Math.atan2(player.y - g.y, player.x - g.x);
      g.health = 3;
      g.shootTimer = 0.8 + i * 0.5;
      g.active = true;
    }
  }

  function fireBullet(x, y, angle, fromGang) {
    for (const b of bullets) {
      if (b.active) continue;
      const speed = fromGang ? 380 : WEAPONS[state.weapon].bulletSpeed;
      const spread = fromGang ? 0.08 : WEAPONS[state.weapon].spread;
      const a = angle + (random() - 0.5) * 2 * spread;
      b.x = x + Math.cos(angle) * 20;
      b.y = y + Math.sin(angle) * 20;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
      b.life = 1.1;
      b.fromGang = fromGang;
      b.active = true;
      return true;
    }
    return false;
  }

  function reset() {
    state.wanted = 0;
    state.unseenTimer = 0;
    state.cash = 0;
    state.respect = 0;
    state.jobIndex = 0;
    state.jobStage = 'pickup';
    state.jobTimer = JOB_TIME;
    state.hasPackage = false;
    state.elapsed = 0;
    state.busted = false;
    state.wrecked = false;
    state.won = false;
    state.weapon = 'pistol';
    state.ammo = START_AMMO;
    state.playerHealth = PLAYER_FOOT.health;
    state.upgrades = { engine: 0, armor: 0, tires: 0 };
    state.radio = 0;
    state.fireTimer = 0;
    state.muzzle = 0;
    state.saveFlash = 0;
    state.lastHurt = -99;
    state.roadblockTimer = 0;
    state.heatWarnTimer = 0;
    state.heli.active = false;
    state.heli.locked = false;
    for (const g of gang) g.active = false;
    for (const b of bullets) b.active = false;
    for (const r of roadblocks) r.active = false;
    state.message = JOBS[0].fixer;
    state.messageTimer = 6;
    playerCar.x = city.locations.safehouse.x;
    playerCar.y = city.locations.safehouse.y + 40;
    playerCar.angle = Math.PI / 2;
    playerCar.vx = 0;
    playerCar.vy = 0;
    playerCar.health = carMaxHealth(state.upgrades);
    player.x = playerCar.x;
    player.y = playerCar.y;
    player.angle = -Math.PI / 2;
    player.inCar = true;
    player.bustedTimer = 0;
    for (const c of cops) c.active = false;
    for (const t of traffic) spawnTrafficCar(t);
    for (const p of peds) spawnPed(p);
    updateCamera();
  }

  function updateCamera() {
    const px = player.inCar ? playerCar.x : player.x;
    const py = player.inCar ? playerCar.y : player.y;
    state.camera.x = clamp(px - 640, 0, WORLD.width - 1280);
    state.camera.y = clamp(py - 360, 0, WORLD.height - 720);
  }

  function stepCarBody(b, dt, steer, throttle, handbrake, spec) {
    const fx = Math.cos(b.angle);
    const fy = Math.sin(b.angle);
    let engine = 0;
    if (throttle > 0) engine = spec.accel;
    else if (throttle < 0) {
      const fwdSpeed = b.vx * fx + b.vy * fy;
      engine = fwdSpeed > 30 ? -CAR.brake : -CAR.reverseAccel;
    }
    b.vx += fx * engine * dt;
    b.vy += fy * engine * dt;
    const dragF = Math.max(0, 1 - spec.drag * dt);
    b.vx *= dragF;
    b.vy *= dragF;
    // Steering: turn rate grows with speed, and only while moving.
    const fwdBefore = b.vx * fx + b.vy * fy;
    const turn = steer * spec.turnRate * Math.min(1, Math.abs(fwdBefore) / 120) * dt * (fwdBefore < 0 ? -1 : 1);
    b.angle += turn;
    // Grip: bleed the sideways velocity toward the heading (handbrake = drift).
    const nx = Math.cos(b.angle);
    const ny = Math.sin(b.angle);
    const fwd = b.vx * nx + b.vy * ny;
    const latX = b.vx - nx * fwd;
    const latY = b.vy - ny * fwd;
    const gripF = Math.max(0, 1 - (handbrake ? CAR.driftGrip : spec.grip) * dt);
    b.vx = nx * fwd + latX * gripF;
    b.vy = ny * fwd + latY * gripF;
    // Clamp the forward speed.
    const fwdAfter = b.vx * nx + b.vy * ny;
    if (fwdAfter > spec.maxSpeed) {
      const k = spec.maxSpeed / fwdAfter;
      b.vx *= k;
      b.vy *= k;
    } else if (fwdAfter < -CAR.maxReverse) {
      const k = -CAR.maxReverse / fwdAfter;
      b.vx *= k;
      b.vy *= k;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Keep inside the world (the beach is a wall for cars).
    b.x = clamp(b.x, 24, WORLD.width - 24);
    b.y = clamp(b.y, 24, BEACH_Y - 24);
  }

  function collideCars(a, b, damageToA, damageToB) {
    // Bodies without a velocity (plain points) count as standing still.
    if (a.vx === undefined) a.vx = 0;
    if (a.vy === undefined) a.vy = 0;
    if (b.vx === undefined) b.vx = 0;
    if (b.vy === undefined) b.vy = 0;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const min = a.radius + b.radius;
    if (d >= min || d < 0.001) return 0;
    const nx = dx / d;
    const ny = dy / d;
    const push = (min - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
    // Swap a share of the along-line velocity (a cheap bounce).
    const aAlong = a.vx * nx + a.vy * ny;
    const bAlong = b.vx * nx + b.vy * ny;
    const swap = (aAlong - bAlong) * 0.5;
    a.vx -= nx * swap;
    a.vy -= ny * swap;
    b.vx += nx * swap;
    b.vy += ny * swap;
    if (damageToA !== null && rel > 120) damageToA(Math.min(20, (rel - 120) / 18));
    if (damageToB !== null && rel > 120) damageToB(Math.min(20, (rel - 120) / 18));
    return rel;
  }

  function damagePlayer(amount) {
    playerCar.health = Math.max(0, playerCar.health - amount);
    return playerCar.health <= 0;
  }

  function hurtPlayer(amount) {
    state.playerHealth = Math.max(0, state.playerHealth - amount);
    state.lastHurt = state.elapsed;
    return state.playerHealth <= 0;
  }

  function setMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function currentJob() {
    return JOBS[state.jobIndex];
  }

  function startJob(index) {
    state.jobIndex = index;
    state.jobStage = 'pickup';
    state.jobTimer = JOBS[index].time ?? JOB_TIME;
    state.hasPackage = false;
    for (const g of gang) g.active = false;
    if (JOBS[index].guarded) spawnGang(JOBS[index]);
    if (JOBS[index].heatStart) {
      state.wanted = Math.min(WANTED_MAX, JOBS[index].heatStart);
      setMessage(`${JOBS[index].fixer} Lose the heat first!`, 6);
    } else {
      setMessage(JOBS[index].fixer, 6);
    }
  }

  /** Buy one garage upgrade level; returns true when the purchase landed. */
  function buyUpgrade(kind) {
    const level = state.upgrades[kind];
    if (level === undefined || level >= UPGRADES[kind].max) return false;
    const cost = upgradeCost(kind, level);
    if (state.cash < cost) return false;
    state.cash -= cost;
    state.upgrades[kind] = level + 1;
    if (kind === 'armor') playerCar.health = carMaxHealth(state.upgrades);
    setMessage(`${UPGRADES[kind].name} upgraded to Lv${level + 1}. -$${cost}.`, 4);
    return true;
  }

  function buyWeapon() {
    if (state.weapon === 'smg') return false;
    if (state.cash < SMG_COST) return false;
    state.cash -= SMG_COST;
    state.weapon = 'smg';
    state.ammo += 120;
    setMessage(`SMG bought. +120 ammo. -$${SMG_COST}.`, 4);
    return true;
  }

  function buyAmmo() {
    if (state.cash < AMMO_COST) return false;
    state.cash -= AMMO_COST;
    state.ammo += AMMO_PACK;
    setMessage(`Ammo +${AMMO_PACK}. -$${AMMO_COST}.`, 3);
    return true;
  }

  function cycleRadio() {
    state.radio = (state.radio + 1) % 3;
    return state.radio;
  }

  /** Plain-data snapshot for localStorage saves. */
  function saveData() {
    return {
      cash: state.cash,
      jobIndex: state.jobIndex,
      upgrades: { ...state.upgrades },
      respect: state.respect,
      weapon: state.weapon,
      ammo: state.ammo,
      best: Math.max(0, state.cash),
    };
  }

  /** Restore a save snapshot (after reset): job, cash, upgrades, respect, gear. */
  function applySave(data) {
    if (!data || typeof data !== 'object') return false;
    state.cash = Number(data.cash) || 0;
    state.respect = Number(data.respect) || 0;
    state.weapon = data.weapon === 'smg' ? 'smg' : 'pistol';
    state.ammo = Number(data.ammo) || START_AMMO;
    if (data.upgrades) {
      for (const k of ['engine', 'armor', 'tires']) {
        state.upgrades[k] = Math.max(0, Math.min(3, Number(data.upgrades[k]) || 0));
      }
    }
    playerCar.health = carMaxHealth(state.upgrades);
    const index = Math.max(0, Math.min(JOB_COUNT - 1, Number(data.jobIndex) || 0));
    state.jobIndex = index;
    state.jobStage = 'pickup';
    state.jobTimer = JOBS[index].time ?? JOB_TIME;
    state.hasPackage = false;
    for (const g of gang) g.active = false;
    if (JOBS[index].guarded) spawnGang(JOBS[index]);
    setMessage(`Back in Vice Bay. ${JOBS[index].name} — pick up the package.`, 5);
    return true;
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.muzzle > 0) state.muzzle -= dt;
    if (state.saveFlash > 0) state.saveFlash -= dt;
    if (state.fireTimer > 0) state.fireTimer -= dt;
    if (state.heatWarnTimer > 0) state.heatWarnTimer -= dt;

    const job = currentJob();
    const maxHealth = carMaxHealth(state.upgrades);

    // --- Player: drive, walk, enter/exit, steal, repair ---
    if (player.inCar) {
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      const speedBefore = Math.hypot(playerCar.vx, playerCar.vy);
      stepCarBody(playerCar, dt, steer, throttle, input.handbrake, {
        accel: CAR.accel, drag: CAR.drag, turnRate: CAR.turnRate,
        grip: carGrip(state.upgrades), maxSpeed: carMaxSpeed(state.upgrades),
      });
      if (resolveBuildings(city, playerCar)) {
        const impact = speedBefore;
        if (impact > 220) {
          if (damagePlayer(Math.min(22, (impact - 220) / 16))) { state.wrecked = true; events |= EVENT_WRECKED; }
          events |= EVENT_HIT;
        }
        playerCar.vx *= 0.45;
        playerCar.vy *= 0.45;
      }
      // Traffic and cops bump the player car.
      for (const t of traffic) {
        if (!t.active) continue;
        collideCars(playerCar, t, (d) => { if (damagePlayer(d)) { state.wrecked = true; events |= EVENT_WRECKED; } }, null);
      }
      for (const c of cops) {
        if (!c.active) continue;
        const rel = collideCars(playerCar, c, (d) => { if (damagePlayer(d)) { state.wrecked = true; events |= EVENT_WRECKED; } }, null);
        if (rel > 200) events |= EVENT_HIT;
      }
      // Roadblocks are parked: hitting one hurts.
      for (const r of roadblocks) {
        if (!r.active) continue;
        const rel = collideCars(playerCar, r, (d) => { if (damagePlayer(d)) { state.wrecked = true; events |= EVENT_WRECKED; } }, null);
        if (rel > 160) events |= EVENT_HIT;
      }
      // Exit the car.
      if (input.action) {
        player.inCar = false;
        player.x = playerCar.x + Math.cos(playerCar.angle + Math.PI / 2) * 30;
        player.y = playerCar.y + Math.sin(playerCar.angle + Math.PI / 2) * 30;
        player.angle = playerCar.angle;
        if (insideBuilding(city, player.x, player.y)) { player.x = playerCar.x; player.y = playerCar.y; }
      }
      // Garage repair (press E near the garage while stopped-ish).
      const g = city.locations.garage;
      if (input.action && dist(playerCar.x, playerCar.y, g.x, g.y) < 110 && playerCar.health < maxHealth && state.cash >= GARAGE_REPAIR_COST) {
        playerCar.health = maxHealth;
        state.cash -= GARAGE_REPAIR_COST;
        state.wanted = Math.max(0, state.wanted - 2);
        setMessage('Garage: car repaired, heat dropped. -$200.', 4);
      }
      // Safehouse: park here and the heat melts away while the car heals free.
      const sh = city.locations.safehouse;
      if (dist(playerCar.x, playerCar.y, sh.x, sh.y) < 130) {
        if (playerCar.health < maxHealth) playerCar.health = Math.min(maxHealth, playerCar.health + 3 * dt);
        state.unseenTimer += dt * 2;
      }
    } else {
      // On foot: walk with the same keys.
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        player.x += (mx / len) * PLAYER_FOOT.speed * dt;
        player.y += (my / len) * PLAYER_FOOT.speed * dt;
        player.angle = Math.atan2(my, mx);
      }
      player.x = clamp(player.x, 16, WORLD.width - 16);
      player.y = clamp(player.y, 16, WORLD.height - 16);
      resolveBuildings(city, player);
      // Aim where the mouse points; click to shoot.
      if (input.aimAngle !== undefined && input.aimAngle !== null) {
        player.angle = input.aimAngle;
      }
      if (input.shoot && state.fireTimer <= 0 && state.ammo > 0) {
        if (fireBullet(player.x, player.y, player.angle, false)) {
          state.ammo -= 1;
          state.fireTimer = WEAPONS[state.weapon].fireRate;
          state.muzzle = 0.12;
          events |= EVENT_SHOOT;
        }
      }
      // Slow health regen when out of trouble for a while.
      if (state.elapsed - state.lastHurt > 6 && state.playerHealth < PLAYER_FOOT.health) {
        state.playerHealth = Math.min(PLAYER_FOOT.health, state.playerHealth + 3 * dt);
      }
      // Pick up the package on foot.
      if (state.jobStage === 'pickup' && !state.hasPackage && dist(player.x, player.y, job.pickup.x, job.pickup.y) < 52) {
        if (job.heatStart && state.wanted > 0) {
          if (state.heatWarnTimer <= 0) {
            setMessage('Too hot! Lose the heat first, then grab it.', 3);
            state.heatWarnTimer = 3;
          }
        } else {
          state.hasPackage = true;
          state.jobStage = 'deliver';
          setMessage('Package grabbed. Get to the drop-off — fast.', 4);
          events |= EVENT_PICKUP;
          // A cop watching the grab adds heat.
          for (const c of cops) {
            if (c.active && c.seen) { state.wanted = Math.min(WANTED_MAX, state.wanted + 1); break; }
          }
        }
      }
      // Re-enter the player's car, or steal a traffic car.
      if (input.action) {
        if (dist(player.x, player.y, playerCar.x, playerCar.y) < 56) {
          player.inCar = true;
        } else {
          for (const t of traffic) {
            if (t.active && dist(player.x, player.y, t.x, t.y) < 56) {
              t.active = false;
              playerCar.x = t.x;
              playerCar.y = t.y;
              playerCar.angle = t.angle;
              playerCar.vx = Math.cos(t.angle) * t.speed;
              playerCar.vy = Math.sin(t.angle) * t.speed;
              playerCar.health = maxHealth;
              player.inCar = true;
              state.wanted = Math.min(WANTED_MAX, state.wanted + CAR_STEAL_WANTED);
              setMessage('Car stolen. The cops noticed.', 4);
              events |= EVENT_STEAL;
              break;
            }
          }
        }
      }
    }

    // --- Bullets: fly, hit buildings, gang, or the player ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height || insideBuilding(city, b.x, b.y)) {
        b.active = false;
        continue;
      }
      if (!b.fromGang) {
        for (const g of gang) {
          if (g.active && dist(b.x, b.y, g.x, g.y) < g.radius + 4) {
            g.health -= WEAPONS[state.weapon].damage;
            b.active = false;
            if (g.health <= 0) {
              g.active = false;
              state.respect += 2;
              events |= EVENT_KILL;
              setMessage('Gang shooter down. +2 respect.', 2);
            }
            break;
          }
        }
      } else if (!player.inCar && dist(b.x, b.y, player.x, player.y) < player.radius + 4) {
        b.active = false;
        if (hurtPlayer(8)) {
          state.busted = true;
          events |= EVENT_BUSTED;
        }
      }
    }

    // --- Gang shooters: stand their ground, shoot at the player on foot ---
    for (const g of gang) {
      if (!g.active) continue;
      g.shootTimer -= dt;
      const d = dist(g.x, g.y, player.x, player.y);
      if (!player.inCar && d < 460) {
        g.angle = Math.atan2(player.y - g.y, player.x - g.x);
        if (g.shootTimer <= 0 && lineOfSight(city, g.x, g.y, player.x, player.y)) {
          fireBullet(g.x, g.y, g.angle, true);
          g.shootTimer = 1.5 + random() * 0.6;
        }
      }
    }

    // --- Delivery ---
    if (state.hasPackage && state.jobStage === 'deliver') {
      const px = player.inCar ? playerCar.x : player.x;
      const py = player.inCar ? playerCar.y : player.y;
      if (dist(px, py, job.drop.x, job.drop.y) < 78) {
        const late = state.jobTimer <= 0;
        const pay = late ? Math.floor(job.pay / 2) : job.pay + Math.floor(state.jobTimer * 4);
        state.cash += pay;
        state.respect += 10;
        state.hasPackage = false;
        events |= EVENT_DELIVER;
        events |= EVENT_SAVE;
        state.saveFlash = 2;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.jobIndex + 1 >= JOB_COUNT) {
          state.jobStage = 'done';
          state.won = true;
          events |= EVENT_WIN;
          setMessage(`Delivered! +$${pay}. That was the last job — you own this city.`, 8);
        } else {
          startJob(state.jobIndex + 1);
          setMessage(`Delivered! +$${pay} · +10 respect. ${JOBS[state.jobIndex].name}`, 5);
        }
      }
    }
    // Job clock (only counts down while a job is active).
    if (state.jobStage !== 'done') {
      state.jobTimer -= dt;
      if (state.jobTimer <= 0 && state.jobTimer + dt > 0) {
        // Deadline missed: the package is lost, the job restarts.
        state.hasPackage = false;
        state.jobStage = 'pickup';
        state.jobTimer = JOBS[state.jobIndex].time ?? JOB_TIME;
        setMessage('Too slow — the buyer walked. The fixer re-lists the job.', 5);
      }
    }

    // --- Wanted: cops spawn, chase, lose sight ---
    const wantCops = COPS_PER_STAR[state.wanted];
    let activeCops = 0;
    for (const c of cops) if (c.active) activeCops += 1;
    for (const c of cops) {
      if (activeCops >= wantCops) break;
      if (!c.active) { spawnCop(c); activeCops += 1; }
    }
    if (activeCops > wantCops) {
      for (const c of cops) {
        if (activeCops <= wantCops) break;
        if (c.active) { c.active = false; activeCops -= 1; }
      }
    }
    const px = player.inCar ? playerCar.x : player.x;
    const py = player.inCar ? playerCar.y : player.y;
    let anyoneSees = false;
    for (const c of cops) {
      if (!c.active) continue;
      // Chase: steer toward the player, always accelerating.
      const want = Math.atan2(py - c.y, px - c.x);
      const diff = angleDiff(want, c.angle);
      const steer = diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0;
      stepCarBody(c, dt, steer, 1, false, { accel: COP.accel, drag: COP.drag, turnRate: COP.turnRate, grip: COP.grip, maxSpeed: COP.maxSpeed });
      resolveBuildings(city, c);
      // Sight: in range and no building in the way.
      const d = dist(c.x, c.y, px, py);
      c.seen = d < COP.sightRange && lineOfSight(city, c.x, c.y, px, py);
      if (c.seen) anyoneSees = true;
      // Ram damage is handled by collideCars with the player above; cops also
      // bump each other and traffic lightly.
      for (const o of cops) {
        if (o !== c && o.active) collideCars(c, o, null, null);
      }
    }

    // --- Helicopter at 4–5 stars: follows, spotlight, keeps you seen ---
    const heli = state.heli;
    if (state.wanted >= 4 || heli.locked) {
      if (!heli.active) {
        heli.active = true;
        heli.x = px;
        heli.y = py - 260;
        heli.angle = 0;
      }
      // It hovers off to the side of the player (never exactly on top of the
      // car), spotlight on them. A locked heli (screenshot staging) stays put.
      const tx = heli.locked ? heli.x : px - 130;
      const ty = heli.locked ? heli.y : py - 130;
      const want = Math.atan2(ty - heli.y, tx - heli.x);
      heli.angle = want;
      const hd = dist(heli.x, heli.y, tx, ty);
      const hSpeed = Math.min(HELI.speed, hd * 1.2);
      heli.x += Math.cos(want) * hSpeed * dt;
      heli.y += Math.sin(want) * hSpeed * dt;
      heli.rotor += dt * 28;
      if (dist(heli.x, heli.y, px, py) < HELI.sightRange) anyoneSees = true; // spotlight: no hiding while it is overhead
    } else if (heli.active) {
      heli.active = false;
    }

    // --- Roadblocks at 3+ stars: two parked cop cars across the road ahead ---
    if (state.wanted >= 3) {
      state.roadblockTimer -= dt;
      if (state.roadblockTimer <= 0) {
        state.roadblockTimer = 2;
        // Ahead of the player, on the nearest road in the direction of travel.
        const heading = player.inCar ? playerCar.angle : player.angle;
        const ax = px + Math.cos(heading) * 420;
        const ay = py + Math.sin(heading) * 420;
        const onVertical = Math.abs(Math.cos(heading)) < Math.abs(Math.sin(heading));
        let bx;
        let by;
        if (onVertical) {
          bx = ROADS_X.reduce((best, v) => (Math.abs(v - ax) < Math.abs(best - ax) ? v : best), ROADS_X[0]);
          by = clamp(ay, 120, BEACH_Y - 120);
        } else {
          by = ROADS_Y.reduce((best, v) => (Math.abs(v - ay) < Math.abs(best - ay) ? v : best), ROADS_Y[0]);
          bx = clamp(ax, 120, WORLD.width - 120);
        }
        const perp = onVertical ? 0 : Math.PI / 2;
        for (let i = 0; i < 2; i += 1) {
          const r = roadblocks[i];
          r.active = true;
          r.x = bx + Math.cos(perp) * (i === 0 ? -34 : 34);
          r.y = by + Math.sin(perp) * (i === 0 ? -34 : 34);
          r.angle = perp;
        }
      }
    } else {
      for (const r of roadblocks) r.active = false;
    }

    if (anyoneSees) state.unseenTimer = 0;
    else if (state.wanted > 0) {
      // Heat only drops once the player is truly away: no cop close by and
      // none with eyes on them. A cop on your tail keeps you hot.
      let nearest = Infinity;
      for (const c of cops) {
        if (!c.active) continue;
        const d = dist(c.x, c.y, px, py);
        if (d < nearest) nearest = d;
      }
      if (nearest < 420) {
        state.unseenTimer = 0;
      } else {
        state.unseenTimer += dt;
        if (state.unseenTimer >= COP.loseSightSeconds) {
          state.wanted -= 1;
          state.unseenTimer = 0;
          setMessage('You lost them. Heat down.', 3);
        }
      }
    }

    // --- Busted: on foot, a cop close by for 1.5 s ---
    if (!player.inCar && state.wanted > 0) {
      let close = false;
      for (const c of cops) {
        if (c.active && dist(c.x, c.y, player.x, player.y) < 46) { close = true; break; }
      }
      if (close) {
        player.bustedTimer += dt;
        if (player.bustedTimer >= 1.5) {
          state.busted = true;
          events |= EVENT_BUSTED;
        }
      } else player.bustedTimer = 0;
    } else player.bustedTimer = 0;

    // --- Traffic: drive the grid, turn at intersections, stop for trouble ahead ---
    for (const t of traffic) {
      if (!t.active) continue;
      // A car right ahead: slow down.
      let blocked = false;
      const ax = t.x + Math.cos(t.angle) * 46;
      const ay = t.y + Math.sin(t.angle) * 46;
      if (dist(ax, ay, playerCar.x, playerCar.y) < 34 && player.inCar) blocked = true;
      if (!blocked) {
        for (const o of traffic) {
          if (o !== t && o.active && dist(ax, ay, o.x, o.y) < 34) { blocked = true; break; }
        }
      }
      const speed = blocked ? 0 : t.speed;
      t.x += Math.cos(t.angle) * speed * dt;
      t.y += Math.sin(t.angle) * speed * dt;
      // At an intersection, sometimes turn onto the cross road.
      const nearX = ROADS_X.find((cx) => Math.abs(t.x - cx) < 6);
      const nearY = ROADS_Y.find((cy) => Math.abs(t.y - cy) < 6);
      if (t.vertical && nearY !== undefined && random() < 0.012) {
        t.vertical = false;
        t.dir = random() < 0.5 ? 1 : -1;
        t.angle = t.dir > 0 ? 0 : Math.PI;
        t.y = nearY + (random() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4);
      } else if (!t.vertical && nearX !== undefined && random() < 0.012) {
        t.vertical = true;
        t.dir = random() < 0.5 ? 1 : -1;
        t.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        t.x = nearX + (random() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4);
      }
      // World edge: turn around.
      if (t.x < 40 || t.x > WORLD.width - 40 || t.y < 40 || t.y > BEACH_Y - 40) {
        t.angle += Math.PI;
        t.dir = -t.dir;
        t.x = clamp(t.x, 40, WORLD.width - 40);
        t.y = clamp(t.y, 40, BEACH_Y - 40);
      }
      // Keep the velocity fields in sync — collideCars reads them.
      t.vx = Math.cos(t.angle) * speed;
      t.vy = Math.sin(t.angle) * speed;
      resolveBuildings(city, t);
    }
    // A traffic car that drifted off its road (after a collision) gets put back.
    for (const t of traffic) {
      if (t.active && !onRoad(t.x, t.y) && !insideBuilding(city, t.x, t.y)) {
        // It is on a sidewalk or plaza: nudge it back toward its road.
        const cx = ROADS_X.reduce((best, v) => (Math.abs(v - t.x) < Math.abs(best - t.x) ? v : best), ROADS_X[0]);
        const cy = ROADS_Y.reduce((best, v) => (Math.abs(v - t.y) < Math.abs(best - t.y) ? v : best), ROADS_Y[0]);
        if (t.vertical) t.x += Math.sign(cx - t.x) * 40 * dt;
        else t.y += Math.sign(cy - t.y) * 40 * dt;
      }
    }

    // --- Pedestrians: stroll the sidewalks, scatter from cars ---
    for (const p of peds) {
      if (!p.active) continue;
      if (p.down > 0) {
        p.down -= dt;
        if (p.down <= 0) spawnPed(p);
        continue;
      }
      // Scatter when a car is close.
      let threatX = 0;
      let threatY = 0;
      let threat = false;
      const cars = player.inCar ? [playerCar, ...cops.filter((c) => c.active)] : cops.filter((c) => c.active);
      for (const car of cars) {
        if (dist(car.x, car.y, p.x, p.y) < 80) { threat = true; threatX = car.x; threatY = car.y; break; }
      }
      if (threat) {
        const away = Math.atan2(p.y - threatY, p.x - threatX);
        p.angle = away;
        p.x += Math.cos(away) * p.speed * 2.2 * dt;
        p.y += Math.sin(away) * p.speed * 2.2 * dt;
      } else {
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
      }
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, BEACH_Y - 20);
      if (insideBuilding(city, p.x, p.y)) spawnPed(p);
      // Hit by the player's car: down, and heat if it was seen.
      if (player.inCar && dist(p.x, p.y, playerCar.x, playerCar.y) < playerCar.radius + p.radius) {
        p.down = 3;
        state.wanted = Math.min(WANTED_MAX, state.wanted + 1);
        setMessage('You hit a pedestrian. The city saw that.', 3);
      }
    }

    updateCamera();
    return events;
  }

  reset();
  return { state, reset, step, startJob, buyUpgrade, buyWeapon, buyAmmo, cycleRadio, saveData, applySave };
}
