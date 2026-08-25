# Mercantile — Captain’s Chart

A playable **trading-and-sailing game**. Eight ports, a hold that leaks money if you guess wrong, storms, pirates, delivery bonds, and a $500,000 campaign. The browser game in `web/` runs with no server. A FastAPI + WebSocket engine remains for live multiplayer ticks.

**Version:** 2.0.0

**Play locally (no Python required):**

```bash
python3 -m http.server 8000 --directory web
```

Open [http://localhost:8000](http://localhost:8000). Click **New voyage**, then click a lanterned port on the chart.

After merge, GitHub Pages will serve the same `web/` folder.

## How to play

- You start at **Veridian Port** with $2,000 and a 20-crate hold.
- **Buy cheap, sail, sell dear.** Prices move with supply, demand, and world events.
- Click a **connected** port to cast off. Time passes at sea; a squall or corsair may intercept you.
- **Yard**: patch hull, hire crew (better boarding odds), expand hold, cut faster canvas.
- **Bonds**: take a delivery contract and get paid on arrival if the cargo is aboard.
- Reach **$500,000 net worth** to win. If the hull hits zero, the voyage is over.

## Run the live server (optional)

```bash
./start.sh
```

Uvicorn serves `web/` at [http://localhost:8000](http://localhost:8000) and the original WebSocket economy on `/ws`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MERCANTILE_SEED` | unset | Integer seed for the Python world RNG |
| `SIM_TOKEN` | `dev` | Token for `POST /api/sim/tick` when `ENV=production` |
| `ENV` | unset | Set to `production` to enforce sim-tick auth |

## Architecture

| Path | Role |
| --- | --- |
| `web/` | Publishable game: map, sailing, encounters, save in `localStorage` |
| `engine.py` | Authoritative Python economy + hull/crew/contracts/encounters |
| `server.py` | FastAPI WebSocket + REST, static files from `web/` |
| `tests/` | Pytest for the engine |

## REST API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | `{ ok, service, tick, players, version }` |
| `GET` | `/api/snapshot` | Public economy snapshot |
| `GET` | `/api/cities` | City catalog |
| `GET` | `/api/goods` | Goods catalog |
| `GET` | `/api/achievements` | Achievement definitions |
| `POST` | `/api/sim/tick` | Advance world `n` ticks |

## Tests

```bash
pip install -r requirements.txt
pytest -q
```

See [CHANGELOG.md](CHANGELOG.md) for release notes.
