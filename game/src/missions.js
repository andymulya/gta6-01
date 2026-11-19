// The ten jobs of Vice Bay II: one arc from courier to kingpin. Each one is a
// pickup on foot, then a getaway drive to a drop-off, against a clock. Pay grows
// with the job number; finishing the tenth retires the driver. Locations are
// road intersections so a car can always reach them.
//
// Special flags:
//   time     — seconds on the job clock (default JOB_TIME); short = a race.
//   heatStart — the job opens with this wanted level; pickup only counts once
//              the heat is gone ("lose the heat first").
//   guarded  — gang shooters guard the pickup; bring a gun.
export const JOBS = [
  {
    name: 'Job 1 · The Courier',
    fixer: 'Fixer: grab the duffel at the pier, lose nobody, bring it to the garage.',
    pickup: { x: 1280, y: 1696 },
    drop: { x: 1920, y: 224 },
    pay: 800,
  },
  {
    name: 'Job 2 · Neon Run',
    fixer: 'Fixer: the package is downtown. Cops are thicker there — stay cool.',
    pickup: { x: 1280, y: 960 },
    drop: { x: 320, y: 224 },
    pay: 1200,
  },
  {
    name: 'Job 3 · Port Heist',
    fixer: 'Fixer: east port, container row. The gang guards it — shoot your way in.',
    pickup: { x: 2240, y: 1280 },
    drop: { x: 640, y: 1600 },
    pay: 1800,
    guarded: true,
  },
  {
    name: 'Job 4 · Cross Town',
    fixer: 'Fixer: longest run yet. The whole city will be watching — be quick.',
    pickup: { x: 320, y: 1600 },
    drop: { x: 2240, y: 320 },
    pay: 2600,
  },
  {
    name: 'Job 5 · Midnight Race',
    fixer: 'Fixer: a rival crew races you for the drop. 90 seconds. No excuses.',
    pickup: { x: 640, y: 320 },
    drop: { x: 2240, y: 1600 },
    pay: 3500,
    time: 90,
  },
  {
    name: 'Job 6 · The Getaway',
    fixer: 'Fixer: the cops are already on you. Lose the heat FIRST, then grab the goods.',
    pickup: { x: 960, y: 640 },
    drop: { x: 320, y: 1600 },
    pay: 4500,
    heatStart: 2,
  },
  {
    name: 'Job 7 · Southside Deal',
    fixer: 'Fixer: southside handoff, gang territory. They will shoot. Shoot back.',
    pickup: { x: 1600, y: 1600 },
    drop: { x: 1920, y: 320 },
    pay: 6000,
    guarded: true,
  },
  {
    name: 'Job 8 · The Convoy',
    fixer: 'Fixer: lift the convoy cash at the port and run it to the safehouse.',
    pickup: { x: 2240, y: 960 },
    drop: { x: 320, y: 224 },
    pay: 7500,
  },
  {
    name: 'Job 9 · Kingpin\'s Cut',
    fixer: 'Fixer: the kingpin\'s cut, downtown tower. Two minutes. Every cop in the city.',
    pickup: { x: 1280, y: 320 },
    drop: { x: 640, y: 1280 },
    pay: 10000,
    time: 120,
  },
  {
    name: 'Job 10 · The Big One',
    fixer: 'Fixer: last job. The penthouse money. Do this clean and you are done.',
    pickup: { x: 2240, y: 1600 },
    drop: { x: 1280, y: 224 },
    pay: 12000,
  },
];
