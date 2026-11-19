# Vice Bay II

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/andymulya/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/andymulya/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game for make.fun's gta6-01 ("Make GTA 6").
Vanilla Canvas, no libraries, no network requests. Play it offline in any
desktop browser.

## The game

You are a getaway driver in **Vice Bay II**, a sun-soaked coastal city by day.
The fixer has ten jobs for you — an arc from courier to kingpin — each one a
pickup on foot, then a getaway drive to the drop-off against the clock. Finish
all ten and you own the city.

- **Explore** a seeded 2560×1920 sun-soaked city: a road grid, pastel Art
  Deco downtown, palm parks, a sand beach and turquoise sea, a pier and a port.
  Denser traffic (22 cars) and pedestrians (30) live their own lives.
- **Drive** with arcade handling: acceleration, braking, handbrake drift.
  Your car takes damage from crashes and cop rams — repair it at the garage,
  or park at the safehouse to heal free and lose heat fast.
- **Steal cars** (E) when yours is wrecked. Stealing is a crime: the cops notice.
- **Wanted level 0–5 stars**: cop cars chase and ram you. At 3+ stars the
  police set **roadblocks** across the road ahead; at 4–5 stars a **helicopter**
  follows you, its spotlight keeping you seen so the heat cannot decay.
  Break line of sight to lose the heat; the garage and a clean delivery drop
  it faster.
- **Ten story jobs** with payouts up to $12,000 and fixer briefings: a timed
  race, a job that starts hot (lose the heat first), and two pickups guarded
  by gang shooters.
- **Combat on foot**: mouse aim, click to shoot the pistol; buy the **SMG**
  and ammo at the gun shop (W). Gang shooters stand their ground and shoot
  back — take them down for respect.
- **Garage upgrades**: engine (faster), armor (tougher), tires (grippier) —
  3 levels each, bought with cash at the garage (keys 1/2/3).
- **Radio**: three procedural WebAudio stations — synthwave, funk, chill —
  cycle with R.
- **Save / load**: progress (cash, job, upgrades, respect, weapon, ammo)
  saves to localStorage on every delivery and with Q; press C on the title
  screen to continue.
- **Respect**: earned per delivery and per shooter downed, shown in the HUD.
- **HUD**: cash, current job and distance, wanted stars, car health, speed,
  job clock, weapon + ammo, respect, radio station, save indicator, and a
  live minimap with the viewport, cops, helicopter and the target.
- **Sound** is synthesised WebAudio (engine hum, sirens, radio, pickup and
  delivery chimes, gunshots); silent when audio is unavailable.

## Controls

WASD / arrows — drive and walk · E — get in / out of a car, steal one, repair
at the garage · Mouse aim + click — shoot on foot · Space — handbrake drift ·
1/2/3 — garage upgrades · 4/5 — SMG / ammo at the gun shop · R — radio ·
Q — quick-save · C — continue saved run · P — pause · Enter — confirm.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Or build the submission dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshots

Rendered by the game's own `?shot=` scenes (`shots.json`, seed 1): cover
(title over sun-soaked downtown, helicopter in the distance, 2 stars), drive
(a ride down the beach avenue), chase (five-star pursuit with helicopter and
roadblock), heist (the port shootout, pistol drawn).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build so humans can play.</sub>
