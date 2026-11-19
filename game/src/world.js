// Rustline's rules and state, with no drawing and no browser in it: the player on
// foot or in a car, traffic and parked cars, police that chase, ram and bust, the
// wanted level, combat, the five jobs, the clock and the save. step() advances one
// fixed step from an input object and returns what happened as bit flags, so the
// caller can react (sound, announcements) without the world knowing about screens.
import {
  BUST_FINE, CAR, FIRST_CAR, MISSION_PAY, PLACES, PLAYER, POLICE, ROADS_H, ROADS_V,
  SAVE_KEY, SPAWN, START_CASH, WANTED, WORLD,
} from './config.js';
import { buildCity, districtAt, nearestRoadPoint, resolveBuildings } from './city.js';
import { missionAt, missionCount } from './missions.js';
import { pick, randInt } from './random.js';

export const EV_CASH = 1;
export const EV_BUSTED = 2;
export const EV_WON = 4;
export const EV_SHOT = 8;
export const EV_HURT = 16;
export const EV_PICKUP = 32;
export const EV_RAM = 64;

const TRAFFIC_COLORS = ['#7d8a99', '#8a7d99', '#99a07d', '#7d99a0', '#a08a7d'];
const PED_COLORS = ['#c9a0a0', '#a0b8c9', '#b8c9a0', '#c9b8a0'];

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createWorld(random) {
  const city = buildCity();
  const state = {
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: Math.PI / 2, health: PLAYER.health,
      inCar: null, speed: 0, lastHurtAt: -99, shootCd: 0, bustClock: 0,
    },
    cars: [],
    police: [],
    peds: [],
    truck: null,
    cashDrop: null,
    wanted: 0,
    wantedClock: 0,
    cash: START_CASH,
    mission: 0,
    step: 0,
    missionTimer: 0,
    missionMsg: '',
    clockMin: 18 * 60,
    elapsed: 0,
    won: false,
    busted: false,
    muzzle: null,
    smoke: [],
    city,
    seed: 0,
  };

  function makeCar(x, y, angle, color, opts = {}) {
    return {
      x, y, angle, speed: 0, color,
      integrity: CAR.integrity,
      parked: !!opts.parked,
      traffic: !!opts.traffic,
      road: opts.road || null,
      dir: opts.dir || 1,
      cruise: opts.cruise || 0,
      disabled: false,
      ramCd: 0,
      scrapeCd: 0,
      bumpCd: 0,
      stolen: false,
      r: 17,
    };
  }

  function spawnTraffic() {
    const spots = [];
    for (const rx of ROADS_V) spots.push({ road: 'v', at: rx });
    for (const ry of ROADS_H) spots.push({ road: 'h', at: ry });
    for (let i = 0; i < 8; i += 1) {
      const spot = pick(random, spots);
      const dir = random() < 0.5 ? 1 : -1;
      if (spot.road === 'v') {
        state.cars.push(makeCar(spot.at, randInt(random, 120, WORLD.height - 120), dir > 0 ? Math.PI / 2 : -Math.PI / 2,
          pick(random, TRAFFIC_COLORS), { traffic: true, road: 'v', at: spot.at, dir, cruise: randInt(random, 120, 180) }));
      } else {
        state.cars.push(makeCar(randInt(random, 120, WORLD.width - 120), spot.at, dir > 0 ? 0 : Math.PI,
          pick(random, TRAFFIC_COLORS), { traffic: true, road: 'h', at: spot.at, dir, cruise: randInt(random, 120, 180) }));
      }
    }
  }

  function spawnParked() {
    // The mission-1 car is fixed; a few more parked cars sit on road edges.
    state.cars.push(makeCar(FIRST_CAR.x, FIRST_CAR.y, FIRST_CAR.angle, FIRST_CAR.color, { parked: true }));
    const extra = [
      { x: 1100, y: 820, angle: 0 },
      { x: 1900, y: 420, angle: Math.PI / 2 },
      { x: 1500, y: 1620, angle: Math.PI },
      { x: 2300, y: 1180, angle: -Math.PI / 2 },
      { x: 300, y: 820, angle: 0 },
      { x: 2700, y: 1620, angle: Math.PI / 2 },
    ];
    for (const spot of extra) {
      state.cars.push(makeCar(spot.x, spot.y, spot.angle, '#9a8a6a', { parked: true }));
    }
  }

  function spawnPeds() {
    for (let i = 0; i < 12; i += 1) {
      const road = pick(random, ROADS_V);
      state.peds.push({
        x: road + randInt(random, -60, 60),
        y: randInt(random, 120, WORLD.height - 120),
        angle: random() * Math.PI * 2,
        speed: randInt(random, 40, 70),
        color: pick(random, PED_COLORS),
        flee: 0,
        turnAt: random() * 4,
        r: 11,
      });
    }
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      if (car.disabled) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function spawnPoliceCar() {
    const p = state.player;
    let x = p.x;
    let y = p.y;
    for (let tries = 0; tries < 8; tries += 1) {
      const pt = nearestRoadPoint(
        p.x + (random() - 0.5) * 2 * POLICE.spawnDistance,
        p.y + (random() - 0.5) * 2 * POLICE.spawnDistance,
      );
      if (dist(pt.x, pt.y, p.x, p.y) > 320) {
        x = pt.x;
        y = pt.y;
        break;
      }
    }
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), '#20242a', {});
    car.police = true;
    car.chaseTime = 0;
    // A cop that cannot catch the player in 15 s gives up and drives away:
    // outrunning the chase is how the heat drops, and a chase that never
    // ends would make the wanted level permanent.
    car.giveUpAt = 15;
    state.police.push(car);
  }

  // Test/screenshot scaffolding: put a police car at an exact spot, facing an
  // angle. The live game spawns police with spawnPoliceCar; this only places
  // one where a staged scene needs a chase already in frame.
  function placePolice(x, y, angle) {
    const car = makeCar(x, y, angle, '#20242a', {});
    car.police = true;
    car.chaseTime = 0;
    car.giveUpAt = 15;
    state.police.push(car);
    return car;
  }

  function setWanted(level) {
    const before = state.wanted;
    state.wanted = clamp(level, 0, WANTED.max);
    state.wantedClock = 0;
    // New cops only join when the heat RISES (a theft, a shot, a mission that
    // opens hot). When a star decays, no fresh cops appear — the ones already
    // out there are the chase, and losing them is how the heat drops.
    if (state.wanted > before) {
      while (state.police.filter((c) => !c.disabled).length < Math.min(state.wanted, POLICE.maxActive)) spawnPoliceCar();
    }
  }

  function addWanted(n) {
    setWanted(state.wanted + n);
  }

  function startMission(index) {
    state.mission = index;
    state.step = 0;
    state.missionTimer = 0;
    state.truck = null;
    state.cashDrop = null;
    const mission = missionAt(index);
    state.missionMsg = mission.intro;
    if (mission.timed) state.missionTimer = mission.timed;
    if (index === 2) {
      // Heat Wave opens with the heat already on.
      setWanted(3);
    }
    if (index === 4) {
      // The armored truck rolls east along the Depot road.
      state.truck = {
        x: PLACES.truckStart.x, y: PLACES.truckStart.y, angle: 0,
        speed: 140, integrity: 170, stopped: false, ramCd: 0, r: 20,
      };
    }
  }

  function completeMission() {
    const mission = missionAt(state.mission);
    state.cash += mission.pay;
    state.missionMsg = `${mission.name} complete — $${mission.pay}.`;
    if (state.mission >= missionCount() - 1) {
      state.won = true;
      return EV_WON;
    }
    startMission(state.mission + 1);
    return EV_CASH;
  }

  function advanceStep() {
    state.step += 1;
    const mission = missionAt(state.mission);
    if (state.step >= mission.steps.length) return completeMission();
    return 0;
  }

  function failMission() {
    state.missionMsg = `${missionAt(state.mission).name} failed — try again.`;
    startMission(state.mission);
  }

  function bustPlayer() {
    state.cash = Math.max(0, state.cash - BUST_FINE);
    state.wanted = 0;
    state.police.length = 0;
    state.truck = null;
    state.cashDrop = null;
    const p = state.player;
    p.x = PLACES.safehouse.x;
    p.y = PLACES.safehouse.y + 60;
    p.angle = Math.PI / 2;
    p.health = PLAYER.health;
    p.inCar = null;
    p.bustClock = 0;
    state.busted = true;
    state.missionMsg = `Busted — $${BUST_FINE} fine. Marlowe bailed you out.`;
    startMission(state.mission);
    return EV_BUSTED;
  }

  function hurtPlayer(amount) {
    const p = state.player;
    p.health = Math.max(0, p.health - amount);
    p.lastHurtAt = state.elapsed;
    if (p.health <= 0) return bustPlayer();
    return EV_HURT;
  }

  function reset() {
    state.player.x = SPAWN.x;
    state.player.y = SPAWN.y;
    state.player.angle = Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.inCar = null;
    state.player.speed = 0;
    state.player.bustClock = 0;
    state.cars.length = 0;
    state.police.length = 0;
    state.peds.length = 0;
    state.truck = null;
    state.cashDrop = null;
    state.wanted = 0;
    state.wantedClock = 0;
    state.cash = START_CASH;
    state.elapsed = 0;
    state.clockMin = 18 * 60;
    state.won = false;
    state.busted = false;
    state.muzzle = null;
    state.smoke.length = 0;
    spawnTraffic();
    spawnParked();
    spawnPeds();
    startMission(0);
  }

  function save() {
    try {
      const p = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash, mission: state.mission, step: state.step,
        x: p.x, y: p.y, health: p.health, wanted: state.wanted,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(data) {
    if (!data) return false;
    reset();
    state.cash = data.cash ?? START_CASH;
    const p = state.player;
    p.x = data.x ?? SPAWN.x;
    p.y = data.y ?? SPAWN.y;
    p.health = data.health ?? PLAYER.health;
    startMission(data.mission ?? 0);
    state.step = data.step ?? 0;
    setWanted(data.wanted ?? 0);
    return true;
  }

  // ---- movement helpers -------------------------------------------------

  function moveBody(body, dx, dy) {
    body.x = clamp(body.x + dx, 24, WORLD.width - 24);
    body.y = clamp(body.y + dy, 24, WORLD.height - 24);
    if (body.y > 2030) body.y = 2030; // the river is impassable
    resolveBuildings(state.city.buildings, body);
  }

  function driveCar(car, throttle, steer, dt) {
    const max = car.police ? POLICE.maxSpeed : CAR.maxSpeed;
    if (throttle > 0) car.speed = Math.min(max, car.speed + CAR.accel * throttle * dt);
    else if (throttle < 0) {
      if (car.speed > 5) car.speed = Math.max(0, car.speed - CAR.brake * dt);
      else car.speed = Math.max(-CAR.reverseSpeed, car.speed + CAR.accel * 0.6 * throttle * dt);
    } else {
      car.speed -= car.speed * 0.6 * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    // Full steering above ~130 px/s, but never below 35% — a slow car must
    // still be able to turn around when it is wedged against a building.
    const turnAuthority = clamp(0.35 + Math.abs(car.speed) / 200, 0, 1);
    car.angle += steer * CAR.steer * turnAuthority * dt * (car.speed < 0 ? -1 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(nx, 24, WORLD.width - 24);
    car.y = clamp(ny, 24, 2030);
    const body = { x: car.x, y: car.y, r: 16 };
    if (resolveBuildings(state.city.buildings, body)) {
      car.x = body.x;
      car.y = body.y;
      if (Math.abs(car.speed) > 150 && car.scrapeCd <= 0) {
        car.integrity -= 2;
        car.scrapeCd = 0.5;
        car.speed *= 0.5;
      } else {
        car.speed *= 0.85;
      }
    }
    if (car.scrapeCd > 0) car.scrapeCd -= dt;
    if (car.ramCd > 0) car.ramCd -= dt;
    if (car.bumpCd > 0) car.bumpCd -= dt;
  }

  function carCollide(a, b) {
    const d = dist(a.x, a.y, b.x, b.y);
    const min = 34;
    if (d >= min || d < 0.001) return 0;
    const nx = (b.x - a.x) / d;
    const ny = (b.y - a.y) / d;
    const overlap = (min - d) / 2;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
    return Math.abs(a.speed - b.speed);
  }

  // ---- combat ------------------------------------------------------------

  function shootAt(tx, ty) {
    const p = state.player;
    if (p.shootCd > 0) return 0;
    p.shootCd = PLAYER.shootCooldown;
    state.muzzle = { x: p.x, y: p.y, t: 0.09 };
    const aim = Math.atan2(ty - p.y, tx - p.x);
    let best = null;
    let bestD = PLAYER.shootRange;
    for (const car of state.police) {
      if (car.disabled) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d > bestD) continue;
      const ang = Math.atan2(car.y - p.y, car.x - p.x);
      if (Math.abs(normAngle(ang - aim)) < 0.12) {
        bestD = d;
        best = { kind: 'cop', car };
      }
    }
    for (const ped of state.peds) {
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d > bestD) continue;
      const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
      if (Math.abs(normAngle(ang - aim)) < 0.12) {
        bestD = d;
        best = { kind: 'ped', ped };
      }
    }
    if (!best) return EV_SHOT;
    if (best.kind === 'cop') {
      best.car.integrity -= PLAYER.shootDamage;
      if (best.car.integrity <= 0) best.car.disabled = true;
      addWanted(WANTED.shootCop);
    } else {
      best.ped.flee = 6;
      addWanted(1);
    }
    return EV_SHOT;
  }

  function punch() {
    const p = state.player;
    for (const car of state.police) {
      if (car.disabled) continue;
      if (dist(p.x, p.y, car.x, car.y) < PLAYER.punchRange + 18) {
        car.integrity -= PLAYER.punchDamage;
        if (car.integrity <= 0) car.disabled = true;
        addWanted(WANTED.punchCop);
        return EV_HURT;
      }
    }
    for (const ped of state.peds) {
      if (dist(p.x, p.y, ped.x, ped.y) < PLAYER.punchRange) {
        ped.flee = 6;
        return 0;
      }
    }
    return 0;
  }

  function tryEnterCar() {
    const p = state.player;
    if (p.inCar) {
      // Step out beside the car.
      const car = p.inCar;
      p.inCar = null;
      p.x = car.x - Math.sin(car.angle) * 30;
      p.y = car.y + Math.cos(car.angle) * 30;
      p.angle = car.angle;
      const body = { x: p.x, y: p.y, r: PLAYER.radius };
      resolveBuildings(state.city.buildings, body);
      p.x = body.x;
      p.y = body.y;
      return 0;
    }
    const car = nearestCar(p.x, p.y, 58);
    if (!car) return 0;
    car.parked = false;
    car.traffic = false;
    p.inCar = car;
    p.angle = car.angle;
    // Stealing a fresh car is a crime; getting back into a car you already
    // stole is not one — the heat does not rise again for the same car.
    if (!car.stolen) {
      car.stolen = true;
      addWanted(WANTED.steal);
    }
    return EV_PICKUP;
  }

  // ---- police ------------------------------------------------------------

  function updatePolice(dt) {
    const p = state.player;
    let events = 0;
    const want = Math.min(state.wanted, POLICE.maxActive);
    const active = state.police.filter((c) => !c.disabled).length;
    // Replacements only join a chase that is still hot (a cop within the heat
    // range). Once every cop is far away the player has lost them: no fresh
    // cop appears to reset the clock, and the wanted level can decay.
    const hot = state.police.some((c) => !c.disabled && dist(c.x, c.y, p.x, p.y) < WANTED.decayRange);
    if (active < want && hot && random() < dt * 0.8) spawnPoliceCar();
    for (let i = state.police.length - 1; i >= 0; i -= 1) {
      const car = state.police[i];
      if (car.disabled) {
        car.speed = 0;
        if (random() < dt * 0.05) state.police.splice(i, 1);
        continue;
      }
      car.chaseTime += dt;
      const d = dist(car.x, car.y, p.x, p.y);
      if (car.chaseTime > car.giveUpAt || d > 850) {
        // Give up: pull away and despawn.
        const away = Math.atan2(car.y - p.y, car.x - p.x);
        driveCar(car, 0.7, clamp(normAngle(away - car.angle) * 1.5, -1, 1), dt);
        if (d > 800) state.police.splice(i, 1);
        continue;
      }
      // Chase: steer at the player, ram on contact.
      const wantAngle = Math.atan2(p.y - car.y, p.x - car.x);
      const steer = clamp(normAngle(wantAngle - car.angle) * 1.8, -1, 1);
      driveCar(car, 1, steer, dt);
      if (d < 44 && car.ramCd <= 0) {
        car.ramCd = POLICE.ramCooldown;
        if (p.inCar) {
          p.inCar.integrity -= POLICE.ramDamage;
          if (p.inCar.integrity <= 0) {
            p.inCar.disabled = true;
            p.inCar = null;
            p.x = car.x - Math.sin(car.angle) * 30;
            p.y = car.y + Math.cos(car.angle) * 30;
          }
        } else {
          const ev = hurtPlayer(POLICE.ramDamage);
          if (ev === EV_BUSTED) return ev;
          events |= EV_HURT;
        }
      }
      // Bust: standing next to a cop on foot for long enough ends the run.
      if (!p.inCar && d < POLICE.bustRange) {
        p.bustClock += dt;
        if (p.bustClock >= POLICE.bustTime) return bustPlayer();
      } else {
        p.bustClock = Math.max(0, p.bustClock - dt * 2);
      }
    }
    return events;
  }

  function updateWanted(dt) {
    if (state.wanted === 0) return;
    const p = state.player;
    let near = false;
    for (const car of state.police) {
      if (!car.disabled && dist(car.x, car.y, p.x, p.y) < WANTED.decayRange) {
        near = true;
        break;
      }
    }
    // The heat only cools while every cop is beyond the decay range — but the
    // clock PAUSES when one closes in instead of resetting to zero, so a
    // getaway banked over several straights is not wiped out by one corner.
    if (near) return;
    state.wantedClock += dt;
    if (state.wantedClock >= WANTED.decaySeconds) {
      state.wantedClock = 0;
      setWanted(state.wanted - 1);
    }
  }

  // ---- traffic, pedestrians, truck ----------------------------------------

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (!car.traffic || car.disabled) continue;
      if (state.player.inCar === car) continue;
      // Brake for the car ahead so traffic does not pile up.
      let ahead = false;
      for (const other of state.cars) {
        if (other === car || other.disabled) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < 90 && side < 30) {
          ahead = true;
          break;
        }
      }
      const throttle = ahead ? -0.4 : 0.55;
      driveCar(car, throttle, 0, dt);
      // Bounce at the world edge.
      if (car.road === 'v' && (car.y < 80 || car.y > 1980)) car.dir *= -1;
      if (car.road === 'h' && (car.x < 80 || car.x > WORLD.width - 80)) car.dir *= -1;
      if (car.road === 'v') car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.road === 'h') car.angle = car.dir > 0 ? 0 : Math.PI;
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      ped.turnAt -= dt;
      if (ped.turnAt <= 0) {
        ped.turnAt = 2 + random() * 4;
        ped.angle = random() * Math.PI * 2;
      }
      let speed = ped.speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        speed = ped.speed * 2.4;
      }
      const body = { x: ped.x, y: ped.y, r: ped.r };
      moveBody(body, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt);
      ped.x = body.x;
      ped.y = body.y;
      if (ped.x < 40 || ped.x > WORLD.width - 40 || ped.y < 40 || ped.y > 2000) {
        ped.angle += Math.PI;
      }
    }
  }

  function updateTruck(dt) {
    const truck = state.truck;
    if (!truck) return 0;
    if (!truck.stopped) {
      truck.x += truck.speed * dt;
      if (truck.x > WORLD.width - 100) truck.x = 120;
      // The player's car ramming the truck hurts the truck.
      const p = state.player;
      if (p.inCar) {
        const d = dist(p.inCar.x, p.inCar.y, truck.x, truck.y);
        if (d < 52 && truck.ramCd <= 0) {
          const impact = Math.abs(p.inCar.speed) * 0.09 + 6;
          truck.integrity -= impact;
          truck.ramCd = 0.5;
          p.inCar.integrity -= 4;
          p.inCar.speed *= 0.4;
          if (truck.integrity <= 0) {
            truck.stopped = true;
            truck.speed = 0;
            state.cashDrop = { x: truck.x, y: truck.y + 40 };
            return EV_RAM;
          }
          return EV_RAM;
        }
      }
    }
    if (truck.ramCd > 0) truck.ramCd -= dt;
    return 0;
  }

  // ---- missions ------------------------------------------------------------

  function objectivePoint() {
    const mission = missionAt(state.mission);
    const stepObj = mission.steps[Math.min(state.step, mission.steps.length - 1)];
    if (stepObj.type === 'goto' || stepObj.type === 'pickup') return { x: stepObj.x, y: stepObj.y };
    if (stepObj.type === 'ram' && state.truck) return { x: state.truck.x, y: state.truck.y };
    if (stepObj.type === 'collect' && state.cashDrop) return { x: state.cashDrop.x, y: state.cashDrop.y };
    if (stepObj.type === 'car') {
      const car = nearestCar(state.player.x, state.player.y, 100000);
      return car ? { x: car.x, y: car.y } : null;
    }
    return null;
  }

  function updateMission(dt) {
    const mission = missionAt(state.mission);
    if (mission.timed) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        failMission();
        return 0;
      }
    }
    const stepObj = mission.steps[Math.min(state.step, mission.steps.length - 1)];
    const p = state.player;
    let done = false;
    if (stepObj.type === 'car') {
      done = p.inCar !== null;
    } else if (stepObj.type === 'goto') {
      done = dist(p.x, p.y, stepObj.x, stepObj.y) < stepObj.radius;
    } else if (stepObj.type === 'pickup') {
      done = !p.inCar && dist(p.x, p.y, stepObj.x, stepObj.y) < stepObj.radius;
    } else if (stepObj.type === 'heat') {
      done = state.wanted === 0;
    } else if (stepObj.type === 'ram') {
      done = state.truck !== null && state.truck.stopped;
    } else if (stepObj.type === 'collect') {
      done = state.cashDrop !== null && !p.inCar && dist(p.x, p.y, state.cashDrop.x, state.cashDrop.y) < 42;
      if (done) state.cashDrop = null;
    }
    if (!done) return 0;
    return advanceStep();
  }

  // ---- the step ------------------------------------------------------------

  /**
   * Advance one fixed step. `input` is { move:{x,y}, enter, punch, shoot,
   * shootX, shootY, save } — move is a normalised direction; enter/punch/shoot
   * are edge-triggered booleans for this step only. Returns event bit flags.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.clockMin = (18 * 60 + Math.floor(state.elapsed * (2 / 3))) % (24 * 60);
    const p = state.player;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (state.muzzle) {
      state.muzzle.t -= dt;
      if (state.muzzle.t <= 0) state.muzzle = null;
    }
    for (const s of state.smoke) {
      s.t -= dt;
      s.y -= 12 * dt;
    }
    state.smoke = state.smoke.filter((s) => s.t > 0);

    if (input.save) {
      save();
      events |= EV_PICKUP;
    }
    if (input.enter) events |= tryEnterCar();
    if (input.punch && !p.inCar) events |= punch();
    if (input.shoot && !p.inCar) events |= shootAt(input.shootX, input.shootY);

    if (p.inCar) {
      const car = p.inCar;
      const throttle = input.move.y !== 0 ? -input.move.y : 0;
      // Driving uses up/down for throttle and left/right for steering.
      driveCar(car, throttle, input.move.x, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = Math.abs(car.speed);
      if (car.integrity <= 0 && !car.disabled) {
        car.disabled = true;
        p.inCar = null;
        state.smoke.push({ x: car.x, y: car.y, t: 2 });
      }
    } else {
      const body = { x: p.x, y: p.y, r: PLAYER.radius };
      moveBody(body, input.move.x * PLAYER.walkSpeed * dt, input.move.y * PLAYER.walkSpeed * dt);
      p.x = body.x;
      p.y = body.y;
      if (input.move.x !== 0 || input.move.y !== 0) p.angle = Math.atan2(input.move.y, input.move.x);
      p.speed = 0;
    }

    // Health regen after a calm stretch.
    if (state.elapsed - p.lastHurtAt > PLAYER.regenDelay && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + PLAYER.regen * dt);
    }

    updateTraffic(dt);
    updatePeds(dt);
    const truckEv = updateTruck(dt);
    events |= truckEv;
    const policeEv = updatePolice(dt);
    if (policeEv === EV_BUSTED) return EV_BUSTED;
    events |= policeEv;
    updateWanted(dt);

    // Car-to-car bumps: the player's car against traffic and police.
    const allCars = [...state.cars, ...state.police];
    if (p.inCar) {
      for (const other of allCars) {
        if (other === p.inCar || other.disabled) continue;
        const rel = carCollide(p.inCar, other);
        // One integrity point per hard knock, at most twice a second: without
        // the cooldown a sustained push drained 60/s and wrecked cars in seconds.
        if (rel > 120 && p.inCar.bumpCd <= 0) {
          p.inCar.integrity -= 1;
          p.inCar.bumpCd = 0.5;
          other.integrity = (other.integrity ?? 100) - 1;
        }
      }
    }
    for (const a of state.police) {
      if (a.disabled) continue;
      for (const b of state.cars) {
        if (b.disabled) continue;
        carCollide(a, b);
      }
    }

    if (!state.won) events |= updateMission(dt);
    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    save,
    load,
    applySave,
    setWanted,
    placePolice,
    startMission,
    objectivePoint,
    districtAt: (x, y) => districtAt(x, y),
  };
}
