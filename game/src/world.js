// Vice Bay rules and state, with no drawing and no browser in it: the player's
// car and on-foot body, cop cars, traffic, pedestrians, the city, the five jobs,
// the wanted level, cash and the camera. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the world
// knowing about screens or sound. Nothing here allocates after createWorld returns.
import {
  BEACH_Y, CAR, CAR_STEAL_WANTED, COP, COPS_PER_STAR, GARAGE_REPAIR_COST, JOB_COUNT, JOB_TIME,
  PEDS, PLAYER_FOOT, ROADS_X, ROADS_Y, ROAD_W, STEP, TRAFFIC, WANTED_MAX, WORLD,
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

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
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

  const state = {
    city,
    player,
    playerCar,
    cops,
    traffic,
    peds,
    wanted: 0,
    unseenTimer: 0,
    cash: 0,
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

  function reset() {
    state.wanted = 0;
    state.unseenTimer = 0;
    state.cash = 0;
    state.jobIndex = 0;
    state.jobStage = 'pickup';
    state.jobTimer = JOB_TIME;
    state.hasPackage = false;
    state.elapsed = 0;
    state.busted = false;
    state.wrecked = false;
    state.won = false;
    state.message = JOBS[0].fixer;
    state.messageTimer = 6;
    playerCar.x = city.locations.safehouse.x;
    playerCar.y = city.locations.safehouse.y + 40;
    playerCar.angle = Math.PI / 2;
    playerCar.vx = 0;
    playerCar.vy = 0;
    playerCar.health = CAR.health;
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
    state.jobTimer = JOB_TIME;
    state.hasPackage = false;
    setMessage(JOBS[index].fixer, 6);
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    const job = currentJob();

    // --- Player: drive, walk, enter/exit, steal, repair ---
    if (player.inCar) {
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      const speedBefore = Math.hypot(playerCar.vx, playerCar.vy);
      stepCarBody(playerCar, dt, steer, throttle, input.handbrake, { accel: CAR.accel, drag: CAR.drag, turnRate: CAR.turnRate, grip: CAR.grip, maxSpeed: CAR.maxSpeed });
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
      if (input.action && dist(playerCar.x, playerCar.y, g.x, g.y) < 110 && playerCar.health < CAR.health && state.cash >= GARAGE_REPAIR_COST) {
        playerCar.health = CAR.health;
        state.cash -= GARAGE_REPAIR_COST;
        state.wanted = Math.max(0, state.wanted - 2);
        setMessage('Garage: car repaired, heat dropped. -$200.', 4);
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
      // Pick up the package on foot.
      if (state.jobStage === 'pickup' && !state.hasPackage && dist(player.x, player.y, job.pickup.x, job.pickup.y) < 52) {
        state.hasPackage = true;
        state.jobStage = 'deliver';
        setMessage('Package grabbed. Get to the drop-off — fast.', 4);
        events |= EVENT_PICKUP;
        // A cop watching the grab adds heat.
        for (const c of cops) {
          if (c.active && c.seen) { state.wanted = Math.min(WANTED_MAX, state.wanted + 1); break; }
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
              playerCar.health = CAR.health;
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

    // --- Delivery ---
    if (state.hasPackage && state.jobStage === 'deliver') {
      const px = player.inCar ? playerCar.x : player.x;
      const py = player.inCar ? playerCar.y : player.y;
      if (dist(px, py, job.drop.x, job.drop.y) < 78) {
        const late = state.jobTimer <= 0;
        const pay = late ? Math.floor(job.pay / 2) : job.pay + Math.floor(state.jobTimer * 4);
        state.cash += pay;
        state.hasPackage = false;
        events |= EVENT_DELIVER;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.jobIndex + 1 >= JOB_COUNT) {
          state.jobStage = 'done';
          state.won = true;
          events |= EVENT_WIN;
          setMessage(`Delivered! +$${pay}. That was the last job — you own this city.`, 8);
        } else {
          startJob(state.jobIndex + 1);
          setMessage(`Delivered! +$${pay}. ${JOBS[state.jobIndex].name}`, 5);
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
        state.jobTimer = JOB_TIME;
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
  return { state, reset, step };
}
