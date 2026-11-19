// The five jobs of Rustline. Each job is a list of objectives the world checks in
// order; a job pays out when its last objective completes. Objectives:
//   car    — be inside any car
//   goto   — reach a point (on foot or in a car) within its radius
//   pickup — walk over a point on foot
//   heat   — bring the wanted level down to zero
//   ram    — smash the armored truck until its integrity hits zero
//   collect— walk over the cash the truck drops
import { MISSION_PAY, PLACES } from './config.js';

export const MISSIONS = [
  {
    name: 'First Ride',
    intro: 'Marlowe needs wheels. Steal a car and bring it to Rusty.',
    pay: MISSION_PAY[0],
    steps: [
      { type: 'car', label: 'Steal a car' },
      { type: 'goto', x: PLACES.chopShop.x, y: PLACES.chopShop.y, radius: 70, label: "Reach Rusty's Chop Shop" },
    ],
  },
  {
    name: 'Dead Drop',
    intro: 'A package waits at the Rail Yard. Grab it on foot, then drive it to the garage.',
    pay: MISSION_PAY[1],
    steps: [
      { type: 'pickup', x: PLACES.railYard.x, y: PLACES.railYard.y, radius: 48, label: 'Grab the package at the Rail Yard' },
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, radius: 70, label: "Deliver to Marlowe's Garage" },
    ],
  },
  {
    name: 'Heat Wave',
    intro: 'Kade put a price on you. Wanted level 3 — lose the heat.',
    pay: MISSION_PAY[2],
    steps: [
      { type: 'heat', label: 'Lose the heat — get wanted to zero' },
    ],
  },
  {
    name: 'Night Shift',
    intro: 'Three drops, two minutes. The meter is running.',
    pay: MISSION_PAY[3],
    timed: 120,
    steps: [
      { type: 'goto', x: PLACES.deliveries[0].x, y: PLACES.deliveries[0].y, radius: 70, label: 'Drop 1 of 3: Northside' },
      { type: 'goto', x: PLACES.deliveries[1].x, y: PLACES.deliveries[1].y, radius: 70, label: 'Drop 2 of 3: Foundry' },
      { type: 'goto', x: PLACES.deliveries[2].x, y: PLACES.deliveries[2].y, radius: 70, label: 'Drop 3 of 3: The Flats' },
    ],
  },
  {
    name: 'The Iron Vault',
    intro: "Kade's armored truck runs the Depot road. Ram it until it stops, grab the cash, get home.",
    pay: MISSION_PAY[4],
    steps: [
      { type: 'ram', label: "Ram the armored truck until it stops" },
      { type: 'collect', label: 'Grab the cash' },
      { type: 'goto', x: PLACES.safehouse.x, y: PLACES.safehouse.y, radius: 70, label: 'Reach the Safehouse' },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function missionAt(index) {
  return MISSIONS[Math.min(index, MISSIONS.length - 1)];
}

/** The label shown in the HUD for the current objective. */
export function objectiveLabel(index, step) {
  const mission = missionAt(index);
  const objective = mission.steps[Math.min(step, mission.steps.length - 1)];
  return objective.label;
}
