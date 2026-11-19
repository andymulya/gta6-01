// The city itself: a seeded road grid with buildings, parks, a beach and the
// fixed key locations (safehouse, garage, job pickups and drop-offs). Pure data
// — no drawing, no browser — so the same seed always builds the same city.
import { BEACH_Y, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';

// A building is an axis-aligned box with a neon trim colour.
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const half = ROAD_W / 2;
  const sidewalk = 14;

  // Blocks sit between neighbouring road centre-lines.
  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, BEACH_Y];
  const trims = ['neonPink', 'neonCyan', 'neonAmber', 'neonGreen'];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + (bx === 0 ? 0 : half + sidewalk);
      const x1 = xs[bx + 1] - (bx === xs.length - 2 ? 0 : half + sidewalk);
      const y0 = ys[by] + (by === 0 ? 0 : half + sidewalk);
      const y1 = ys[by + 1] - (by === ys.length - 2 ? 0 : half + sidewalk);
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      const roll = random();
      // A few blocks are parks; the rest hold one or two buildings.
      if (roll < 0.12) {
        parks.push({ x: x0, y: y0, width: w, height: h });
        continue;
      }
      const kind = random() < 0.4 ? 'buildingA' : random() < 0.5 ? 'buildingB' : random() < 0.5 ? 'buildingC' : 'buildingD';
      const trim = trims[Math.floor(random() * trims.length)];
      if (w > 150 && h > 150 && random() < 0.5) {
        // Two buildings side by side with a gap between them.
        const split = x0 + w * (0.35 + random() * 0.3);
        buildings.push({ x: x0, y: y0, width: split - x0 - 8, height: h, kind, trim });
        buildings.push({ x: split + 8, y: y0, width: x1 - split - 8, height: h, kind, trim });
      } else {
        const inset = 6 + random() * 14;
        buildings.push({ x: x0 + inset, y: y0 + inset, width: w - inset * 2, height: h - inset * 2, kind, trim });
      }
    }
  }

  // Key locations, all on road edges so a car can reach them.
  const locations = {
    safehouse: { x: 320, y: 224 },
    garage: { x: 1920, y: 224 },
    pier: { x: 1280, y: 1696 },
    weaponShop: { x: 960, y: 224 },
  };
  // Palm trees: a few per park, seeded positions so the same seed always
  // grows the same palms.
  const palms = [];
  for (const p of parks) {
    const n = 3 + Math.floor(random() * 4);
    for (let i = 0; i < n; i += 1) {
      palms.push({ x: p.x + 20 + random() * Math.max(1, p.width - 40), y: p.y + 20 + random() * Math.max(1, p.height - 40) });
    }
  }
  return { buildings, parks, palms, locations };
}

/** True when the point is on a road (drivable for cars). */
export function onRoad(x, y) {
  if (y >= BEACH_Y) return false;
  for (const cx of ROADS_X) if (Math.abs(x - cx) <= ROAD_W / 2) return true;
  for (const cy of ROADS_Y) if (Math.abs(y - cy) <= ROAD_W / 2) return true;
  return false;
}

/** True when the point is inside a building. */
export function insideBuilding(city, x, y) {
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return true;
  }
  return false;
}

/** Push a circle (x, y, radius) out of every building it overlaps; returns true when it hit one. */
export function resolveBuildings(city, body) {
  let hit = false;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.width));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.height));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.radius * body.radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (body.radius - d) / d;
      body.x += dx * push;
      body.y += dy * push;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const left = body.x - b.x + body.radius;
      const right = b.x + b.width - body.x + body.radius;
      const top = body.y - b.y + body.radius;
      const bottom = b.y + b.height - body.y + body.radius;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - body.radius;
      else if (m === right) body.x = b.x + b.width + body.radius;
      else if (m === top) body.y = b.y - body.radius;
      else body.y = b.y + b.height + body.radius;
    }
  }
  return hit;
}
