// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, paused, busted (over) and win.
//
// ?seed=N fixes the traffic and pedestrian pattern. ?shot=cover|drive|chase|heist
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
//
// window.__vb() returns a live snapshot for automated playtests: screen, cash,
// mission, wanted, health, position, car, marker, police count and save state.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EV_BUSTED, EV_CASH, EV_HURT, EV_RAM, EV_SHOT, EV_WON,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_NEWGAME, ACTION_PAUSE,
  ACTION_PUNCH, ACTION_SAVE, ACTION_SHOOT, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { objectiveLabel } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
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
    // Storage can be off: the best haul then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    world.state.marker = world.objectivePoint();
    world.state.district = world.districtAt(world.state.player.x, world.state.player.y);
    renderer.draw(world.state, scene.screen, scene.best, false, world.state.elapsed);
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
  let accumulator = 0;
  let last = performance.now();
  let savedFlashUntil = 0;
  let savedOk = false;

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function refreshBest() {
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
  }

  function startGame(fresh) {
    if (fresh) world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. Job ${world.state.mission + 1}.`);
  }

  function continueGame() {
    const data = world.load();
    if (data && world.applySave(data)) {
      accumulator = 0;
      screen = SCREEN_PLAY;
      audio.unlock();
      announce(`Continued. Job ${world.state.mission + 1}.`);
      return true;
    }
    return false;
  }

  function snapshot() {
    const s = world.state;
    const p = s.player;
    const marker = world.objectivePoint();
    return {
      screen,
      cash: s.cash,
      mission: s.mission,
      step: s.step,
      missionLabel: objectiveLabel(s.mission, s.step),
      wanted: s.wanted,
      health: Math.round(p.health),
      x: Math.round(p.x),
      y: Math.round(p.y),
      angle: p.angle,
      inCar: p.inCar !== null,
      carIntegrity: p.inCar ? Math.round(p.inCar.integrity) : null,
      speed: Math.round(p.speed),
      marker: marker ? { x: Math.round(marker.x), y: Math.round(marker.y) } : null,
      cops: s.police.filter((c) => !c.disabled).length,
      saved: savedOk,
      won: s.won,
      time: `${String(Math.floor(s.clockMin / 60)).padStart(2, '0')}:${String(s.clockMin % 60).padStart(2, '0')}`,
      district: world.districtAt(p.x, p.y),
      busted: s.busted,
    };
  }
  window.__vb = snapshot;

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & ACTION_NEWGAME) {
        if (!continueGame()) startGame(true);
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
      } else if (actions & ACTION_NEWGAME) startGame(true);
      return;
    }
    if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Free roam.');
      } else if (actions & ACTION_NEWGAME) startGame(true);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      input.releaseAll();
      announce('Paused.');
    }
  }

  function stepWorld(edge) {
    const move = input.move();
    const click = input.click();
    const target = renderer.screenToWorld(click.x, click.y);
    const events = world.step(STEP, {
      move,
      enter: edge.enter,
      punch: edge.punch,
      shoot: edge.shoot,
      shootX: target.x,
      shootY: target.y,
      save: edge.save,
    });
    if (events & EV_SHOT) audio.gunshot();
    if (events & (EV_CASH | EV_WON)) {
      audio.jingle();
      refreshBest();
    }
    if (events & EV_RAM) audio.thud();
    if (events & EV_HURT) audio.thud();
    if (events & EV_BUSTED) {
      screen = SCREEN_OVER;
      announce('Busted. Marlowe bailed you out.');
    }
    if (world.state.won && screen === SCREEN_PLAY) {
      screen = SCREEN_WIN;
      refreshBest();
      announce('All five jobs done. Rustline is yours.');
    }
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Take the one-shot presses once per frame; handleActions consumes the screen
    // actions, the play step consumes the edge actions.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      // Edge actions apply to the first fixed step of this frame only.
      const edge = {
        enter: !!(actions & ACTION_ENTER),
        punch: !!(actions & ACTION_PUNCH),
        shoot: !!(actions & ACTION_SHOOT),
        save: !!(actions & ACTION_SAVE),
      };
      if (edge.save) {
        savedOk = world.save();
        savedFlashUntil = now + 2000;
        if (savedOk) refreshBest();
      }
      let first = true;
      while (accumulator >= STEP) {
        stepWorld(first ? edge : { enter: false, punch: false, shoot: false, save: false });
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
      const speedNorm = world.state.player.inCar
        ? Math.abs(world.state.player.inCar.speed) / 490
        : 0;
      audio.update(speedNorm, world.state.wanted);
    } else {
      accumulator = 0;
      audio.update(0, 0);
    }
    // Keep the renderer's marker and district in step with the world.
    world.state.marker = screen === SCREEN_PLAY ? world.objectivePoint() : null;
    world.state.district = world.districtAt(world.state.player.x, world.state.player.y);
    renderer.draw(world.state, screen, best, now < savedFlashUntil && savedOk, world.state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      input.releaseAll();
      announce('Paused.');
    }
  });

  announce('Rustline. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
