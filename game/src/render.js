// Drawing only: the world's state and the current screen in, pixels out. A camera
// follows the player across the 3000x2200 city and paints a 1280x720 window, scaled
// to fit the browser window. Flat shapes and canvas text: ground and districts,
// roads with dashes, buildings, cars, the player, police lights, the mission
// marker, the HUD (cash, job, wanted stars, health, clock, district) and a minimap.
import { CAR, DISTRICTS, FONT, PALETTE, PLAYER, RIVER_Y, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';
import { missionAt, objectiveLabel } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const VIEW_W = 1280;
const VIEW_H = 720;
const PANEL = { width: 640, top: 120, line: 32, bottom: 64 };
const MAP_W = 210;
const MAP_H = 154;

function cachedLabel(prefix) {
  let value = '';
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
  const cam = { x: 0, y: 0 };
  const cashLabel = cachedLabel('$');
  const clockLabel = cachedLabel('');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** Convert a canvas CSS pixel (mouse click) to world coordinates. */
  function screenToWorld(sx, sy) {
    const ratio = window.devicePixelRatio || 1;
    const px = (sx * ratio - view.x) / view.scale;
    const py = (sy * ratio - view.y) / view.scale;
    return { x: cam.x + px, y: cam.y + py };
  }

  function drawGround(state) {
    context.fillStyle = PALETTE.ground;
    context.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
    // District tints.
    for (const d of DISTRICTS) {
      if (d.name === 'Foundry') context.fillStyle = PALETTE.groundFoundry;
      else if (d.name === 'The Yards') context.fillStyle = PALETTE.groundYards;
      else if (d.name === 'Riverside') context.fillStyle = PALETTE.groundRiverside;
      else continue;
      context.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    // River along the south edge.
    context.fillStyle = PALETTE.river;
    context.fillRect(0, RIVER_Y, WORLD.width, WORLD.height - RIVER_Y);
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_H) context.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_V) {
      for (let y = 20; y < WORLD.height; y += 90) context.fillRect(rx - 2, y, 4, 44);
    }
    for (const ry of ROADS_H) {
      for (let x = 20; x < WORLD.width; x += 90) context.fillRect(x, ry - 2, 44, 4);
    }
    // District names, faint, at district centres.
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const d of DISTRICTS) {
      text(d.name.toUpperCase(), (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, 30, 'rgba(242, 237, 228, 0.13)', 'center');
    }
    // Buildings.
    for (const b of state.city.buildings) {
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, Math.max(8, b.h - 16));
    }
  }

  function drawCarShape(x, y, angle, length, width, color, light) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(-length / 2 + 2, -width / 2 + 3, length, width);
    context.fillStyle = color;
    context.fillRect(-length / 2, -width / 2, length, width);
    context.fillStyle = 'rgba(180, 210, 235, 0.85)';
    context.fillRect(length * 0.08, -width / 2 + 3, length * 0.22, width - 6);
    context.fillStyle = 'rgba(255, 240, 180, 0.9)';
    context.fillRect(length / 2 - 3, -width / 2 + 2, 3, 5);
    context.fillRect(length / 2 - 3, width / 2 - 7, 3, 5);
    if (light) {
      context.fillStyle = light;
      context.beginPath();
      context.arc(-length / 2 + 4, 0, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawMarker(state, marker, time) {
    if (!marker) return;
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    const r = 16 * pulse;
    context.save();
    context.translate(marker.x, marker.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.marker;
    context.fillRect(-r / 2, -r / 2, r, r);
    context.strokeStyle = PALETTE.markerRing;
    context.lineWidth = 3;
    context.strokeRect(-r / 2, -r / 2, r, r);
    context.restore();
    // A beacon line up into the sky so the marker reads from far away.
    context.strokeStyle = 'rgba(255, 217, 74, 0.55)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(marker.x, marker.y - 14);
    context.lineTo(marker.x, marker.y - 90);
    context.stroke();
  }

  function drawWorld(state, marker, time) {
    const p = state.player;
    cam.x = Math.max(0, Math.min(WORLD.width - VIEW_W, p.x - VIEW_W / 2));
    cam.y = Math.max(0, Math.min(WORLD.height - VIEW_H, p.y - VIEW_H / 2));
    context.save();
    context.translate(-cam.x, -cam.y);
    drawGround(state);
    drawMarker(state, marker, time);
    // Cash drop.
    if (state.cashDrop) {
      context.fillStyle = '#37d67a';
      context.beginPath();
      context.arc(state.cashDrop.x, state.cashDrop.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d3d1e';
      text('$', state.cashDrop.x, state.cashDrop.y, 18, '#0d3d1e', 'center');
    }
    // Pedestrians.
    for (const ped of state.peds) {
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, ped.r, 0, Math.PI * 2);
      context.fill();
    }
    // Parked and traffic cars.
    for (const car of state.cars) {
      if (car === p.inCar) continue;
      drawCarShape(car.x, car.y, car.angle, CAR.length, CAR.width, car.color, car.disabled ? '#888888' : null);
      if (car.disabled) {
        context.fillStyle = 'rgba(120, 120, 120, 0.5)';
        context.beginPath();
        context.arc(car.x, car.y - 12, 10, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Armored truck.
    if (state.truck) {
      const t = state.truck;
      drawCarShape(t.x, t.y, t.angle, 64, 30, PALETTE.truck, t.stopped ? '#ff2e2e' : null);
      if (!t.stopped) {
        context.fillStyle = PALETTE.text;
        text(`ARMOR ${Math.max(0, Math.ceil(t.integrity))}`, t.x, t.y - 26, 14, PALETTE.text, 'center');
      }
    }
    // Police.
    for (const car of state.police) {
      const flash = Math.floor(time * 6) % 2 === 0 ? PALETTE.policeLightR : PALETTE.policeLightB;
      drawCarShape(car.x, car.y, car.angle, CAR.length, CAR.width, PALETTE.police, car.disabled ? null : flash);
      if (!car.disabled) {
        context.fillStyle = flash;
        context.beginPath();
        context.arc(car.x, car.y - 16, 6, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Smoke puffs.
    for (const s of state.smoke) {
      context.fillStyle = 'rgba(150, 150, 150, 0.45)';
      context.beginPath();
      context.arc(s.x, s.y, 14, 0, Math.PI * 2);
      context.fill();
    }
    // The player: in a car, or on foot as a figure with a facing tick.
    if (p.inCar) {
      drawCarShape(p.inCar.x, p.inCar.y, p.inCar.angle, CAR.length, CAR.width, p.inCar.color, null);
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.inCar.x, p.inCar.y, 5, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#7a5c00';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      context.stroke();
    }
    // Muzzle flash.
    if (state.muzzle) {
      context.fillStyle = 'rgba(255, 220, 90, 0.9)';
      context.beginPath();
      context.arc(state.muzzle.x, state.muzzle.y, 12, 0, Math.PI * 2);
      context.fill();
    }
    // Night tint after 20:00.
    if (state.clockMin >= 20 * 60 || state.clockMin < 6 * 60) {
      context.fillStyle = PALETTE.night;
      context.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
    }
    context.restore();
  }

  function drawHud(state, screen, time, saved) {
    const p = state.player;
    context.textBaseline = 'top';
    // Cash + job, top left.
    text(cashLabel(state.cash), 20, 16, 30, PALETTE.text, 'left');
    const mission = missionAt(state.mission);
    text(`Job ${state.mission + 1}/${5}: ${mission.name}`, 20, 52, 20, PALETTE.marker, 'left');
    text(objectiveLabel(state.mission, state.step), 20, 78, 17, PALETTE.muted, 'left');
    if (mission.timed) {
      text(`Time left: ${Math.max(0, Math.ceil(state.missionTimer))}s`, 20, 100, 18,
        state.missionTimer < 20 ? PALETTE.healthLow : PALETTE.text, 'left');
    }
    // The mission message sits centred along the bottom, clear of the bars
    // (bottom left) and the minimap (bottom right).
    if (state.missionMsg) {
      text(state.missionMsg, VIEW_W / 2, VIEW_H - 14, 16, PALETTE.muted, 'center');
    }
    // Wanted stars + clock + district, top right.
    const hh = String(Math.floor(state.clockMin / 60)).padStart(2, '0');
    const mm = String(state.clockMin % 60).padStart(2, '0');
    text(clockLabel(`${hh}:${mm}`), VIEW_W - 20, 16, 22, PALETTE.text, 'right');
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, VIEW_W - 20, 44, 26, PALETTE.star, 'right');
    text(state.district || '', VIEW_W - 20, 78, 16, PALETTE.muted, 'right');
    if (saved) text('Saved ✓', VIEW_W - 20, 104, 16, PALETTE.health, 'right');
    // Health bar, bottom left; the car bar sits above it with its own label.
    const bw = 220;
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(20, VIEW_H - 46, bw, 16);
    context.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(20, VIEW_H - 46, Math.max(0, (bw * p.health) / 100), 16);
    text('HEALTH', 20, VIEW_H - 64, 14, PALETTE.text, 'left');
    if (p.inCar) {
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(20, VIEW_H - 82, bw, 10);
      context.fillStyle = p.inCar.integrity > 30 ? '#7db8e8' : PALETTE.healthLow;
      context.fillRect(20, VIEW_H - 82, Math.max(0, (bw * p.inCar.integrity) / 100), 10);
      text('CAR', 20, VIEW_H - 98, 14, PALETTE.text, 'left');
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mx = VIEW_W - MAP_W - 16;
    const my = VIEW_H - MAP_H - 16;
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    context.fillStyle = 'rgba(13, 15, 18, 0.82)';
    context.fillRect(mx - 4, my - 4, MAP_W + 8, MAP_H + 8);
    context.fillStyle = PALETTE.ground;
    context.fillRect(mx, my, MAP_W, MAP_H);
    context.fillStyle = PALETTE.river;
    context.fillRect(mx, my + RIVER_Y * sy, MAP_W, (WORLD.height - RIVER_Y) * sy);
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) context.fillRect(mx + rx * sx - 1, my, 2, MAP_H);
    for (const ry of ROADS_H) context.fillRect(mx, my + ry * sy - 1, MAP_W, 2);
    context.fillStyle = '#888888';
    for (const b of state.city.buildings) context.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    const marker = state.marker;
    if (marker) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.police) {
      if (car.disabled) continue;
      context.fillStyle = PALETTE.policeLightR;
      context.beginPath();
      context.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(mx + state.player.x * sx, my + state.player.y * sy, 6, 0, Math.PI * 2);
    context.stroke();
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW_W - PANEL.width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(13, 15, 18, 0.72)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW_W / 2, y + 72, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW_W / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 34, 22, PALETTE.marker, 'center');
  }

  const TITLE_LINES = [
    'Rustline — an open-world crime game.',
    'Steal cars, lose the heat, run five jobs for Marlowe.',
    'WASD / arrows move and drive · E steal or exit a car',
    'Space punch · Click shoot · Q save · P pause · M sound',
    '',
  ];
  const PAUSED_LINES = ['The city waits for you.'];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the world, then the HUD or a panel for the screen. */
  function draw(state, screen, best, saved, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const marker = screen === SCREEN_PLAY ? state.marker : null;
    drawWorld(state, marker, time);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? `Best haul: $${best}` : 'A new driver in town.';
      drawPanel('RUSTLINE', TITLE_LINES, 'Press Enter to start · C to continue a save');
      return;
    }
    drawHud(state, screen, time, saved);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      drawPanel('Busted', [`The cops took $${state.bustedFine ?? 0}.`, 'Marlowe bailed you out.'], 'Press Enter to keep playing');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `All five jobs done. Total haul: $${state.cash}.`;
      WIN_LINES[1] = 'Rustline is yours.';
      drawPanel('RUSTLINE IS YOURS', WIN_LINES, 'Press Enter to keep roaming · C for a new game');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
