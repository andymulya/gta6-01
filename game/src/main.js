// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and win. Progress saves to localStorage (Q quick-save, auto-save on
// delivery, C continues from the title when a save exists).
//
// ?seed=N fixes the city and the traffic pattern. ?shot=cover|drive|chase|heist
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BUSTED, EVENT_DELIVER, EVENT_HIT, EVENT_PICKUP, EVENT_SAVE,
  EVENT_SHOOT, EVENT_WIN, EVENT_WRECKED,
} from './world.js';
import {
  ACTION_BUY_AMMO, ACTION_BUY_ARMOR, ACTION_BUY_ENGINE, ACTION_BUY_SMG, ACTION_BUY_TIRES,
  ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_PAUSE, ACTION_RADIO, ACTION_SAVE,
  createInput,
} from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

const NO_INPUT = { up: false, down: false, left: false, right: false, handbrake: false, action: false, shoot: false, aimAngle: null };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
    world.state.saveFlash = 2;
    return true;
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let saveExists = readSave() !== null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  /** Mouse position in world coordinates, for aiming the gun on foot. */
  function aimAngle() {
    const held = input.state();
    const scale = Math.min(canvas.clientWidth / VIEW.width, canvas.clientHeight / VIEW.height);
    const offX = (canvas.clientWidth - VIEW.width * scale) / 2;
    const offY = (canvas.clientHeight - VIEW.height * scale) / 2;
    const wx = world.state.camera.x + (held.mouseX - offX) / scale;
    const wy = world.state.camera.y + (held.mouseY - offY) / scale;
    const p = world.state.player;
    return Math.atan2(wy - p.y, wx - p.x);
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Ten jobs. Get the package, lose the cops, deliver.');
  }

  function continueGame() {
    const data = readSave();
    if (!data) { startGame(); return; }
    audio.unlock();
    world.reset();
    world.applySave(data);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Continued your run. Ten jobs. Get the package, lose the cops, deliver.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    announce(won ? `You own Vice Bay. Cash $${world.state.cash}.` : `Game over. Cash $${world.state.cash}. Best $${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_CONTINUE && screen === SCREEN_TITLE && saveExists) {
      continueGame();
    } else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_RADIO) {
      const station = world.cycleRadio();
      audio.setStation(station);
      announce(`Radio station ${station + 1}.`);
    }
    if (actions & ACTION_SAVE) {
      writeSave();
      announce('Progress saved.');
    }
    if (actions & ACTION_BUY_ENGINE) world.buyUpgrade('engine');
    if (actions & ACTION_BUY_ARMOR) world.buyUpgrade('armor');
    if (actions & ACTION_BUY_TIRES) world.buyUpgrade('tires');
    if (actions & ACTION_BUY_SMG) world.buyWeapon();
    if (actions & ACTION_BUY_AMMO) world.buyAmmo();
  }

  function step(actions) {
    // On the title screen the world is a living backdrop: traffic and
    // pedestrians move, but the player does not drive.
    if (screen === SCREEN_TITLE) {
      world.step(STEP, NO_INPUT);
      return;
    }
    const held = input.state();
    const stepInput = {
      up: held.up,
      down: held.down,
      left: held.left,
      right: held.right,
      handbrake: held.handbrake,
      action: Boolean(actions & ACTION_ENTER),
      shoot: held.mouseDown && !world.state.player.inCar,
      aimAngle: world.state.player.inCar ? null : aimAngle(),
    };
    const events = world.step(STEP, stepInput);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_DELIVER) audio.deliver();
    if (events & EVENT_HIT) audio.crash();
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_SAVE) writeSave();
    if (events & EVENT_BUSTED) {
      audio.busted();
      endGame(false);
    } else if (events & EVENT_WRECKED) {
      audio.crash();
      endGame(false);
    } else if (events & EVENT_WIN) {
      audio.deliver();
      endGame(true);
    }
    audio.update(world.state, STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once per frame and handed to the first step only.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, saveExists);
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Read-only handle for automated playtests (no gameplay effect).
  window.__viceBay = { world, getScreen: () => screen };

  announce('Vice Bay II. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
