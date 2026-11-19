// The screenshot scenes behind ?shot=cover|drive|chase|heist. Each one stages a
// real game state — a fresh world, a route for the autopilot to drive, cops where
// the scene needs them — then plays the rules forward for a fixed number of
// steps, so the frame is what the game really looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { JOBS } from './missions.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function noInput() {
  return { up: false, down: false, left: false, right: false, handbrake: false, action: false };
}

/** Steer the player's car toward a point; returns the input for this step. */
function driveTo(state, tx, ty) {
  const car = state.playerCar;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  const speed = Math.hypot(car.vx, car.vy);
  const d = Math.hypot(tx - car.x, ty - car.y);
  const input = noInput();
  if (diff > 0.1) input.right = true;
  else if (diff < -0.1) input.left = true;
  input.up = d > 70;
  if (Math.abs(diff) > 1.1 && speed > 220) {
    input.up = false;
    input.down = true;
  }
  return input;
}

/** Follow a list of waypoints; returns the input for this step. */
function followRoute(state, route, index) {
  const target = route[Math.min(index.value, route.length - 1)];
  const car = state.playerCar;
  if (Math.hypot(target.x - car.x, target.y - car.y) < 90 && index.value < route.length - 1) {
    index.value += 1;
  }
  return driveTo(state, route[Math.min(index.value, route.length - 1)].x, route[Math.min(index.value, route.length - 1)].y);
}

/** Walk the on-foot player toward a point. */
function walkTo(state, tx, ty) {
  const p = state.player;
  const input = noInput();
  if (tx > p.x + 6) input.right = true;
  else if (tx < p.x - 6) input.left = true;
  if (ty > p.y + 6) input.down = true;
  else if (ty < p.y - 6) input.up = true;
  return input;
}

/**
 * Set `world` to the named scene (cover, drive, chase, heist; any other name is
 * cover) and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  const step = (input) => world.step(STEP, input);

  if (name === 'drive') {
    // A first ride down the main avenue, a traffic car alongside.
    const route = [
      { x: 320, y: 960 },
      { x: 960, y: 960 },
      { x: 1600, y: 960 },
      { x: 2240, y: 960 },
    ];
    const index = { value: 0 };
    for (let i = 0; i < 20 / STEP; i += 1) step(followRoute(state, route, index));
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'chase') {
    // Three stars, two cop cars closing in on a downtown escape.
    state.wanted = 3;
    const route = [
      { x: 640, y: 640 },
      { x: 1280, y: 640 },
      { x: 1280, y: 1280 },
      { x: 640, y: 1280 },
      { x: 640, y: 640 },
    ];
    const index = { value: 0 };
    // First get the car moving downtown, then let the cops close in.
    state.playerCar.x = 640;
    state.playerCar.y = 640;
    state.playerCar.angle = 0;
    for (let i = 0; i < 14 / STEP; i += 1) {
      step(followRoute(state, route, index));
      // Stop while the car is still alive, so the shot shows a chase, not a wreck.
      if (state.wrecked || state.busted || state.won || state.playerCar.health < 40) break;
    }
    return { screen: SCREEN_PLAY, best: state.cash };
  }

  if (name === 'heist') {
    // On foot at the pier pickup, the package in hand, the getaway car waiting.
    const job = JOBS[0];
    state.playerCar.x = 1280;
    state.playerCar.y = 1580;
    state.playerCar.angle = Math.PI / 2;
    state.playerCar.vx = 0;
    state.playerCar.vy = 0;
    state.player.inCar = false;
    state.player.x = 1280;
    state.player.y = 1640;
    state.player.angle = Math.PI / 2;
    // Walk to the package and grab it, then the frame shows the getaway moment.
    for (let i = 0; i < 6 / STEP; i += 1) {
      step(walkTo(state, job.pickup.x, job.pickup.y));
      if (state.hasPackage) break;
    }
    // Step a few more frames so the message banner and the package state settle.
    for (let i = 0; i < 0.5 / STEP; i += 1) step(noInput());
    return { screen: SCREEN_PLAY, best: state.cash };
  }

  // Cover: the title over a downtown night scene — the player's car parked
  // under neon, traffic rolling past, a cop cruising in the distance.
  state.playerCar.x = 1280;
  state.playerCar.y = 960;
  state.playerCar.angle = 0;
  state.playerCar.vx = 0;
  state.playerCar.vy = 0;
  state.wanted = 1;
  for (let i = 0; i < 6 / STEP; i += 1) step(noInput());
  return { screen: SCREEN_TITLE, best: 0 };
}
