# Changelog

## 6.0.0 — Legends of the Wild (2026-09-27)

- Extend the valley to ±300 m with three new regions: the snowbound **Frostfang Highlands** and the northern outpost of **Frostwatch** (the Frosted Antler inn, Hearth & Hide, Halvard the trapper, Brenna the herbalist and a watchtower), the drowned **Mirefen Marsh** with bog pools, reeds and ruined stilt huts, and the ashen **Cinder Reach** with lava pools, glowing cracks and obsidian spires.
- Add a walkable frozen tarn where the River Wren rises, a third bridge in the north, five new roads, and new herb, mushroom and berry spots.
- Add eight waystones that attune when you approach them and offer fast travel between attuned stones for 12 coin and an hour of travel, unavailable during a legendary battle.
- Add region weather (snow, drifting ash and embers, marsh motes), biome-tinted ground, biome fog and ambience, region discovery, and bog and lava ground that slows or burns you.
- Add four legendary boss fights in their own arenas: **Hrimfang, Wyrm of the White Pass** (Frostfang Highlands), **Morwen, the Mire Witch** (Mirefen Marsh), **Pyrrhus, the Cinder Colossus** (Cinder Reach) and **Aurelian, the Hollow King** (the Old Stones), who stays sealed behind a rift until the other three have fallen.
- Give each legend a boss bar, three phases with new attacks, summoned adds, and telegraphed cones, circles, rings, lines, icicle and meteor rain, lingering pools, volleys, charges, blinks and blade combinations. Unblockable attacks are marked in magenta-red. Legends reset if you leave the arena or fall.
- Reward each legend once with a sigil, coin, experience, skill points, a permanent boost to health, mana and power, and a legendary weapon: **Frostfang**, the **Mirewood thornstaff**, the **Cinderheart maul** or the **Riftblade of the Hollow King**. Legendary weapons cannot be bought.
- Overhaul melee: light attacks chain into a three-hit combo with a finisher, holding attack charges a heavy blow with a move for each weapon (rising cut, flurry, cleave, concussion, whirl, lunge, slam and a drawn piercing arrow), and legendary heavies launch frost or rift crescents.
- Add parrying by raising your guard just before a parryable blow lands, reflection of parried bolts, a stamina-costed dodge on V or Ctrl with invulnerability frames, a perfect-dodge riposte, guard breaks when stamina runs out, backstabs, and poise with stagger for enemies and bosses.
- Add four spells, for sixteen in total: the channelled **Sunlance**, **Earthshatter**, **Thunderstorm** and **Soul siphon**. Earn skill points to raise spells to rank 3, each rank 25% more potent, and unlock a mastery for every spell at rank 3.
- Add the **Overload** combination (lightning on a burning foe, with an arcane splash) alongside Shatter and Conduction.
- Add six enemy types (rime wolves, frost trolls, bog thralls, mire hexers, cinder imps and cinder brutes) with ranged attacks, inflicted chill, poison and burning, and elemental weaknesses and resistances, across ten new wilderness encounters. The Whispering stones encounter moves north so the stone circle can hold the Hollow King.
- Add a charge meter, combo pips, enemy poise, weak and resist labels, parry, dodge and stagger feedback, boss banners, boss music and new combat sounds.
- Migrate existing heroes and journeys: characters gain one skill point for each level already earned, and saves gain the Frostwatch market, the Eldermere waystone and an empty region record, keeping coins, inventory and quests.
- Add `tests/legends.test.mjs` for migration, spell ranks, combos, heavy attacks, parry, dodge, poise, affinities, bosses, hazards, summons, channelling, the new spells and the larger world, and update the existing tests for the new counts. As before, these are Node logic and geometry checks rather than WebGL or interactive browser tests.

## 5.0.0 — Arcane Awakening (2026-09-11)

- Give all twelve spells distinct casting, projectile, impact and persistent effects, with a bounded particle buffer and reduced particle counts in Low quality.
- Add Shatter and Conduction elemental combinations, burning, chill, ice-specific immobilization and visible enemy statuses.
- Add two safe training targets and an Eldermere focus stone that restores mana and readies spells without granting rewards.
- Add enemy attack windups, interruptible strikes, guard feedback, floating damage numbers and synthesised combat sounds.
- Add spell selection without casting and ground previews for area spells, including a touch selection button.
- Preserve existing saves and add regression coverage for elemental timing, practice, interrupts, geometry and effect cleanup.

## 4.0.0 — Steel & Sorcery (2026-09-09)

