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
  return { up: false, down: false, left: false, right: false, handbrake: false, action: false, shoot: false, aimAngle: null };
}

/** Steer the player's car toward a point; returns the input for this step. */
function driveTo(state, tx, ty, slow) {
  const car = state.playerCar;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  const speed = Math.hypot(car.vx, car.vy);
  const d = Math.hypot(tx - car.x, ty - car.y);
  const input = noInput();
  if (diff > 0.1) input.right = true;
  else if (diff < -0.1) input.left = true;
  // Slow for corners and for the final approach, or the car overshoots the
  // road into the block and wedges against a building. `slow` means a turn
  // follows this waypoint: arrive at cornering speed, not cruising speed.
  const wantSpeed = slow ? 130 : d < 260 ? 180 : 520;
  if (Math.abs(diff) > 2.2 && speed < 200) {
    // U-turn: swing around forward with the handbrake, nose toward the target.
    input.up = speed < 150;
    input.handbrake = true;
    if (diff > 0) input.right = true;
    else input.left = true;
  } else if (Math.abs(diff) > 0.6) input.up = speed < 140;
  else input.up = d > 70 && speed < wantSpeed;
  if (Math.abs(diff) > 1.1 && speed > 200) {
    input.up = false;
    input.down = true;
  }
  return input;
}

/** Follow a list of waypoints; returns the input for this step. */
function followRoute(state, route, index) {
  const target = route[Math.min(index.value, route.length - 1)];
  const car = state.playerCar;
  const d = Math.hypot(target.x - car.x, target.y - car.y);
  if (d < 90 && index.value < route.length - 1) {
    index.value += 1;
  }
  const next = route[Math.min(index.value, route.length - 1)];
  // A turn follows this waypoint: arrive at cornering speed.
  const slow = index.value < route.length - 1 && Math.hypot(next.x - car.x, next.y - car.y) < 420;
  return driveTo(state, next.x, next.y, slow);
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
    // A first ride down the beach avenue: palms, traffic, pedestrians, the sea.
    const route = [
      { x: 320, y: 1600 },
      { x: 960, y: 1600 },
      { x: 1600, y: 1600 },
      { x: 2240, y: 1600 },
    ];
    state.playerCar.x = 320;
    state.playerCar.y = 1600;
    state.playerCar.angle = 0;
    const index = { value: 0 };
    for (let i = 0; i < 20 / STEP; i += 1) step(followRoute(state, route, index));
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'chase') {
    // Five stars: the helicopter overhead, a roadblock ahead, cops closing in.
    state.wanted = 5;
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
    // On foot at the port shootout: gang shooters guard the package, the player
    // fires the pistol, the getaway car waits nearby.
    world.startJob(2); // Job 3 · Port Heist (guarded)
    const job = JOBS[2];
    state.playerCar.x = 2240;
    state.playerCar.y = 1420;
    state.playerCar.angle = Math.PI / 2;
    state.playerCar.vx = 0;
    state.playerCar.vy = 0;
    state.player.inCar = false;
    state.player.x = 2240;
    state.player.y = 1420;
    state.player.angle = 0;
    // Walk toward the package and stop at the edge of the shooters' ring.
    for (let i = 0; i < 8 / STEP; i += 1) {
      step(walkTo(state, job.pickup.x - 130, job.pickup.y));
      if (Math.hypot(state.player.x - (job.pickup.x - 130), state.player.y - job.pickup.y) < 30) break;
    }
    // Aim at the nearest live shooter and fire, so the frame shows the
    // muzzle flash, the bullet in flight and the gang.
    const shooter = state.gang.find((g) => g.active);
    if (shooter) {
      const aim = Math.atan2(shooter.y - state.player.y, shooter.x - state.player.x);
      const shootInput = noInput();
      shootInput.aimAngle = aim;
      shootInput.shoot = true;
      step(shootInput);
    }
    // Only a few frames more, so the muzzle flash and the bullet are still visible.
    for (let i = 0; i < 0.08 / STEP; i += 1) step(noInput());
    return { screen: SCREEN_PLAY, best: state.cash };
  }

  // Cover: the title over a sun-soaked downtown — the player's car parked on
  // the avenue, traffic rolling past, a helicopter in the distance, 2 stars.
  // Step the ambient city first with no heat (cops would ram the parked car
  // and shove the camera), then set the wanted level and the heli.
  state.playerCar.x = 1280;
  state.playerCar.y = 960;
  state.playerCar.angle = 0;
  state.playerCar.vx = 0;
  state.playerCar.vy = 0;
  for (let i = 0; i < 6 / STEP; i += 1) step(noInput());
  state.wanted = 2;
  state.heli.locked = true;
  state.heli.active = true;
  state.heli.x = 1700;
  state.heli.y = 800;
  state.heli.rotor = 1.2;
  return { screen: SCREEN_TITLE, best: 0 };
}
