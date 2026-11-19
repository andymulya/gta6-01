// Drawing only: the world's state and the current screen in, pixels out. The
// camera shows a 1280x720 window of the 2560x1920 sun-soaked city; the HUD and
// minimap are drawn in screen space on top. Flat shapes and canvas text.
import {
  AMMO_COST, BEACH_Y, CAR, COP, FONT, PALETTE, RADIO_STATIONS, ROADS_X, ROADS_Y, ROAD_W,
  SMG_COST, UPGRADES, VIEW, WORLD, carMaxHealth, upgradeCost,
} from './config.js';
import { JOBS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 660, top: 150, line: 30, bottom: 70 };
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
    // Ground: bright sun-lit blocks, then the pale beach and turquoise sea.
    context.fillStyle = '#e8e0c8';
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, WORLD.height - BEACH_Y);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BEACH_Y + 84, WORLD.width, WORLD.height - BEACH_Y - 84);
    // Gentle waves in the water.
    context.fillStyle = PALETTE.waterDeep;
    for (let y = BEACH_Y + 100; y < WORLD.height; y += 34) {
      for (let x = ((y * 7) % 160); x < WORLD.width; x += 160) {
        context.fillRect(x, y, 70, 4);
      }
    }
    // Parks: green lawns with palm trees.
    for (const p of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(p.x, p.y, p.width, p.height);
    }
    for (const palm of city.palms) {
      context.strokeStyle = PALETTE.palmTrunk;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(palm.x, palm.y + 8);
      context.lineTo(palm.x, palm.y - 6);
      context.stroke();
      context.fillStyle = PALETTE.palmLeaf;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + palm.x * 0.01;
        context.beginPath();
        context.ellipse(palm.x + Math.cos(a) * 9, palm.y - 6 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Sidewalks, then roads.
    context.fillStyle = PALETTE.sidewalk;
    for (const cx of ROADS_X) context.fillRect(cx - ROAD_W / 2 - 14, 0, ROAD_W + 28, BEACH_Y);
    for (const cy of ROADS_Y) context.fillRect(0, cy - ROAD_W / 2 - 14, WORLD.width, ROAD_W + 28);
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
    // Pastel Art Deco buildings with sun-lit roofs and windows.
    for (const b of city.buildings) {
      context.fillStyle = PALETTE[b.kind];
      context.fillRect(b.x, b.y, b.width, b.height);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(b.x, b.y, b.width, 6);
      context.fillStyle = '#334155';
      const cols = Math.max(1, Math.floor(b.width / 26));
      const rows = Math.max(1, Math.floor(b.height / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 13 + b.x) % 5 !== 0) continue;
          context.globalAlpha = 0.55;
          context.fillRect(b.x + 8 + c * 26, b.y + 10 + r * 26, 8, 10);
        }
      }
      context.globalAlpha = 1;
    }
    // Safehouse + garage + gun shop markers (fixed, always drawn).
    drawMarker(city.locations.safehouse.x, city.locations.safehouse.y, PALETTE.neonCyan, 'H');
    drawMarker(city.locations.garage.x, city.locations.garage.y, PALETTE.neonAmber, 'G');
    drawMarker(city.locations.weaponShop.x, city.locations.weaponShop.y, '#dc2626', 'W');
  }

  function drawMarker(x, y, color, letter) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, 16, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 2;
    context.stroke();
    text(letter, x, y + 6, 18, '#ffffff', 'center');
  }

  function drawCar(x, y, angle, body, roof, radius) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.roundRect(-radius - 3, -radius + 5, radius * 2 + 12, radius * 2 - 4, 7);
    context.fill();
    context.fillStyle = body;
    context.beginPath();
    context.roundRect(-radius - 6, -radius + 2, radius * 2 + 12, radius * 2 - 4, 7);
    context.fill();
    context.fillStyle = roof;
    context.beginPath();
    context.roundRect(-radius + 2, -radius + 6, radius - 2, radius * 2 - 12, 4);
    context.fill();
    context.fillStyle = '#fff7cc';
    context.fillRect(radius + 2, -radius + 5, 5, 5);
    context.fillRect(radius + 2, radius - 10, 5, 5);
    context.restore();
  }

  function drawHeli(state) {
    const h = state.heli;
    if (!h.active) return;
    const px = state.player.inCar ? state.playerCar.x : state.player.x;
    const py = state.player.inCar ? state.playerCar.y : state.player.y;
    // Spotlight cone down onto the player.
    context.fillStyle = 'rgba(255,244,180,0.22)';
    context.beginPath();
    context.moveTo(h.x, h.y);
    context.lineTo(px - 70, py - 40);
    context.lineTo(px + 70, py + 40);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(255,244,180,0.35)';
    context.beginPath();
    context.arc(px, py, 46, 0, Math.PI * 2);
    context.fill();
    // Body + tail + spinning rotor.
    context.save();
    context.translate(h.x, h.y);
    context.rotate(h.angle);
    context.fillStyle = '#1e293b';
    context.fillRect(-34, -4, 18, 8);
    context.fillStyle = '#0f172a';
    context.beginPath();
    context.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0f172a';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(Math.cos(h.rotor) * 34, Math.sin(h.rotor) * 34);
    context.lineTo(-Math.cos(h.rotor) * 34, -Math.sin(h.rotor) * 34);
    context.moveTo(Math.cos(h.rotor + Math.PI / 2) * 30, Math.sin(h.rotor + Math.PI / 2) * 30);
    context.lineTo(-Math.cos(h.rotor + Math.PI / 2) * 30, -Math.sin(h.rotor + Math.PI / 2) * 30);
    context.stroke();
    context.fillStyle = '#ef4444';
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();
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
    // Roadblocks: two parked cop cars + a striped barrier between them.
    for (const r of state.roadblocks) {
      if (!r.active) continue;
      drawCar(r.x, r.y, r.angle, '#1e3a8a', '#0f172a', r.radius);
      context.save();
      context.translate(r.x, r.y);
      context.rotate(r.angle + Math.PI / 2);
      for (let i = -1; i <= 1; i += 1) {
        context.fillStyle = i % 2 === 0 ? '#f8fafc' : '#dc2626';
        context.fillRect(i * 12 - 6, -6, 12, 12);
      }
      context.restore();
    }
    // Traffic.
    const trafficColors = [PALETTE.traffic, '#7dd3fc', '#fca5a5', '#fde68a', '#86efac', '#f0abfc'];
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
    // Gang shooters: red, with a gun barrel and a health pip.
    for (const g of state.gang) {
      if (!g.active) continue;
      context.fillStyle = '#991b1b';
      context.beginPath();
      context.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#111827';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(g.x, g.y);
      context.lineTo(g.x + Math.cos(g.angle) * 20, g.y + Math.sin(g.angle) * 20);
      context.stroke();
      context.fillStyle = '#ef4444';
      for (let i = 0; i < g.health; i += 1) context.fillRect(g.x - 12 + i * 8, g.y - 22, 6, 4);
    }
    // Bullets.
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.fillStyle = b.fromGang ? '#ef4444' : '#facc15';
      context.beginPath();
      context.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
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
    drawCar(pc.x, pc.y, pc.angle, PALETTE.playerCar, '#7f1d1d', pc.radius);
    // The player on foot, with a gun barrel and muzzle flash.
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
      context.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      context.stroke();
      if (state.muzzle > 0) {
        context.fillStyle = '#fde047';
        context.beginPath();
        context.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 8, 0, Math.PI * 2);
        context.fill();
      }
      // Health pips above the player when hurt.
      if (state.playerHealth < 100) {
        context.fillStyle = '#dc2626';
        context.fillRect(p.x - 14, p.y - 24, 28 * Math.max(0, state.playerHealth) / 100, 4);
      }
    }
    drawHeli(state);
  }

  function drawHud(state, screen) {
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
      text('★', 24 + i * 30, 112, 28, i < state.wanted ? PALETTE.star : '#94a3b8', 'left');
    }
    if (state.heli.active) text('HELI OVERHEAD — stay out of the spotlight', 24, 380, 16, PALETTE.damage, 'left');
    // Car health + speed. The bar starts after the label, so it never covers
    // the number (the label is widest at full health, "CAR 100").
    const health = Math.max(0, Math.round(state.playerCar.health));
    const healthText = healthLabel(health);
    text(healthText, 24, 148, 20, health > 30 ? PALETTE.text : PALETTE.damage, 'left');
    const barX = 24 + context.measureText(healthText).width + 10;
    context.fillStyle = '#cbd5e1';
    context.fillRect(barX, 150, 150, 14);
    context.fillStyle = health > 30 ? PALETTE.neonGreen : PALETTE.damage;
    context.fillRect(barX, 150, Math.round(150 * health / carMaxHealth(state.upgrades)), 14);
    const speed = Math.round(Math.hypot(state.playerCar.vx, state.playerCar.vy) * 0.36);
    text(speedLabel(state.player.inCar ? `${speed} km/h` : 'On foot'), 24, 176, 20, PALETTE.text, 'left');
    // Job clock.
    const t = Math.max(0, Math.ceil(state.jobTimer));
    text(timerLabel(state.jobStage === 'done' ? '' : `⏱ ${t}s`), 24, 204, 20, t < 30 && state.jobStage !== 'done' ? PALETTE.damage : PALETTE.text, 'left');
    // Weapon + ammo + respect + radio (right of the minimap, lower left block).
    text(`🔫 ${state.weapon === 'smg' ? 'SMG' : 'Pistol'} · Ammo ${state.ammo}`, 24, 236, 20, PALETTE.text, 'left');
    text(`Respect ${state.respect}`, 24, 264, 20, PALETTE.text, 'left');
    text(`♪ ${RADIO_STATIONS[state.radio]} (R)`, 24, 292, 18, PALETTE.muted, 'left');
    if (!state.player.inCar) {
      text(`You: ${Math.round(state.playerHealth)} HP`, 24, 320, 18, state.playerHealth > 30 ? PALETTE.text : PALETTE.damage, 'left');
    }
    if (state.saveFlash > 0) text('✓ Saved', 24, 348, 18, PALETTE.cash, 'left');
    // Context hints: garage upgrades, gun shop, safehouse.
    const g = state.city.locations.garage;
    const w = state.city.locations.weaponShop;
    const sh = state.city.locations.safehouse;
    let hintY = 560;
    const hint = (s) => { text(s, 24, hintY, 18, PALETTE.text, 'left'); hintY += 26; };
    if (state.player.inCar && Math.hypot(px - g.x, py - g.y) < 160) {
      hint(`GARAGE — 1 Engine Lv${state.upgrades.engine}/3 $${upgradeCost('engine', state.upgrades.engine)} · 2 Armor Lv${state.upgrades.armor}/3 $${upgradeCost('armor', state.upgrades.armor)} · 3 Tires Lv${state.upgrades.tires}/3 $${upgradeCost('tires', state.upgrades.tires)}`);
      hint('E repairs the car ($200) · Q quick-saves');
    } else if (!state.player.inCar && Math.hypot(px - w.x, py - w.y) < 130) {
      hint(`GUN SHOP — 4 SMG $${SMG_COST} · 5 Ammo +${60} $${AMMO_COST}`);
    } else if (state.player.inCar && Math.hypot(px - sh.x, py - sh.y) < 160) {
      hint('SAFEHOUSE — heat drops fast, car repairs free');
    }
    // Message banner (centred).
    if (state.messageTimer > 0 && state.message) {
      context.textBaseline = 'alphabetic';
      const w2 = context.measureText(state.message).width + 40;
      context.fillStyle = 'rgba(255,247,230,0.95)';
      context.fillRect((VIEW.width - w2) / 2, 236, w2, 44);
      context.strokeStyle = PALETTE.neonAmber;
      context.lineWidth = 2;
      context.strokeRect((VIEW.width - w2) / 2, 236, w2, 44);
      text(state.message, VIEW.width / 2, 266, 20, PALETTE.text, 'center');
      context.textBaseline = 'top';
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    context.fillStyle = 'rgba(255,247,230,0.92)';
    context.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    context.strokeStyle = '#94a3b8';
    context.lineWidth = 1;
    context.strokeRect(MAP.x, MAP.y, MAP.w, MAP.h);
    // Water strip.
    context.fillStyle = PALETTE.water;
    context.fillRect(MAP.x, MAP.y + BEACH_Y * sy, MAP.w, MAP.h - BEACH_Y * sy);
    // Roads.
    context.strokeStyle = '#64748b';
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
    // Heli.
    if (state.heli.active) {
      context.fillStyle = '#0f172a';
      context.beginPath();
      context.arc(MAP.x + state.heli.x * sx, MAP.y + state.heli.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Player.
    const px = state.player.inCar ? state.playerCar.x : state.player.x;
    const py = state.player.inCar ? state.playerCar.y : state.player.y;
    context.fillStyle = PALETTE.playerCar;
    context.beginPath();
    context.arc(MAP.x + px * sx, MAP.y + py * sy, 4, 0, Math.PI * 2);
    context.fill();
    // Viewport box.
    context.strokeStyle = 'rgba(22,32,43,0.6)';
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
    context.strokeStyle = PALETTE.neonAmber;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, '#b45309', 'center');
    context.textBaseline = 'top';
  }

  const TITLE_LINES = [
    'A sun-soaked coastal city. Ten jobs. One way out.',
    'Drive with W A S D or arrows. E: get in / out of a car.',
    'Mouse aim, click to shoot. R: radio. Q: quick-save.',
    'Garage upgrades, gun shop, safehouse, helicopter at 4 stars.',
    '',
    '',
  ];
  const PAUSED_LINES = ['The city waits for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, best, saveExists) {
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
      TITLE_LINES[4] = `Best cash $${best}`;
      TITLE_LINES[5] = saveExists ? 'Save found — press C to continue your run.' : '';
      drawPanel('VICE BAY II', TITLE_LINES, saveExists ? 'Enter: new game · C: continue' : 'Press Enter or click to start');
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = state.busted ? 'Busted — the cops got you on foot.' : 'Wrecked — your car is totaled.';
      OVER_LINES[1] = `Cash $${state.cash} · Respect ${state.respect} · Best $${best}`;
      drawPanel('Game over', OVER_LINES, 'Press Enter or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `All ten jobs done. Cash $${state.cash}. Respect ${state.respect}.`;
      WIN_LINES[1] = `Best $${Math.max(best, state.cash)}`;
      drawPanel('YOU OWN VICE BAY', WIN_LINES, 'Press Enter or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