- Add playable Human, Elf, Wizard and Ogre characters with distinct stats, equipment, spell access and a 3D selection preview.
- Add thirteen purchasable weapons, visible held equipment, ammunition, healing draughts, guarding and twenty character levels.
- Add twelve spells with a four-slot hotbar, mana costs, cooldowns and distinct effects, including chain lightning, Starfall, blink, blizzard and a summoned wisp.
- Add five wilderness encounters, five enemy types, safe settlements, combat rewards, daily respawns and recovery on defeat.
- Upgrade ground, stone and wood textures, vegetation, sky, river, lighting, bloom, character models and combat effects.
- Add character, equipment and spellbook menus, combat HUD, enemy map markers, keyboard shortcuts and touch combat controls.
- Migrate existing Elderwood saves without resetting commerce or quests; preserve Captain’s Chart and the Python economy.
- Add automated character, spell, collision, resource, reward, save, geometry and shader-source checks. Interactive browser and WebGL verification remain separate.

## 3.0.0 — The Elderwood Road (2026-09-08)

- Make a first-person 3D medieval valley the default browser game.
- Add three continuous settlements, twelve furnished enterable houses, nine NPCs, regional trading, satchel upgrades and inn stays.
- Add a guild campaign, delivery contracts, daily events, local autosave, and validation of saved game data.
- Populate the valley with oak and pine woods, harvestable plants, wheat, a windmill, a river and bridges, a keep, deer, sheep, rabbits, chickens, birds, and fireflies.
- Add collision-aware movement, pointer-lock and drag-look controls, touch controls, a map, journal, configurable graphics and audio, and reduced camera motion.
- Batch static and articulated geometry with instancing; bundle Three.js locally.
- Preserve Captain’s Chart under `web/chart/`, its saves, the original terminal, and the Python / WebSocket economy.
- Add Node economy and geometry tests alongside the existing Python checks.

All notable changes to this project are documented here.

## 2.0.0 — 2026-08-25

A playable captain's game, not just a market terminal.

### Added
- **Captain's Chart** (`web/`): title voyage, animated sea map, click-to-sail,
  docked market / hold / yard / bonds / log, storms and pirates on crossing,
  hull / crew / morale, delivery bonds, win at $500k net, wreck at 0 hull.
- Offline engine in `web/world.js` so GitHub Pages is a real game with no server.
- Python engine: hull, crew, morale, sea encounters, contracts, repair/hire,
  achievements `storm_sailor`, `privateer`, `contractor`, `tycoon`.
- FastAPI now serves `web/` (falls back to `static/` if needed).
- GitHub Pages workflow publishing `web/`.

### Changed
- Version **2.0.0**.

## 1.1.0 — 2026-07-11

### Added

- Optional `seed` on `GameWorld` using an isolated `random.Random` for deterministic ticks, events, and rivals.
- Pure helpers: `compute_target_price`, `route_exists`, `format_log_markdown`, `format_log_csv`.
- Achievements on `PlayerState`: `first_trade`, `millionaire`, `globe_trotter`, `event_survivor` (serialized to the client).
- Trade journal export (`PlayerState.journal`, REST `/api/players/{pid}/journal` and `/api/journal`).
- REST API: `GET /api/health`, `/api/snapshot`, `/api/cities`, `/api/goods`, `/api/achievements`, `POST /api/sim/tick`.
- Public economy snapshot (`GameWorld.public_snapshot`) for observers.
- Pytest suite under `tests/` with CI workflow (Python 3.11/3.12).
- `pyproject.toml` project metadata; engine `VERSION = "1.1.0"`.
- Env knobs: `MERCANTILE_SEED`, `SIM_TOKEN`, `ENV` for production sim-tick protection.

### Changed

- Market target price computation extracted to testable pure function.
- Rival buy path guards zero/invalid prices; route scoring skips non-positive buy prices.
- Player reset clears achievements, visited cities, and crisis counters via `reset_progress()`.
- README documents FastAPI run path (`./start.sh`), REST, seeds, achievements, and tests.

### Validation

- `pytest -q` covering seeded determinism, buy/sell conservation, travel, routes, serialize keys, achievements, journal.

## 2026-06-19

### Redesigned

- Rebuilt the interface as a premium maritime exchange terminal with a deep chart-room palette, brass framing, and tabular market data.
- Made the route map and spot market the dominant trading desk while tightening inventory, events, analysis, and ledger hierarchy.
- Restyled every generated market row, route, action, strategy state, forecast, progress meter, and activity entry for the new visual system.
- Updated the canvas chart palette for dark-surface contrast and clearer multi-market comparison.
- Added responsive exchange layouts that move from three lanes to a single focused workflow without horizontal page overflow.

### Added

- Strategy Lab with Preserve, Balanced, and Momentum trading profiles.
- Profile-aware route scoring that changes recommendations based on profit appetite, risk, event exposure, and route access.
- Live downside, base, and upside stress matrix for the best executable route.
- Capital-at-risk and break-even sizing calculations.
- Stage Top Route workflow that selects the recommended commodity and quantity without automatically placing a trade.

### Changed

- Route intelligence now records the strategy profile behind each recommendation.
- Saved games retain the selected strategy profile.

### Validation

- JavaScript syntax and exported forecast-model smoke tests.
- Desktop and mobile browser checks for profile switching, route staging, console health, and horizontal overflow.
