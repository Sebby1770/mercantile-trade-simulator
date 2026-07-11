# Mercantile Trade Simulator

A FastAPI + WebSocket multiplayer-ready trading simulation. Supply, demand, NPC rivals, transport costs, and world events create shifting arbitrage opportunities. The authoritative economy runs in `engine.py`; browsers connect over WebSocket and a small REST API is available for health checks, observers, and offline ticks.

**Version:** 1.1.0

## Run (recommended)

```bash
./start.sh
```

This creates a virtualenv, installs dependencies, and starts Uvicorn at [http://localhost:8000](http://localhost:8000).

Manual equivalent:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MERCANTILE_SEED` | unset | Integer seed for deterministic world RNG |
| `SIM_TOKEN` | `dev` | Token required for `POST /api/sim/tick` when `ENV=production` |
| `ENV` | unset | Set to `production` to enforce sim-tick auth |

## Architecture

| Path | Role |
| --- | --- |
| `engine.py` | Pure game world: markets, events, rivals, achievements, serialize |
| `server.py` | FastAPI app: WebSocket game loop + REST |
| `static/` | Browser client served at `/` |
| `tests/` | Pytest suite for the engine |

The engine is importable without starting the server:

```python
from engine import GameWorld, PlayerState

world = GameWorld(seed=42)
player = PlayerState(pid='demo')
world.step([player])
print(world.serialize(player)['tick'])
```

## WebSocket

Connect to `ws://localhost:8000/ws`. The server pushes `{ type: "state", data: ... }` each tick (~1.5s) and accepts action messages:

`buy`, `sell`, `travel`, `build`, `upgrade_cargo`, `upgrade_speed`, `take_loan`, `repay_loan`, `reset`.

### Reconnect sessions

Pass a session token on the URL: `ws://localhost:8000/ws?token=<8-64 chars of [A-Za-z0-9_-]>`. The server keeps the player state behind that token for **6 hours of inactivity**, so a dropped connection or page reload resumes the same run. The bundled client generates a token automatically and stores it in `localStorage`. Without a token the session is ephemeral.

All action payloads are validated server-side: `NaN`/`Infinity`/negative quantities and amounts are rejected, buys are capped at the market's available stock, and malformed or non-JSON messages get an `error` reply instead of closing the socket.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | `{ ok, service, tick, players, version }` |
| `GET` | `/api/snapshot` | Public economy snapshot (no private wallets) |
| `GET` | `/api/cities` | Static city catalog + routes |
| `GET` | `/api/goods` | Static goods catalog |
| `GET` | `/api/achievements` | Achievement definitions |
| `POST` | `/api/sim/tick` | Advance world `n` ticks (body `{ "n": 1 }`) |
| `GET` | `/api/players/{pid}/journal` | Markdown/CSV log for a **connected** player |
| `GET` | `/api/journal?pid=` | Same journal export via query param |

### Examples

```bash
curl -s http://localhost:8000/api/health | jq
curl -s http://localhost:8000/api/snapshot | jq '.tick,.events'
curl -s -X POST http://localhost:8000/api/sim/tick \
  -H 'Content-Type: application/json' \
  -H 'X-Sim-Token: dev' \
  -d '{"n": 5}'
```

In production (`ENV=production`), `POST /api/sim/tick` requires header `X-Sim-Token` matching `SIM_TOKEN`.

## Deterministic seeds

```python
world = GameWorld(seed=42)   # fully reproducible ticks/events/rivals
world = GameWorld()          # system entropy (default)
```

Or start the server with `MERCANTILE_SEED=42 ./start.sh`.

## Achievements

Tracked on `PlayerState` and included in the player serialize payload:

| Id | Condition |
| --- | --- |
| `first_trade` | Complete at least one buy or sell |
| `millionaire` | Net worth ≥ $100,000 |
| `globe_trotter` | Visit 5 distinct cities |
| `event_survivor` | Be active for at least one tick during a crisis |

Unlocked achievements appear under `player.unlockedAchievements` and as detailed flags in `player.achievements`.

## Trade journal

Each player keeps a rolling captain's log (last 80 entries). Export:

```python
player.journal(fmt='markdown', n=40)
player.journal(fmt='csv', n=40)
```

Or via REST when the player is connected over WebSocket:

```
GET /api/players/{pid}/journal?fmt=markdown&n=40
GET /api/journal?pid={pid}&fmt=csv
```

## Tests

```bash
pip install -r requirements.txt
pytest -q
```

The suite covers the seeded engine (determinism, achievements, journal), long-run market dynamics (price sanity, event targeting, route-graph connectivity), every WebSocket action handler including hostile input (NaN/Infinity, over-stock buys, remote building), and end-to-end WebSocket integration including session resume after disconnect.

CI runs pytest on Python 3.11–3.13 and syntax-checks both frontend bundles (see `.github/workflows/ci.yml`).

## Included systems

- Goods with base price, elasticity, volatility, and category tags
- Regional markets with supply/demand bias per city
- Price formula `base * (demand / stock) ** elast` with smoothing + noise
- Duration-based events (droughts, wars, tech booms, harvests, …)
- Player cash, cargo, inventory, travel, buildings, loans, upgrades
- NPC rivals with strategy archetypes that pressure local markets
- Route intelligence (`best_routes`) for arbitrage after distance costs
- Achievements + journal export
- Multiplayer-ready shared `GameWorld` with per-connection `PlayerState`

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE)
