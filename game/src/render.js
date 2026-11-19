// Drawing only: the world's state and the current screen in, pixels out. The
// camera shows a 1280x720 window of the 2560x1920 city; the HUD and minimap are
// drawn in screen space on top. Flat rectangles and circles, canvas text for the
// HUD and the panels.
import {
  BEACH_Y, CAR, COP, FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_W, VIEW, WORLD,
} from './config.js';
import { JOBS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 70 };
const MAP = { x: 1020, y: 16, w: 244, h: 184 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cashLabel = cachedLabel('Cash $');
  const jobLabel = cachedLabel('');
  const speedLabel = cachedLabel('');
  const timerLabel = cachedLabel('');
  const healthLabel = cachedLabel('CAR ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawCity(state) {
    const { city } = state;
    // Ground: dark blocks, then the beach and water at the south edge.
    context.fillStyle = '#0d1020';
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, WORLD.height - BEACH_Y);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BEACH_Y + 84, WORLD.width, WORLD.height - BEACH_Y - 84);
    // Parks.
    context.fillStyle = PALETTE.park;
    for (const p of city.parks) context.fillRect(p.x, p.y, p.width, p.height);
    // Roads.
    context.fillStyle = PALETTE.asphalt;
    for (const cx of ROADS_X) context.fillRect(cx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
    for (const cy of ROADS_Y) context.fillRect(0, cy - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const cx of ROADS_X) {
      for (let y = 0; y < BEACH_Y; y += 56) context.fillRect(cx - 2, y, 4, 28);
    }
    for (const cy of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 56) context.fillRect(x, cy - 2, 28, 4);
    }
    // Buildings with a neon trim and lit windows.
    for (const b of city.buildings) {
      context.fillStyle = PALETTE[b.kind];
      context.fillRect(b.x, b.y, b.width, b.height);
      context.strokeStyle = PALETTE[b.trim];
      context.lineWidth = 2;
      context.strokeRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);
      context.fillStyle = PALETTE[b.trim];
      const cols = Math.max(1, Math.floor(b.width / 26));
      const rows = Math.max(1, Math.floor(b.height / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 13 + b.x) % 5 !== 0) continue;
          context.globalAlpha = 0.5;
          context.fillRect(b.x + 8 + c * 26, b.y + 8 + r * 26, 8, 10);
        }
      }
      context.globalAlpha = 1;
    }
    // Safehouse + garage markers (fixed, always drawn).
    drawMarker(city.locations.safehouse.x, city.locations.safehouse.y, PALETTE.neonCyan, 'H');
    drawMarker(city.locations.garage.x, city.locations.garage.y, PALETTE.neonAmber, 'G');
  }

  function drawMarker(x, y, color, letter) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b0f1a';
    text(letter, x, y + 6, 18, '#0b0f1a', 'center');
  }

  function drawCar(x, y, angle, body, roof, radius) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = body;
    context.beginPath();
    context.roundRect(-radius - 6, -radius + 2, radius * 2 + 12, radius * 2 - 4, 7);
    context.fill();
    context.fillStyle = roof;
    context.beginPath();
    context.roundRect(-radius + 2, -radius + 6, radius - 2, radius * 2 - 12, 4);
    context.fill();
    // Headlights point forward.
    context.fillStyle = '#fff7cc';
    context.fillRect(radius + 2, -radius + 5, 5, 5);
    context.fillRect(radius + 2, radius - 10, 5, 5);
    context.restore();
  }

  function drawWorld(state) {
    drawCity(state);
    const job = JOBS[state.jobIndex];
    const blink = Math.floor(state.elapsed * 2) % 2 === 0;
    // Job markers (pulsing rings).
    if (state.jobStage === 'pickup' && !state.hasPackage) {
      context.strokeStyle = PALETTE.package;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(job.pickup.x, job.pickup.y, blink ? 26 : 20, 0, Math.PI * 2);
      context.stroke();
      drawMarker(job.pickup.x, job.pickup.y, PALETTE.package, '$');
    } else if (state.jobStage === 'deliver') {
      context.strokeStyle = PALETTE.package;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(job.drop.x, job.drop.y, blink ? 30 : 22, 0, Math.PI * 2);
      context.stroke();
      drawMarker(job.drop.x, job.drop.y, PALETTE.package, '$');
    }
    // Traffic.
    const trafficColors = [PALETTE.traffic, '#7dd3fc', '#fca5a5', '#fde68a'];
    for (const t of state.traffic) {
      if (!t.active) continue;
      drawCar(t.x, t.y, t.angle, trafficColors[t.color % trafficColors.length], '#1f2937', t.radius);
    }
    // Pedestrians.
    for (const p of state.peds) {
      if (!p.active) continue;
      context.fillStyle = p.down > 0 ? PALETTE.damage : PALETTE.ped;
      context.beginPath();
      context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      context.fill();
    }
    // Cops, with flashing light bars.
    for (const c of state.cops) {
      if (!c.active) continue;
      drawCar(c.x, c.y, c.angle, '#1e3a8a', '#0f172a', c.radius);
      const flash = Math.floor(state.elapsed * 6) % 2 === 0;
      context.fillStyle = flash ? PALETTE.copLightR : PALETTE.copLightB;
      context.beginPath();
      context.arc(c.x, c.y - 4, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? PALETTE.copLightB : PALETTE.copLightR;
      context.beginPath();
      context.arc(c.x, c.y + 4, 5, 0, Math.PI * 2);
      context.fill();
    }
    // The player's car.
    const pc = state.playerCar;
    drawCar(pc.x, pc.y, pc.angle, PALETTE.playerCar, '#78350f', pc.radius);
    // The player on foot.
    if (!state.player.inCar) {
      const p = state.player;
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#0b0f1a';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
      context.stroke();
    }
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    // Cash + job.
    text(cashLabel(state.cash), 24, 18, 30, PALETTE.cash, 'left');
    const job = JOBS[state.jobIndex];
    text(jobLabel(state.jobStage === 'done' ? 'All jobs done' : job.name), 24, 54, 20, PALETTE.text, 'left');
    const target = state.jobStage === 'pickup' ? job.pickup : job.drop;
    const px = state.player.inCar ? state.playerCar.x : state.player.x;
    const py = state.player.inCar ? state.playerCar.y : state.player.y;
    const d = Math.round(Math.hypot(target.x - px, target.y - py));
    text(state.jobStage === 'done' ? '' : `${state.jobStage === 'pickup' ? 'Pick up' : 'Deliver'} · ${d}m`, 24, 80, 20, PALETTE.muted, 'left');
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', 24 + i * 30, 112, 28, i < state.wanted ? PALETTE.star : '#2a3040', 'left');
    }
    // Car health + speed. The bar starts after the label, so it never covers
    // the number (the label is widest at full health, "CAR 100").
    const health = Math.max(0, Math.round(state.playerCar.health));
    const healthText = healthLabel(health);
    text(healthText, 24, 148, 20, health > 30 ? PALETTE.text : PALETTE.damage, 'left');
    const barX = 24 + context.measureText(healthText).width + 10;
    context.fillStyle = '#2a3040';
    context.fillRect(barX, 150, 150, 14);
    context.fillStyle = health > 30 ? PALETTE.neonGreen : PALETTE.damage;
    context.fillRect(barX, 150, Math.round(150 * health / CAR.health), 14);
    const speed = Math.round(Math.hypot(state.playerCar.vx, state.playerCar.vy) * 0.36);
    text(speedLabel(state.player.inCar ? `${speed} km/h` : 'On foot'), 24, 176, 20, PALETTE.text, 'left');
    // Job clock.
    const t = Math.max(0, Math.ceil(state.jobTimer));
    text(timerLabel(state.jobStage === 'done' ? '' : `⏱ ${t}s`), 24, 204, 20, t < 30 && state.jobStage !== 'done' ? PALETTE.damage : PALETTE.text, 'left');
    // Message banner (centred).
    if (state.messageTimer > 0 && state.message) {
      context.textBaseline = 'alphabetic';
      const w = context.measureText(state.message).width + 40;
      context.fillStyle = 'rgba(20,24,38,0.92)';
      context.fillRect((VIEW.width - w) / 2, 236, w, 44);
      text(state.message, VIEW.width / 2, 266, 20, PALETTE.text, 'center');
      context.textBaseline = 'top';
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    context.fillStyle = 'rgba(10,13,24,0.9)';
    context.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    context.strokeStyle = '#3a3f4d';
    context.lineWidth = 1;
    context.strokeRect(MAP.x, MAP.y, MAP.w, MAP.h);
    // Roads.
    context.strokeStyle = '#4b5563';
    context.lineWidth = 2;
    for (const cx of ROADS_X) {
      context.beginPath();
      context.moveTo(MAP.x + cx * sx, MAP.y);
      context.lineTo(MAP.x + cx * sx, MAP.y + MAP.h);
      context.stroke();
    }
    for (const cy of ROADS_Y) {
      context.beginPath();
      context.moveTo(MAP.x, MAP.y + cy * sy);
      context.lineTo(MAP.x + MAP.w, MAP.y + cy * sy);
      context.stroke();
    }
    // Job target.
    const job = JOBS[state.jobIndex];
    if (state.jobStage !== 'done') {
      const t = state.jobStage === 'pickup' ? job.pickup : job.drop;
      context.fillStyle = PALETTE.package;
      context.beginPath();
      context.arc(MAP.x + t.x * sx, MAP.y + t.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Cops.
    context.fillStyle = PALETTE.copLightB;
    for (const c of state.cops) {
      if (!c.active) continue;
      context.beginPath();
      context.arc(MAP.x + c.x * sx, MAP.y + c.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Player.
    const px = state.player.inCar ? state.playerCar.x : state.player.x;
    const py = state.player.inCar ? state.playerCar.y : state.player.y;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(MAP.x + px * sx, MAP.y + py * sy, 4, 0, Math.PI * 2);
    context.fill();
    // Viewport box.
    context.strokeStyle = 'rgba(238,241,245,0.5)';
    context.lineWidth = 1;
    context.strokeRect(
      MAP.x + state.camera.x * sx,
      MAP.y + state.camera.y * sy,
      VIEW.width * sx,
      VIEW.height * sy,
    );
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.neonPink;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.neonCyan, 'center');
    context.textBaseline = 'top';
  }

  const TITLE_LINES = [
    'A neon coastal city. Five jobs. One way out.',
    'Drive with W A S D or arrows. E: get in / out of a car.',
    'Space: handbrake drift. P: pause. Steal cars, lose the cops.',
    '',
  ];
  const PAUSED_LINES = ['The city waits for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // World space: scale, then shift by the camera.
    context.setTransform(
      view.scale, 0, 0, view.scale,
      view.x - state.camera.x * view.scale,
      view.y - state.camera.y * view.scale,
    );
    drawWorld(state);
    // Screen space: the 1280x720 view, no camera.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = `Best cash $${best}`;
      drawPanel('VICE BAY', TITLE_LINES, 'Press Enter or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = state.busted ? 'Busted — the cops got you on foot.' : 'Wrecked — your car is totaled.';
      OVER_LINES[1] = `Cash $${state.cash} · Best $${best}`;
      drawPanel('Game over', OVER_LINES, 'Press Enter or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `All five jobs done. Cash $${state.cash}.`;
      WIN_LINES[1] = `Best $${Math.max(best, state.cash)}`;
      drawPanel('YOU OWN VICE BAY', WIN_LINES, 'Press Enter or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
