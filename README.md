# Elang Laut: Island Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bangpateng/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bangpateng/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete original 3D flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). You are a bush pilot over a tropical Indonesian archipelago: take off from the island runway, thread glowing rings over lagoons, mountains and fishing villages, and bring the plane home on the same strip — on time, on fuel, and in one piece. Three missions with different goals, weather and fuel pressure, a real flight model (stall, bank-to-turn, trim-holding pitch), and a full cockpit: artificial horizon, compass, minimap, fuel and damage.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play in a desktop browser. No network, no build step.

| Control | What it does |
| --- | --- |
| Arrow keys / WASD | Pitch and roll (bank to turn) |
| Shift / Ctrl | Throttle up / down |
| Space | Brake |
| C | Camera: chase / cockpit |
| P | Pause |
| R | Restart the mission |
| M | Mute |
| Mouse drag | Steer |

**The loop:** pick a mission, take off from runway 07 (pull up above 140 km/h), and fly the rings in order — the next one glows orange with a beam to the ground. Each ring is 100 points (+25 for a fast pass). Land cleanly back on the runway for a landing bonus, a time bonus and a perfect-landing bonus. Hard landings add damage; running out of fuel, hitting terrain or the sea, or landing off the runway ends the flight.

**The missions:** Ring Run (8 rings, 260 s), Island Hop (10 rings, 330 s, crosswind), Storm Courier (8 low rings, 230 s, 88% fuel, strong wind). Touch-and-go landings mid-mission are allowed.

## What is in here

- `game/index.html` + `game/src/` — the whole game, plain ES modules, Three.js vendored locally:
  - `config.js` — every tuning number, colour, mission and ring layout
  - `random.js` — the seeded generator (mulberry32 + value noise / fbm) behind terrain and screenshots
  - `terrain.js` — the island: heightmap terrain, lagoon, runway, village, palms, clouds
  - `aircraft.js` — the low-poly prop plane, cockpit dashboard, spinning prop
  - `physics.js` — the flight model: throttle, pitch, bank-to-turn, stall, landing, crash
  - `input.js` — keyboard and mouse, kept apart from the rules
  - `hud.js` — HUD, artificial horizon, compass, minimap, warnings
  - `audio.js` — all sound synthesised with WebAudio (engine, wind, ring chime, alarm, fanfare)
  - `missions.js` — the three missions, rings, fuel, scoring, landing bonuses
  - `camera.js` — smoothed chase camera and cockpit camera
  - `shots.js` — the screenshot scenes: deterministic poses that play the real physics forward
  - `main.js` — boot, the fixed-step loop, the screens
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's library, unchanged
- `screenshots/` — 4 real renders of the game's own code (`shots.json` lists the `?shot=` scene behind each)
