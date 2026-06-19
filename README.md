# Dynamic Trade & Economy Simulator

A browser-based trading simulation where supply, demand, NPC traders, transport costs, and world events create shifting arbitrage opportunities.

The interface is designed as a responsive maritime exchange terminal, with the route map, spot market, strategy cockpit, and captain's ledger arranged around the core trade loop.

## Run

Open `index.html` in a browser. The game is static and stores saves in `localStorage`.

You can also run `python3 -m http.server 8000` and open `http://localhost:8000` if you prefer a local server URL.

## Included systems

- Goods with base price, live price, volatility, trends, and unlock thresholds.
- Multiple regional markets with distinct supply and demand profiles.
- Smoothed price formula based on `base_price * demand / supply`.
- Random duration-based events such as droughts, wars, tech booms, strikes, and surpluses.
- Player money, cargo capacity, inventory, buy/sell actions, route travel, and upgrades.
- NPC pressure that buys underpriced goods and sells overpriced goods.
- Progression through higher net worth, unlocking goods and markets.
- Route intelligence panel that ranks profitable arbitrage paths after freight costs.
- Risk-adjusted trade thesis scoring with confidence, event exposure, cargo fit, and projected run profit.
- Macro regime model that classifies the economy by dispersion, volatility, liquidity, event pressure, and route quality.
- Strategy Lab with risk profiles, forward stress cases, capital-at-risk sizing, and route staging.
- Local save/reset, activity ledger, event notifications, and price history charts.

See [CHANGELOG.md](CHANGELOG.md) for dated release notes.
