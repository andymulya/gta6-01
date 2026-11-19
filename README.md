# Vice Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/andymulya/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/andymulya/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game for make.fun's gta6-01 ("Make GTA 6").
Vanilla Canvas, no libraries, no network requests. Play it offline in any
desktop browser.

## The game

You are a getaway driver in **Vice Bay**, a neon coastal city at night. The
fixer has five jobs for you — each one a pickup on foot, then a getaway drive
to the drop-off against the clock. Finish all five and you own the city.

- **Explore** a seeded 2560×1920 neon city: a road grid, downtown towers, a
  beach, a pier and a port. Traffic and pedestrians live their own lives.
- **Drive** with arcade handling: acceleration, braking, handbrake drift.
  Your car takes damage from crashes and cop rams — repair it at the garage.
- **Steal cars** (E) when yours is wrecked. Stealing is a crime: the cops notice.
- **Wanted level 0–5 stars**: cop cars chase and ram you. Break line of
  sight to lose the heat; the garage and a clean delivery drop it faster.
- **Five jobs** with payouts ($800 / $1200 / $1800 / $2600 / $5000) and a
  deadline each: miss it and the buyer walks. Deliver fast for a time bonus.
- **On foot**: leave the car (E) to grab a package, slip through alleys the
  cops cannot follow — but a cop who catches you on foot busts you.
- **HUD**: cash, current job and distance, wanted stars, car health, speed,
  job clock, and a live minimap with the viewport, cops and the target.
- **Sound** is synthesised WebAudio (engine hum, sirens, pickup and delivery
  chimes); silent when audio is unavailable.

## Controls

WASD / arrows — drive and walk · E — get in / out of a car, steal one, repair
at the garage · Space — handbrake drift · P — pause · Enter — confirm.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Or build the submission dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshots

Rendered by the game's own `?shot=` scenes (`shots.json`, seed 1): cover
(title over downtown at night), drive (a first ride down the avenue), chase
(three-star pursuit), heist (the pier pickup, package in hand).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build so humans can play.</sub>
