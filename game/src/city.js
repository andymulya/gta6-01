// The city of Rustline, built once from a fixed seed so the map is the same every
// run: road grid, district ground tints, building blocks, the river, and the named
// places. Buildings sit inside the blocks between roads, never on a road.
import { DISTRICTS, PLACES, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';
import { createRandom, pick, randInt } from './random.js';

const CITY_SEED = 1337;
const BUILDING_COLORS = ['#5b4a38', '#4a5560', '#6b5a44', '#54423a', '#46505c'];
const BLOCK_MARGIN = 52;

function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_W / 2 + 24) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_W / 2 + 24) return true;
  return false;
}

/** Nearest point on any road centreline to (x, y). Used to place police and markers. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y: Math.max(60, Math.min(WORLD.height - 60, y)) };
    }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = { x: Math.max(60, Math.min(WORLD.width - 60, x)), y: ry };
    }
  }
  return best;
}

export function buildCity() {
  const random = createRandom(CITY_SEED);
  const buildings = [];
  // One or two buildings per block between neighbouring roads.
  for (let vi = 0; vi < ROADS_V.length - 1; vi += 1) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi += 1) {
      const x0 = ROADS_V[vi] + ROAD_W / 2 + BLOCK_MARGIN;
      const x1 = ROADS_V[vi + 1] - ROAD_W / 2 - BLOCK_MARGIN;
      const y0 = ROADS_H[hi] + ROAD_W / 2 + BLOCK_MARGIN;
      const y1 = ROADS_H[hi + 1] - ROAD_W / 2 - BLOCK_MARGIN;
      if (x1 - x0 < 90 || y1 - y0 < 70) continue;
      const count = random() < 0.55 ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = randInt(random, 90, Math.min(220, x1 - x0 - 20));
        const h = randInt(random, 70, Math.min(170, y1 - y0 - 20));
        const bx = x0 + Math.floor(random() * Math.max(1, x1 - x0 - w));
        const by = y0 + Math.floor(random() * Math.max(1, y1 - y0 - h));
        // Keep the garage block and the chop-shop block clear so missions stay reachable.
        if (Math.abs(bx + w / 2 - PLACES.garage.x) < 160 && Math.abs(by + h / 2 - PLACES.garage.y) < 160) continue;
        if (Math.abs(bx + w / 2 - PLACES.chopShop.x) < 160 && Math.abs(by + h / 2 - PLACES.chopShop.y) < 160) continue;
        buildings.push({ x: bx, y: by, w, h, color: pick(random, BUILDING_COLORS) });
      }
    }
  }
  // The strip between the last road (y=1900) and the river stays clear: it is
  // the riverbank recovery lane for a car that overshoots a corner. Warehouses
  // here wedged cars against the river while the police rammed them.
  return { buildings, districts: DISTRICTS };
}

/** District name for a point, for the HUD. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Rustline';
}

/** True when the circle at (x, y) with radius r touches a building. */
export function hitsBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/**
 * Push a circle out of any building it overlaps. Returns true when it was pushed.
 * Called after movement so the player and cars slide along walls instead of sticking.
 */
export function resolveBuildings(buildings, body) {
  let pushed = false;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    let dx = body.x - cx;
    let dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.r * body.r) continue;
    pushed = true;
    if (d2 < 0.0001) {
      // Centre inside the rectangle: push out along the smallest overlap.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - body.r;
      else if (m === right) body.x = b.x + b.w + body.r;
      else if (m === top) body.y = b.y - body.r;
      else body.y = b.y + b.h + body.r;
    } else {
      const d = Math.sqrt(d2);
      dx /= d;
      dy /= d;
      body.x = cx + dx * body.r;
      body.y = cy + dy * body.r;
    }
  }
  return pushed;
}

export { onRoad };
