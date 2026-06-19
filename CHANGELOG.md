# Changelog

All notable changes to this project are documented here.

## 2026-06-19

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
