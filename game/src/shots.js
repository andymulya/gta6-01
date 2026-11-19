// The screenshot scenes behind ?shot=cover|drive|chase|heist. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot that drives
// toward the current objective, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

const IDLE = { move: { x: 0, y: 0 }, enter: false, punch: false, shoot: false, shootX: 0, shootY: 0, save: false };

/** Input that walks the player toward (tx, ty). */
function walkInput(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  return { ...IDLE, move: { x: dx / d, y: dy / d } };
}

/** Input that drives the player's car toward (tx, ty). */
function driveInput(state, tx, ty) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return walkInput(state, tx, ty);
  const want = Math.atan2(ty - car.y, tx - car.x);
  const err = normAngle(want - car.angle);
  const steer = clamp(err * 2.2, -1, 1);
  // Brake hard into a sharp turn: at full speed the turning circle is wider
  // than the road, so a corner taken flat ends off-road against a building.
  const throttle = Math.abs(err) < 0.5 ? 1 : Math.abs(err) < 1.0 ? 0.3 : -0.8;
  return { ...IDLE, move: { x: steer, y: -throttle } };
}

/** Put the player inside a car (test scaffolding: the real game enters via E). */
function seatPlayer(world, car) {
  const p = world.state.player;
  car.parked = false;
  car.traffic = false;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function firstCar(world) {
  return world.state.cars.find((c) => c.parked) || world.state.cars[0];
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best haul to show. Unknown names fall back to the cover scene.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'drive') {
    world.reset();
    // Walk to the first car, steal it, drive south to the chop shop.
    const car = firstCar(world);
    for (let i = 0; i < 6 / STEP; i += 1) {
      if (Math.hypot(state.player.x - car.x, state.player.y - car.y) < 46) break;
      world.step(STEP, walkInput(state, car.x, car.y));
    }
    world.step(STEP, { ...IDLE, enter: true });
    // 2.5 s of driving puts the car at the chop shop, not past it.
    for (let i = 0; i < 2.5 / STEP; i += 1) {
      world.step(STEP, driveInput(state, 700, 1000));
    }
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'chase') {
    world.reset();
    world.startMission(2);
    world.setWanted(4);
    const car = firstCar(world);
    car.x = 300;
    car.y = 700;
    car.angle = 0;
    seatPlayer(world, car);
    // 3 s east along the road, then coast to a stop; two cops are placed on
    // the road behind the player so the pursuit is in the frame.
    for (let i = 0; i < 3 / STEP; i += 1) {
      world.step(STEP, driveInput(state, 2700, 700));
    }
    for (let i = 0; i < 1.5 / STEP; i += 1) {
      world.step(STEP, IDLE);
    }
    const p = state.player;
    world.placePolice(p.x - 220, p.y, 0);
    world.placePolice(p.x - 380, p.y + 28, 0);
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'heist') {
    world.reset();
    world.startMission(4);
    const car = firstCar(world);
    car.x = 220;
    car.y = 1100;
    car.angle = 0;
    seatPlayer(world, car);
    for (let i = 0; i < 8 / STEP; i += 1) {
      const truck = state.truck;
      const target = truck ? { x: truck.x, y: truck.y } : { x: 2700, y: 1100 };
      world.step(STEP, driveInput(state, target.x, target.y));
      if (state.cashDrop) break;
    }
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  // cover: a three-star getaway east along the Depot road.
  world.reset();
  world.startMission(2);
  world.setWanted(3);
  const car = firstCar(world);
  car.x = 1500;
  car.y = 1100;
  car.angle = 0;
  seatPlayer(world, car);
  // 2 s east along the road keeps the getaway mid-city, then coast to a stop;
  // two cops are placed on the road behind the player so the pursuit is in frame.
  for (let i = 0; i < 2 / STEP; i += 1) {
    world.step(STEP, driveInput(state, 2700, 1100));
  }
  for (let i = 0; i < 1.5 / STEP; i += 1) {
    world.step(STEP, IDLE);
  }
  const p = state.player;
  world.placePolice(p.x - 220, p.y, 0);
  world.placePolice(p.x - 380, p.y + 28, 0);
  return { screen: SCREEN_PLAY, best: state.cash };
}
