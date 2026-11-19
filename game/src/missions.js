// The five jobs. Each one is a pickup on foot, then a getaway drive to a
// drop-off, against a clock. Pay grows with the job number; finishing the
// fifth retires the driver. Locations are road intersections so a car can
// always reach them.
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
    fixer: 'Fixer: east port, container row. Grab it and do not stop for anyone.',
    pickup: { x: 2240, y: 1280 },
    drop: { x: 640, y: 1600 },
    pay: 1800,
  },
  {
    name: 'Job 4 · Cross Town',
    fixer: 'Fixer: longest run yet. The whole city will be watching — be quick.',
    pickup: { x: 320, y: 1600 },
    drop: { x: 2240, y: 320 },
    pay: 2600,
  },
  {
    name: 'Job 5 · The Big One',
    fixer: 'Fixer: last job. The penthouse money. Do this clean and you are done.',
    pickup: { x: 2240, y: 1600 },
    drop: { x: 1280, y: 224 },
    pay: 5000,
  },
];
