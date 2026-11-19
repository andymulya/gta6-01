# Rustline

A 2D top-down open-world crime game for make.fun's gta6-01 ("Make GTA 6").
Vanilla Canvas, no libraries, no network requests. Play it offline in any
desktop browser.

## The game

You are a new driver in **Rustline**, a rust-belt industrial city. Fixer Sadie
Marlowe has work for you; rail boss Roman Kade has a price on you.

- **Explore** a seeded 3000×2200 city on foot and by car: seven districts,
  a river, the docks, the rail yard, the foundry.
- **Steal cars** (E), drive them, wreck them. Traffic and pedestrians live
  their own lives.
- **Wanted level 0–5 stars**: police chase, ram and bust you. Lose the heat
  to drop stars.
- **Five story jobs** with payouts ($400 / $600 / $800 / $1000 / $2500):
  First Ride, Dead Drop, Heat Wave, Night Shift, The Iron Vault.
- **Combat**: punch (Space) and pistol (mouse click). Health regens out of
  trouble; getting busted costs a $100 fine and a trip to the safehouse.
- **HUD**: cash, current job and objective, wanted stars, health and car
  integrity, day clock, district name, and a live minimap.
- **Save** with Q (localStorage), continue with C. Sound is synthesised
  WebAudio (engine, sirens, gunshots, jingles); M mutes.

## Controls

WASD / arrows — move and drive · E — steal or exit a car · Space — punch ·
Click — shoot · Q — save · P — pause · Enter — confirm · C — new game /
continue · M — mute.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Or build the submission dossier with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshots

Rendered by the game's own `?shot=` scenes (`shots.json`): cover (three-star
getaway), drive (first ride), chase (four-star pursuit), heist (the armored
truck).
