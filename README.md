# Mercantile — The Elderwood Road

A first-person **3D medieval fantasy adventure** through a continuous, living valley. Choose a Human, Elf, Wizard or Ogre, explore the roads between Eldermere, Mossbrook and Ironhold, trade in furnished houses, gather wild plants, and face the creatures beyond the settlements.

**Version 5.0.0 — Arcane Awakening.** Inspired by the first-person interaction in `vibe-check-9000`, with an outdoor world, regional economies, a merchant campaign, and character progression.

## Play locally

```bash
python3 -m http.server 8000 --directory web
```

Open [localhost:8000](http://localhost:8000) and choose **Enter the valley**. The game requires WebGL 2 and a local HTTP server. Three.js is bundled in the repository; there are no CDN JavaScript dependencies or build requirements for playing. Optional Google Fonts fall back to system fonts when offline.

Alternatively, `npm run dev` serves the game at [localhost:4173](http://localhost:4173).

## Arcane Awakening

- Distinct spell visuals: fiery projectile trails, crystalline ice lances, branching lightning, falling meteors and shockwaves, rising healing spirals, patterned wards, blink portals, grasping vines, force novas, spirit trails and swirling snowstorms.
- Elemental combinations: ice prepares **Shatter** (fire, 65% bonus impact damage) or **Conduction** (lightning, 40% bonus damage). Fire burns over time; ice extinguishes burning. Rooting and weapon stuns remain separate from ice.
- Two reusable training targets beside the southern Eldermere road. At the blue focus stone southwest of the plaza, press **E** to restore mana and ready spells. Training grants no coins or experience.
- Press **Z** to select a hotbar spell without casting, then **Q** to cast it. Starfall and Winter’s veil display a ground targeting circle. The same selection control is available on the touch HUD.
- Enemies wind up their attacks with a visible warning, giving time to guard, move away or interrupt them with magic. Damage numbers, status labels, hit flashes, guard feedback and synthesised spell sounds make combat easier to read.
- Particle counts and temporary effects are capped, Low quality reduces particles, and menus pause combat effects and cancel active combat sounds.

## Characters and equipment

- **Four playable characters** with a rotating 3D preview: Human Ironbound, Elf Moonwood Ranger, Wizard Astral Scholar, and Ogre Stoneborn. Each has distinct health, mana, movement, combat bonuses, starting equipment, and spell access. Change character in a settlement without resetting your trading journey.
- **Thirteen weapons**: sword, dagger, axe, mace, greatsword, spear, warhammer, longbow, crossbow, chakram, Ember Staff, Frost Staff, and wand. Equip owned weapons anywhere; buy equipment, ammunition and healing draughts from Rowan or Gareth. Weapons have different reach, speed, damage, and resource costs.
- **Twelve spells**, all available to the Wizard: fireball, frost, chain lightning, Starfall, healing, ward, blink, roots, nova, summoned wisp, blizzard, and haste. Bind four spells to your hotbar. Mana regenerates; spells have individual cooldowns.
- **Five wilderness encounters** with wolves, goblins, skeletons, wraiths, and a guardian. Guard against incoming attacks, earn coins and experience, and progress through twenty levels. Towns are safe areas. Defeated foes return the next day; falling in battle returns you to Eldermere with a limited coin fee.
- **Improved presentation**: textured ground, stone and timber, smoother vegetation, wind animation, a procedural cloud and star sky, animated river shading, warm lights, environment lighting, and bloom in High quality. Visible 3D weapons, animated enemies and distinct spell effects bring combat into the world.
- Existing Elderwood saves gain a character profile on loading, keeping their coins, inventory and merchant progress. The Captain’s Chart save remains separate.

## The valley

- **Three walkable settlements** with different architecture, merchants, and supply/demand: Eldermere supplies timber and cloth, Mossbrook grows grain and wool, and Ironhold forges iron.
- **Twelve enterable houses** with opening doors, collision, beds, shelves, fireplaces, tables, and in-world shop signs. Innkeepers trade and offer a bed until morning.
- **Nine named NPCs** with contextual dialogue, eight medieval goods, finite stock, quantity controls, cost tracking, and satchel upgrades.
- **A guild campaign**, repeatable delivery contracts, a persistent journal, settlement discoveries, and a 1,000-coin goal. Continue playing after earning the guild charter.
- **A living landscape** with a river, two bridges, a windmill, wheat fields, an old stone circle, oak and pine woods, grass, flowers, and harvestable herbs, berries, and mushrooms.
- **Four ground animal species**: sheep, deer, rabbits, and chickens; plus flying birds and evening fireflies. Deer and rabbits flee when approached. Observe wildlife to record discoveries.
- **Time of day**, warm evening light, night lighting, changing daily market events, procedural birdsong and footsteps, stamina and sprinting.
- **Keyboard, mouse, and touch controls**, mouse-drag fallback, adjustable sensitivity, low graphics mode, and reduced camera motion.
- **Local autosave and continue**, with strict validation of incompatible or corrupted saves. This is a single-player browser-local campaign.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk |
| Mouse | Look; hold and drag if mouse capture is unavailable |
| Shift | Run |
| E | Speak, trade, open/close a door, gather, or observe |
| Left click / Space | Attack (hold captured left mouse for repeated attacks) |
| Right mouse / R | Guard |
| Mouse wheel | Cycle owned weapons |
| 1–4 / Q | Cast a hotbar spell / cast the selected spell |
| Z | Select the next spell without casting; preview area targeting |
| B | Spellbook and hotbar bindings |
| Tab | Equipment |
| C | Character and progression |
| F | Drink a healing draught |
| I | Satchel |
| J | Quest and delivery journal |
| M | Valley map |
| Esc | Pause / close a menu |
| Touch | Left pad to walk; right side to look; Run, Interact, Attack, Guard and spell buttons |

Choose your character, then start with **Rowan**, at the west market stall in Eldermere. The Wizard starts with all twelve spells available; open **B** to assign the four you want to use. Rowan’s **Browse weapons & provisions** button opens the equipment shop. The gold marker guides the current objective. Wild plants regrow each day. Menus pause the game clock, and local progress saves after actions and every 20 seconds. Settings and campaign saves are separate from the original sailing game.

## Earlier game modes

**Captain’s Chart**, the complete version 2 sailing campaign, is available from the title screen or at `/chart/` when serving `web/`. Its original eight ports, ships, encounters, upgrades and saves remain intact. `terminal.html` preserves the earlier exchange terminal when serving the repository root.

The Python economy and FastAPI / WebSocket service also remain intact:

```bash
./start.sh
```

The server serves the new game from `web/` at [localhost:8000](http://localhost:8000). The 3D campaign is independent of the legacy multiplayer economy; the `/ws` and REST API retain their version 2 behavior.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MERCANTILE_SEED` | unset | Seed for the legacy Python world RNG |
| `SIM_TOKEN` | `dev` | Token for `POST /api/sim/tick` when `ENV=production` |
| `ENV` | unset | Set to `production` to enforce sim-tick authentication |

## Develop and verify

```bash
npm ci
npm test
npm run build
python3 -m pip install -r requirements.txt
python3 -m pytest -q
```

The Node tests cover transaction invariants, profitable routes, cargo limits, exactly-once harvests and payouts, save migration and validation, door traversal, wall collision, river crossings, road reachability, character geometry, all spell actions, resource costs, progression, safe zones, and projectile collision ordering. Additional tests cover elemental combinations, burn timing, practice targets, enemy windups, spell effect bounds and cleanup. Shader hooks and bundled module imports are checked as source. They construct geometry in Node; **they are not WebGL or interactive browser tests**.

`npm run build` copies the self-contained game into `dist/`. GitHub Pages continues to serve `web/`; a merge to `main` uses the existing Pages workflow. `web/vendor/` contains pinned Three.js 0.180.0, its postprocessing modules, and the MIT license. The three original material textures in `web/assets/` were generated for this project; their prompts are recorded in `web/assets/texture-prompts.txt`.

| Path | Purpose |
| --- | --- |
| `web/realm/main.js` | Game lifecycle, lighting, interaction, saving |
| `web/realm/world.js` | Procedural 3D world, houses, flora/fauna, collision, instancing |
| `web/realm/economy.js` | Pure trading, quest, contract and save-validation rules |
| `web/realm/rpg.js` | Characters, weapons, spells, progression and hero save validation |
| `web/realm/combat.js` | Enemy simulation, collision, damage and spell actions |
| `web/realm/models.js` | Procedural characters, enemies and weapons |
| `web/realm/graphics.js`, `materials.js`, `postprocessing.js` | Textures, sky, river, combat effects and rendering |
| `web/realm/spell-effects.js`, `combat-feedback.js` | Bounded spell particles, impact geometry, targeting feedback and damage numbers |
| `web/realm/rpg-ui.js` | Character selection, equipment, spellbook and combat HUD |
| `web/realm/controls.js` | Desktop and touch movement / look input |
| `web/realm/ui.js` | Merchant dialogue, satchel, journal, settings and maps |
| `web/realm/audio.js` | Synthesised ambient audio |
| `web/chart/` | Preserved Captain’s Chart game |
| `engine.py`, `server.py` | Legacy Python economy and API |
| `tests/realm.test.mjs` | 3D campaign logic and geometry checks |
| `tests/rpg.test.mjs` | Character, equipment, combat, save migration and graphics-source checks |
| `tests/arcane.test.mjs` | Elemental rules, training, windups, spell geometry and effect lifecycle checks |
| `tests/test_*.py` | Legacy engine and API tests |

An optional, feature-detected WebMCP interface exposes the current journey and opens the journal, map or satchel. Browsers without WebMCP support ignore it. Live WebMCP registration has not been verified in a supported browser context.

See [CHANGELOG.md](CHANGELOG.md) for the release history.
