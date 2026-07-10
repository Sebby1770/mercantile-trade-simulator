# Changelog

All notable changes to this project are documented here.

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
