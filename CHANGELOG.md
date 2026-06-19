# Changelog

All notable changes to this project are documented here.

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
