# Dynamic Trade & Economy Simulator

A browser-based trading simulation where supply, demand, NPC traders, transport costs, and world events create shifting arbitrage opportunities.

## Run

Open `index.html` in a browser. The game is static and stores saves in `localStorage`.

You can also run `./start.sh` and open `http://localhost:8000` if you prefer a local server URL.

## Included systems

- Goods with base price, live price, volatility, trends, and unlock thresholds.
- Multiple regional markets with distinct supply and demand profiles.
- Smoothed price formula based on `base_price * demand / supply`.
- Random duration-based events such as droughts, wars, tech booms, strikes, and surpluses.
- Player money, cargo capacity, inventory, buy/sell actions, route travel, and upgrades.
- NPC pressure that buys underpriced goods and sells overpriced goods.
- Progression through higher net worth, unlocking goods and markets.
- Local save/reset, activity ledger, event notifications, and price history charts.
