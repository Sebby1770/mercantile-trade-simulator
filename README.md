# Mercantile — The Elderwood Road

A first-person **3D medieval fantasy adventure** through a continuous, living valley. Choose a Human, Elf, Wizard or Ogre, explore the roads between Eldermere, Mossbrook, Ironhold and the northern outpost of Frostwatch, trade in furnished houses, gather wild plants, face the creatures beyond the settlements, and challenge the four legends of the wild.

**Version 6.0.0 — Legends of the Wild.** Inspired by the first-person interaction in `vibe-check-9000`, with an outdoor world, regional economies, a merchant campaign, and character progression.

## Publish with Vercel

Import this GitHub repository into Vercel with the repository root as the root directory. The included `vercel.json` builds the static game into `dist/`, serving the game directly at the website’s home page and Captain’s Chart at `/chart/`. No backend or environment variables are required. Saves are stored in each player’s browser.

## Play locally

```bash
python3 -m http.server 8000 --directory web
```

Open [localhost:8000](http://localhost:8000) and choose **Enter the valley**. The game requires WebGL 2 and a local HTTP server. Three.js is bundled in the repository; there are no CDN JavaScript dependencies or build requirements for playing. Optional Google Fonts fall back to system fonts when offline.

Alternatively, `npm run dev` serves the game at [localhost:4173](http://localhost:4173).

## Legends of the Wild

- **A bigger world.** The valley now spans ±300 m. North of Mossbrook and Ironhold lie the snowbound **Frostfang Highlands**, the outpost of **Frostwatch**, and a walkable frozen tarn where the River Wren rises, reached over a third bridge. To the southwest is the drowned **Mirefen Marsh**, with bog pools that slow you. To the east is the ashen **Cinder Reach**, where lava pools burn. Each region has its own weather, ground colouring, fog and ambient sound.
- **Waystones.** Eight standing stones attune when you walk up to them. Press **E** at an attuned stone to travel to another one for 12 coin and an hour of travel. You cannot fast travel during a legendary battle.
- **Four legendary bosses**, each in an arena with a boss bar, three phases, summoned adds and telegraphed attacks that you can dodge or parry. Unblockable attacks are marked in magenta-red.
  - **Hrimfang, Wyrm of the White Pass**, in the Frostfang Highlands: bites, tail sweeps, frost breath, ice spikes, a glacial nova and icicle rain.
  - **Morwen, the Mire Witch**, in Mirefen Marsh: hex bolts, bog pools, a blink step, drowned thralls, thorn lashes and a wailing hex.
  - **Pyrrhus, the Cinder Colossus**, in Cinder Reach: molten slams, magma sweeps, quake stomps, fire waves, falling cinders and eruptions.
  - **Aurelian, the Hollow King**, at the Old Stones. He stays sealed behind a rift until the other three have fallen, then fights with blade combinations, lunges, rift orbs, an eclipse and falling crowns.
- **Legendary rewards.** Each legend pays out once. You get a sigil, coin, experience, skill points, a permanent boost to health, mana and power, and a legendary weapon that cannot be bought: **Frostfang**, the **Mirewood thornstaff**, the **Cinderheart maul** or the **Riftblade of the Hollow King**.
- **Melee overhaul.**
  - Tap attack for a three-hit combo that ends in a heavier finisher. Hold attack to charge a heavy blow with a move for each weapon: rising cut, dagger flurry, cleave, concussion, whirl, spear lunge, hammer slam, or a drawn piercing arrow. Frostfang and the Riftblade also launch a crescent wave.
  - Raise your guard just before a parryable blow lands to parry it. A parry staggers the attacker, sends bolts back at their caster and readies a riposte.
  - Dodge with **V** or **Ctrl**. A dodge costs stamina and makes you briefly invulnerable, and a last-moment perfect dodge also readies a riposte.
  - Blocking a blow costs stamina, and your guard breaks when you run out. Striking an enemy from behind is a backstab.
  - Every enemy has poise. Breaking it staggers the enemy, and staggered foes take extra damage.
- **Magic.**
  - Four new spells: the channelled **Sunlance** (hold the spell key), **Earthshatter**, **Thunderstorm** and **Soul siphon**.
  - Levelling up and slaying legends earn skill points. Spend them in the spellbook to raise spells to rank 3. Each rank makes a spell 25% more potent, and rank 3 unlocks the spell's mastery.
  - Casting lightning on a burning enemy triggers **Overload**, which splashes arcane damage onto nearby foes.
- **New foes.** Rime wolves, frost trolls, bog thralls, mire hexers, cinder imps and cinder brutes. Some attack from range, some inflict chill, poison or burning, and all have elemental weaknesses and resistances.
- **Save compatibility.** Existing saves carry over. Heroes gain one skill point for each level already earned, and journeys gain the Frostwatch market and the Eldermere waystone.

## Arcane Awakening

- Distinct spell visuals: fiery projectile trails, crystalline ice lances, branching lightning, falling meteors and shockwaves, rising healing spirals, patterned wards, blink portals, grasping vines, force novas, spirit trails and swirling snowstorms.
- Elemental combinations: ice prepares **Shatter** (fire, 65% bonus impact damage) or **Conduction** (lightning, 40% bonus damage). Fire burns over time; ice extinguishes burning. Rooting and weapon stuns remain separate from ice.
- Two reusable training targets beside the southern Eldermere road. At the blue focus stone southwest of the plaza, press **E** to restore mana and ready spells. Training grants no coins or experience.
- Press **Z** to select a hotbar spell without casting, then **Q** to cast it. Starfall and Winter’s veil display a ground targeting circle. The same selection control is available on the touch HUD.
- Enemies wind up their attacks with a visible warning, giving time to guard, move away or interrupt them with magic. Damage numbers, status labels, hit flashes, guard feedback and synthesised spell sounds make combat easier to read.
- Particle counts and temporary effects are capped, Low quality reduces particles, and menus pause combat effects and cancel active combat sounds.

## Characters and equipment

- **Four playable characters** with a rotating 3D preview: Human Ironbound, Elf Moonwood Ranger, Wizard Astral Scholar, and Ogre Stoneborn. Each has distinct health, mana, movement, combat bonuses, starting equipment, and spell access. Change character in a settlement without resetting your trading journey. Skill points raise spells to rank 3, and slain legends grant lasting boons.
- **Seventeen weapons**: sword, dagger, axe, mace, greatsword, spear, warhammer, longbow, crossbow, chakram, Ember Staff, Frost Staff, and wand, plus four legendary weapons won from bosses. Melee weapons and the longbow have a charged heavy attack. Equip owned weapons anywhere; buy equipment, ammunition and healing draughts from Rowan or Gareth. Weapons have different reach, speed, damage, and resource costs.
- **Sixteen spells**, all available to the Wizard: fireball, frost, chain lightning, Starfall, healing, ward, blink, roots, nova, summoned wisp, blizzard, haste, Sunlance, Earthshatter, Thunderstorm and Soul siphon. Bind four spells to your hotbar. Mana regenerates; spells have individual cooldowns.
- **Fifteen wilderness encounters and four legendary bosses**, with eleven enemy types from wolves, goblins and skeletons to frost trolls, mire hexers and cinder brutes. Guard, parry or dodge incoming attacks, earn coins and experience, and progress through twenty levels. Towns are safe areas. Defeated foes return the next day; falling in battle returns you to Eldermere with a limited coin fee.
- **Improved presentation**: textured ground, stone and timber, smoother vegetation, wind animation, a procedural cloud and star sky, animated river shading, warm lights, environment lighting, and bloom in High quality. Visible 3D weapons, animated enemies and distinct spell effects bring combat into the world.
- Existing Elderwood saves gain a character profile on loading, keeping their coins, inventory and merchant progress. The Captain’s Chart save remains separate.

## The valley

- **Four walkable settlements** with different architecture, merchants, and supply/demand: Eldermere supplies timber and cloth, Mossbrook grows grain and wool, Ironhold forges iron, and Frostwatch sells herbs and mushrooms but pays well for grain. The guild charter still counts the three original market towns.
- **Sixteen enterable houses** with opening doors, collision, beds, shelves, fireplaces, tables, and in-world shop signs. Innkeepers trade and offer a bed until morning.
- **Twelve named NPCs** with contextual dialogue, eight medieval goods, finite stock, quantity controls, cost tracking, and satchel upgrades.
- **A guild campaign**, repeatable delivery contracts, a persistent journal, settlement discoveries, and a 1,000-coin goal. Continue playing after earning the guild charter.
- **A living landscape** with a river, three bridges, a frozen tarn, marsh and lava fields, eight waystones, a windmill, wheat fields, an old stone circle, oak and pine woods, grass, flowers, and harvestable herbs, berries, and mushrooms.
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
| Left click / Space | Attack; repeated taps chain a three-hit combo |
| Hold left click / Space | Charge and release a heavy attack (repeated attacks for weapons without one) |
| Right mouse / R | Guard; raise it just before a blow lands to parry |
| V / Ctrl | Dodge in the direction you are moving (backwards when standing still) |
| Mouse wheel | Cycle owned weapons |
| 1–4 / Q | Cast a hotbar spell / cast the selected spell; hold to channel Sunlance |
| Z | Select the next spell without casting; preview area targeting |
| B | Spellbook and hotbar bindings |
| Tab | Equipment |
| C | Character and progression |
| F | Drink a healing draught |
| I | Satchel |
| J | Quest and delivery journal |
| M | Valley map |
| Esc | Pause / close a menu |
| Touch | Left pad to walk; right side to look; Run, Interact, Attack (hold for heavy), Guard, Dodge and spell buttons |

Choose your character, then start with **Rowan**, at the west market stall in Eldermere. The Wizard starts with all sixteen spells available; open **B** to assign the four you want to use. Rowan’s **Browse weapons & provisions** button opens the equipment shop. The gold marker guides the current objective. Wild plants regrow each day. Menus pause the game clock, and local progress saves after actions and every 20 seconds. Settings and campaign saves are separate from the original sailing game.

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

The Node tests cover transaction invariants, profitable routes, cargo limits, exactly-once harvests and payouts, save migration and validation, door traversal, wall collision, river crossings, road reachability, character geometry, all spell actions, resource costs, progression, safe zones, and projectile collision ordering. Additional tests cover elemental combinations, burn timing, practice targets, enemy windups, spell effect bounds and cleanup. The Legends tests cover hero and journey migration, spell ranks, combos, heavy attacks, parrying, dodging, poise, affinities, boss phases, resets and rewards, the Hollow King's seal, hazard shapes, summons, channelling, the new spells, and the larger world's towns, waystones, bridges, tarn and river. Shader hooks and bundled module imports are checked as source. They construct geometry in Node; **they are not WebGL or interactive browser tests**.

`npm run build` copies the self-contained game into `dist/`. GitHub Pages continues to serve `web/`; a merge to `main` uses the existing Pages workflow. `web/vendor/` contains pinned Three.js 0.180.0, its postprocessing modules, and the MIT license. The three original material textures in `web/assets/` were generated for this project; their prompts are recorded in `web/assets/texture-prompts.txt`.

| Path | Purpose |
| --- | --- |
| `web/realm/main.js` | Game lifecycle, lighting, interaction, saving |
| `web/realm/world.js` | Procedural 3D world, houses, flora/fauna, collision, instancing |
| `web/realm/economy.js` | Pure trading, quest, contract and save-validation rules |
| `web/realm/rpg.js` | Characters, weapons, spells, spell ranks, progression and hero save validation |
| `web/realm/bosses.js` | Legendary bosses: arenas, phases, affinities, attack patterns and hazard geometry |
| `web/realm/combat.js` | Enemy and boss simulation, melee combos, heavy attacks, parry, dodge, poise, hazards, damage and spell actions |
| `web/realm/models.js` | Procedural characters, enemies and weapons |
| `web/realm/graphics.js`, `materials.js`, `postprocessing.js` | Textures, sky, river, combat effects and rendering |
| `web/realm/weather.js` | Bounded snow, ash, ember and marsh particles that follow the camera |
| `web/realm/spell-effects.js`, `combat-feedback.js` | Bounded spell particles, impact geometry, hazard telegraphs, targeting feedback, damage numbers and boss banners |
| `web/realm/rpg-ui.js` | Character selection, equipment, spellbook ranks, combat HUD and boss bar |
| `web/realm/controls.js` | Desktop and touch movement / look input |
| `web/realm/ui.js` | Merchant dialogue, satchel, journal, waystone travel, settings and maps |
| `web/realm/audio.js` | Synthesised ambient audio, region ambience, combat sounds and boss music |
| `web/chart/` | Preserved Captain’s Chart game |
| `engine.py`, `server.py` | Legacy Python economy and API |
| `tests/realm.test.mjs` | 3D campaign logic and geometry checks |
| `tests/rpg.test.mjs` | Character, equipment, combat, save migration and graphics-source checks |
| `tests/arcane.test.mjs` | Elemental rules, training, windups, spell geometry and effect lifecycle checks |
| `tests/legends.test.mjs` | Migration, spell ranks, melee, parry, dodge, poise, bosses, hazards, new spells and world checks |
| `tests/test_*.py` | Legacy engine and API tests |

An optional, feature-detected WebMCP interface exposes the current journey and opens the journal, map or satchel. Browsers without WebMCP support ignore it. Live WebMCP registration has not been verified in a supported browser context.

See [CHANGELOG.md](CHANGELOG.md) for the release history.
