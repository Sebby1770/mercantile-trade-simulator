# Mercantile — The Elderwood Road

A first-person **3D medieval trading adventure** through a continuous, living valley. Walk the roads between Eldermere, Mossbrook and Ironhold, enter furnished timber houses, meet the locals, gather wild plants, and build a merchant’s fortune.

**Version 3.0.0.** Inspired by the first-person interaction in `vibe-check-9000`, with an outdoor world, regional economies, and a progression campaign.

## Play locally

```bash
python3 -m http.server 8000 --directory web
```

Open [localhost:8000](http://localhost:8000) and choose **Enter the valley**. The game requires WebGL 2 and a local HTTP server. Three.js is bundled in the repository; there are no CDN JavaScript dependencies or build requirements for playing. Optional Google Fonts fall back to system fonts when offline.

Alternatively, `npm run dev` serves the game at [localhost:4173](http://localhost:4173).

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
| I | Satchel |
| J | Quest and delivery journal |
| M | Valley map |
| Esc | Pause / close a menu |
| Touch | Left pad to walk; right side to look; Run and Interact buttons |

Start with **Rowan**, at the west market stall in Eldermere. The gold marker guides the current objective. Wild plants regrow each day. Menus pause the game clock, and local progress saves after actions and every 20 seconds. Settings and campaign saves are separate from the original sailing game.

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

The Node tests cover transaction invariants, profitable routes, cargo limits, exactly-once harvests and payouts, save validation, door traversal, wall collision, river crossings, road reachability, and animated scene construction. They construct geometry in Node; **they are not WebGL or interactive browser tests**.

`npm run build` copies the self-contained game into `dist/`. GitHub Pages continues to serve `web/`; a merge to `main` uses the existing Pages workflow. `web/vendor/` contains pinned Three.js 0.180.0 and its MIT license.

| Path | Purpose |
| --- | --- |
| `web/realm/main.js` | Game lifecycle, lighting, interaction, saving |
| `web/realm/world.js` | Procedural 3D world, houses, flora/fauna, collision, instancing |
| `web/realm/economy.js` | Pure trading, quest, contract and save-validation rules |
| `web/realm/controls.js` | Desktop and touch movement / look input |
| `web/realm/ui.js` | Merchant dialogue, satchel, journal, settings and maps |
| `web/realm/audio.js` | Synthesised ambient audio |
| `web/chart/` | Preserved Captain’s Chart game |
| `engine.py`, `server.py` | Legacy Python economy and API |
| `tests/realm.test.mjs` | 3D campaign logic and geometry checks |
| `tests/test_*.py` | Legacy engine and API tests |

An optional, feature-detected WebMCP interface exposes the current journey and opens the journal, map or satchel. Browsers without WebMCP support ignore it. Live WebMCP registration has not been verified in a supported browser context.

See [CHANGELOG.md](CHANGELOG.md) for the release history.
