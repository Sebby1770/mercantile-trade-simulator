(function (global) {
  "use strict";

  const STORAGE_KEY = "dynamic-trade-economy-simulator-v1";
  const MAX_HISTORY = 64;
  const BUY_MARKUP = 1.018;
  const SELL_MARKDOWN = 0.982;

  const GOODS = [
    {
      id: "food",
      name: "Food",
      basePrice: 12,
      volatility: 0.11,
      unlockNetWorth: 0,
      unit: "crates",
      note: "Fast turnover"
    },
    {
      id: "textiles",
      name: "Textiles",
      basePrice: 24,
      volatility: 0.09,
      unlockNetWorth: 0,
      unit: "bales",
      note: "Stable margin"
    },
    {
      id: "oil",
      name: "Oil",
      basePrice: 48,
      volatility: 0.17,
      unlockNetWorth: 0,
      unit: "barrels",
      note: "Event sensitive"
    },
    {
      id: "electronics",
      name: "Electronics",
      basePrice: 92,
      volatility: 0.2,
      unlockNetWorth: 4600,
      unit: "kits",
      note: "Growth demand"
    },
    {
      id: "medicine",
      name: "Medicine",
      basePrice: 136,
      volatility: 0.15,
      unlockNetWorth: 9000,
      unit: "cases",
      note: "Defensive demand"
    },
    {
      id: "lithium",
      name: "Lithium",
      basePrice: 210,
      volatility: 0.24,
      unlockNetWorth: 15000,
      unit: "cells",
      note: "Speculative"
    }
  ];

  const MARKETS = [
    {
      id: "harbor",
      name: "Harbor Gate",
      tag: "Port",
      unlockNetWorth: 0,
      x: 72,
      y: 78,
      supply: { food: 0.95, textiles: 1.05, oil: 1.25, electronics: 1.35, medicine: 1.12, lithium: 0.92 },
      demand: { food: 1.18, textiles: 1.08, oil: 0.92, electronics: 0.9, medicine: 1.0, lithium: 1.05 }
    },
    {
      id: "agraria",
      name: "Agraria",
      tag: "Breadbasket",
      unlockNetWorth: 0,
      x: 244,
      y: 66,
      supply: { food: 1.55, textiles: 1.18, oil: 0.72, electronics: 0.68, medicine: 0.8, lithium: 0.62 },
      demand: { food: 0.74, textiles: 0.96, oil: 1.2, electronics: 1.2, medicine: 1.08, lithium: 0.92 }
    },
    {
      id: "foundry",
      name: "Foundry Row",
      tag: "Industry",
      unlockNetWorth: 0,
      x: 176,
      y: 176,
      supply: { food: 0.82, textiles: 0.9, oil: 1.42, electronics: 1.02, medicine: 0.78, lithium: 0.88 },
      demand: { food: 1.12, textiles: 1.02, oil: 0.88, electronics: 1.18, medicine: 0.96, lithium: 1.12 }
    },
    {
      id: "neon",
      name: "Neon Bay",
      tag: "Tech",
      unlockNetWorth: 6200,
      x: 356,
      y: 144,
      supply: { food: 0.72, textiles: 0.88, oil: 0.9, electronics: 1.42, medicine: 1.02, lithium: 1.2 },
      demand: { food: 1.08, textiles: 0.92, oil: 1.14, electronics: 1.28, medicine: 1.12, lithium: 1.42 }
    },
    {
      id: "alpine",
      name: "Alpine Lab",
      tag: "Research",
      unlockNetWorth: 12000,
      x: 444,
      y: 50,
      supply: { food: 0.66, textiles: 0.76, oil: 0.7, electronics: 0.92, medicine: 1.32, lithium: 1.1 },
      demand: { food: 1.16, textiles: 0.84, oil: 1.05, electronics: 1.3, medicine: 1.28, lithium: 1.55 }
    }
  ];

  const EVENT_TEMPLATES = [
    {
      id: "drought",
      name: "Drought",
      tone: "negative",
      summary: "Food supply contracts across farm routes.",
      duration: [5, 8],
      effects: [{ goodId: "food", marketId: "all", supplyMult: 0.68, demandMult: 1.08 }]
    },
    {
      id: "tech-boom",
      name: "Tech Boom",
      tone: "positive",
      summary: "Device makers chase components and battery inputs.",
      duration: [4, 7],
      effects: [
        { goodId: "electronics", marketId: "all", supplyMult: 0.98, demandMult: 1.32 },
        { goodId: "lithium", marketId: "all", supplyMult: 0.94, demandMult: 1.24 }
      ]
    },
    {
      id: "border-war",
      name: "Border War",
      tone: "negative",
      summary: "Oil and medicine demand spikes near industry corridors.",
      duration: [4, 7],
      effects: [
        { goodId: "oil", marketId: "all", supplyMult: 0.92, demandMult: 1.38 },
        { goodId: "medicine", marketId: "all", supplyMult: 0.9, demandMult: 1.3 }
      ]
    },
    {
      id: "shipping-strike",
      name: "Shipping Strike",
      tone: "negative",
      summary: "Imports stall at Harbor Gate.",
      duration: [3, 6],
      effects: [
        { goodId: "all", marketId: "harbor", supplyMult: 0.7, demandMult: 1.06 },
        { goodId: "electronics", marketId: "harbor", supplyMult: 0.62, demandMult: 1.14 }
      ]
    },
    {
      id: "harvest-surplus",
      name: "Harvest Surplus",
      tone: "positive",
      summary: "Agraria floods nearby markets with cheap food.",
      duration: [4, 7],
      effects: [
        { goodId: "food", marketId: "agraria", supplyMult: 1.42, demandMult: 0.9 },
        { goodId: "textiles", marketId: "agraria", supplyMult: 1.12, demandMult: 0.96 }
      ]
    },
    {
      id: "hospital-contract",
      name: "Hospital Contract",
      tone: "positive",
      summary: "Alpine Lab purchases medical stock aggressively.",
      duration: [4, 6],
      effects: [{ goodId: "medicine", marketId: "alpine", supplyMult: 0.92, demandMult: 1.5 }]
    },
    {
      id: "refinery-fire",
      name: "Refinery Fire",
      tone: "negative",
      summary: "Foundry Row loses part of its oil output.",
      duration: [3, 5],
      effects: [{ goodId: "oil", marketId: "foundry", supplyMult: 0.58, demandMult: 1.22 }]
    },
    {
      id: "consumer-slump",
      name: "Consumer Slump",
      tone: "negative",
      summary: "Luxury purchases slow while staples hold firm.",
      duration: [4, 7],
      effects: [
        { goodId: "electronics", marketId: "all", supplyMult: 1.08, demandMult: 0.78 },
        { goodId: "lithium", marketId: "all", supplyMult: 1.04, demandMult: 0.84 }
      ]
    }
  ];

  const MARKET_COLORS = {
    harbor: "#177f76",
    agraria: "#28865b",
    foundry: "#b45531",
    neon: "#6457a6",
    alpine: "#c28a16"
  };

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function getGood(goodId) {
    return GOODS.find((good) => good.id === goodId);
  }

  function getMarket(marketId) {
    return MARKETS.find((market) => market.id === marketId);
  }

  function createInitialState() {
    const state = {
      version: 1,
      tick: 0,
      day: 1,
      paused: false,
      selectedGood: "food",
      speed: 2,
      player: {
        money: 2500,
        capacity: 60,
        location: "harbor",
        inventory: GOODS.reduce((acc, good) => {
          acc[good.id] = 0;
          return acc;
        }, {})
      },
      unlockedGoods: {},
      unlockedMarkets: {},
      markets: {},
      events: [],
      log: []
    };

    GOODS.forEach((good) => {
      state.unlockedGoods[good.id] = good.unlockNetWorth === 0;
    });
    MARKETS.forEach((market) => {
      state.unlockedMarkets[market.id] = market.unlockNetWorth === 0;
      state.markets[market.id] = createMarketState(market);
    });

    addLog(state, "Welcome to the exchange. Early routes are open between Harbor Gate, Agraria, and Foundry Row.", "good");
    addLog(state, "Prices smooth toward base price times demand over supply, with events and traders adding pressure.", "warn");
    return state;
  }

  function createMarketState(market) {
    const result = {
      supply: {},
      demand: {},
      price: {},
      lastPrice: {},
      history: {},
      npcPressure: {}
    };

    GOODS.forEach((good) => {
      const supply = clamp(100 * market.supply[good.id] + randomBetween(-10, 10), 35, 220);
      const demand = clamp(100 * market.demand[good.id] + randomBetween(-10, 10), 35, 220);
      const price = calculateRawPrice(good, supply, demand);
      result.supply[good.id] = supply;
      result.demand[good.id] = demand;
      result.price[good.id] = price;
      result.lastPrice[good.id] = price;
      result.history[good.id] = Array.from({ length: 12 }, () => roundMoney(price * randomBetween(0.97, 1.03)));
      result.npcPressure[good.id] = 0;
    });

    return result;
  }

  function calculateRawPrice(good, supply, demand) {
    const ratio = clamp(demand / Math.max(1, supply), 0.3, 3.4);
    const softened = Math.pow(ratio, 0.72);
    return roundMoney(clamp(good.basePrice * softened, good.basePrice * 0.34, good.basePrice * 3.15));
  }

  function normalizeLoadedState(loaded) {
    if (!loaded || loaded.version !== 1 || !loaded.player || !loaded.markets) {
      return createInitialState();
    }

    const fresh = createInitialState();
    const state = Object.assign(fresh, loaded);
    state.player = Object.assign(fresh.player, loaded.player);
    state.player.inventory = Object.assign(fresh.player.inventory, loaded.player.inventory || {});
    state.unlockedGoods = Object.assign(fresh.unlockedGoods, loaded.unlockedGoods || {});
    state.unlockedMarkets = Object.assign(fresh.unlockedMarkets, loaded.unlockedMarkets || {});
    state.markets = Object.assign(fresh.markets, loaded.markets || {});
    state.events = Array.isArray(loaded.events) ? loaded.events : [];
    state.log = Array.isArray(loaded.log) ? loaded.log.slice(0, 80) : fresh.log;
    state.selectedGood = getGood(loaded.selectedGood) ? loaded.selectedGood : "food";
    state.speed = clamp(Number(loaded.speed) || 2, 1, 4);
    return state;
  }

  function addLog(state, message, type) {
    state.log.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tick: state.tick,
      day: state.day,
      message,
      type: type || "info"
    });
    state.log = state.log.slice(0, 80);
  }

  function getInventoryUsed(state) {
    return GOODS.reduce((total, good) => total + (state.player.inventory[good.id] || 0), 0);
  }

  function getCurrentMarketState(state) {
    return state.markets[state.player.location];
  }

  function getAveragePrice(state, goodId) {
    let total = 0;
    let count = 0;
    MARKETS.forEach((market) => {
      if (state.unlockedMarkets[market.id]) {
        total += state.markets[market.id].price[goodId];
        count += 1;
      }
    });
    return count ? total / count : getGood(goodId).basePrice;
  }

  function getInventoryValue(state) {
    return GOODS.reduce((total, good) => {
      const qty = state.player.inventory[good.id] || 0;
      return total + qty * getAveragePrice(state, good.id) * SELL_MARKDOWN;
    }, 0);
  }

  function getNetWorth(state) {
    return state.player.money + getInventoryValue(state);
  }

  function getTradePrice(state, marketId, goodId, side) {
    const price = state.markets[marketId].price[goodId];
    return roundMoney(price * (side === "buy" ? BUY_MARKUP : SELL_MARKDOWN));
  }

  function getTravelCost(state, destinationId) {
    const current = getMarket(state.player.location);
    const destination = getMarket(destinationId);
    if (!current || !destination || current.id === destination.id) {
      return 0;
    }
    const dx = current.x - destination.x;
    const dy = current.y - destination.y;
    return Math.round(18 + Math.sqrt(dx * dx + dy * dy) * 0.28);
  }

  function getEventMultipliers(state, marketId, goodId) {
    const multipliers = { supply: 1, demand: 1 };
    state.events.forEach((event) => {
      event.effects.forEach((effect) => {
        const marketMatches = effect.marketId === "all" || effect.marketId === marketId;
        const goodMatches = effect.goodId === "all" || effect.goodId === goodId;
        if (marketMatches && goodMatches) {
          multipliers.supply *= effect.supplyMult || 1;
          multipliers.demand *= effect.demandMult || 1;
        }
      });
    });
    return multipliers;
  }

  function tickEconomy(state, options) {
    const opts = options || {};
    state.tick += 1;
    state.day = Math.floor(state.tick / 4) + 1;

    expireEvents(state);
    if (!opts.skipEvents) {
      maybeStartEvent(state);
    }

    GOODS.forEach((good) => {
      const averageBefore = getAveragePrice(state, good.id);
      MARKETS.forEach((market) => {
        const marketState = state.markets[market.id];
        const baseSupply = 100 * market.supply[good.id];
        const baseDemand = 100 * market.demand[good.id];
        const noise = (Math.random() - 0.5) * good.volatility * 18;

        marketState.supply[good.id] += (baseSupply - marketState.supply[good.id]) * 0.035 + noise;
        marketState.demand[good.id] += (baseDemand - marketState.demand[good.id]) * 0.035 - noise * 0.48;

        const price = marketState.price[good.id];
        const gap = (price - averageBefore) / Math.max(1, averageBefore);
        let pressure = 0;
        if (gap < -0.1) {
          pressure = clamp(Math.abs(gap) * 18, 0.8, 4.2);
          marketState.supply[good.id] -= pressure;
          marketState.demand[good.id] += pressure * 0.42;
        } else if (gap > 0.1) {
          pressure = -clamp(Math.abs(gap) * 15, 0.8, 3.8);
          marketState.supply[good.id] += Math.abs(pressure) * 1.2;
          marketState.demand[good.id] -= Math.abs(pressure) * 0.35;
        }
        marketState.npcPressure[good.id] = pressure;

        marketState.supply[good.id] = clamp(marketState.supply[good.id], 24, 260);
        marketState.demand[good.id] = clamp(marketState.demand[good.id], 24, 260);

        const eventMult = getEventMultipliers(state, market.id, good.id);
        const effectiveSupply = clamp(marketState.supply[good.id] * eventMult.supply, 18, 320);
        const effectiveDemand = clamp(marketState.demand[good.id] * eventMult.demand, 18, 320);
        const rawPrice = calculateRawPrice(good, effectiveSupply, effectiveDemand);
        const randomPriceShock = 1 + (Math.random() - 0.5) * good.volatility * 0.12;
        const targetPrice = clamp(rawPrice * randomPriceShock, good.basePrice * 0.34, good.basePrice * 3.15);
        const smoothing = 0.18 + good.volatility * 0.38;

        marketState.lastPrice[good.id] = marketState.price[good.id];
        marketState.price[good.id] = roundMoney(marketState.price[good.id] * (1 - smoothing) + targetPrice * smoothing);
        marketState.history[good.id].push(marketState.price[good.id]);
        if (marketState.history[good.id].length > MAX_HISTORY) {
          marketState.history[good.id].shift();
        }
      });
    });

    evaluateProgression(state);
    if (state.tick % 6 === 0) {
      autosave(state);
    }
    return state;
  }

  function expireEvents(state) {
    const expired = [];
    state.events.forEach((event) => {
      event.remaining -= 1;
      if (event.remaining <= 0) {
        expired.push(event);
      }
    });
    state.events = state.events.filter((event) => event.remaining > 0);
    expired.forEach((event) => addLog(state, `${event.name} fades from the market.`, "info"));
  }

  function maybeStartEvent(state) {
    if (state.tick < 2 || state.events.length >= 3 || Math.random() > 0.2) {
      return;
    }
    const activeIds = new Set(state.events.map((event) => event.id));
    const choices = EVENT_TEMPLATES.filter((event) => !activeIds.has(event.id));
    if (!choices.length) {
      return;
    }
    const template = choices[randomInt(0, choices.length - 1)];
    const duration = randomInt(template.duration[0], template.duration[1]);
    const event = {
      id: template.id,
      name: template.name,
      tone: template.tone,
      summary: template.summary,
      remaining: duration,
      total: duration,
      effects: template.effects.map((effect) => Object.assign({}, effect))
    };
    state.events.push(event);
    addLog(state, `${event.name}: ${event.summary}`, event.tone === "negative" ? "bad" : "good");
  }

  function evaluateProgression(state) {
    const netWorth = getNetWorth(state);
    GOODS.forEach((good) => {
      if (!state.unlockedGoods[good.id] && netWorth >= good.unlockNetWorth) {
        state.unlockedGoods[good.id] = true;
        addLog(state, `${good.name} trading desk unlocked.`, "good");
      }
    });
    MARKETS.forEach((market) => {
      if (!state.unlockedMarkets[market.id] && netWorth >= market.unlockNetWorth) {
        state.unlockedMarkets[market.id] = true;
        addLog(state, `${market.name} route unlocked.`, "good");
      }
    });
  }

  function buyGood(state, goodId, requestedQty) {
    if (!state.unlockedGoods[goodId]) {
      addLog(state, "That desk is still locked.", "warn");
      return false;
    }
    const market = getCurrentMarketState(state);
    const price = getTradePrice(state, state.player.location, goodId, "buy");
    const cargoLeft = state.player.capacity - getInventoryUsed(state);
    const marketAvailable = Math.max(0, Math.floor(market.supply[goodId] - 12));
    const affordable = Math.floor(state.player.money / price);
    const qty = clamp(Math.floor(requestedQty || 0), 0, Math.min(cargoLeft, marketAvailable, affordable));
    if (qty <= 0) {
      addLog(state, "Buy order rejected: check cash, cargo, or local supply.", "warn");
      return false;
    }

    const cost = roundMoney(qty * price);
    state.player.money = roundMoney(state.player.money - cost);
    state.player.inventory[goodId] += qty;
    market.supply[goodId] = clamp(market.supply[goodId] - qty * 0.86, 18, 260);
    market.demand[goodId] = clamp(market.demand[goodId] + qty * 0.11, 18, 260);
    addLog(state, `Bought ${qty} ${getGood(goodId).unit} of ${getGood(goodId).name} for ${formatMoney(cost)}.`, "info");
    return true;
  }

  function sellGood(state, goodId, requestedQty) {
    if (!state.unlockedGoods[goodId]) {
      addLog(state, "That desk is still locked.", "warn");
      return false;
    }
    const owned = state.player.inventory[goodId] || 0;
    const qty = clamp(Math.floor(requestedQty || 0), 0, owned);
    if (qty <= 0) {
      addLog(state, "Sell order rejected: no inventory available.", "warn");
      return false;
    }

    const market = getCurrentMarketState(state);
    const price = getTradePrice(state, state.player.location, goodId, "sell");
    const revenue = roundMoney(qty * price);
    state.player.money = roundMoney(state.player.money + revenue);
    state.player.inventory[goodId] -= qty;
    market.supply[goodId] = clamp(market.supply[goodId] + qty * 0.92, 18, 260);
    market.demand[goodId] = clamp(market.demand[goodId] - qty * 0.08, 18, 260);
    addLog(state, `Sold ${qty} ${getGood(goodId).unit} of ${getGood(goodId).name} for ${formatMoney(revenue)}.`, "good");
    evaluateProgression(state);
    return true;
  }

  function travelToMarket(state, marketId) {
    if (state.player.location === marketId) {
      return false;
    }
    if (!state.unlockedMarkets[marketId]) {
      addLog(state, `${getMarket(marketId).name} is still locked.`, "warn");
      return false;
    }
    const cost = getTravelCost(state, marketId);
    if (state.player.money < cost) {
      addLog(state, "Travel denied: insufficient cash for freight and port fees.", "warn");
      return false;
    }
    state.player.money = roundMoney(state.player.money - cost);
    state.player.location = marketId;
    addLog(state, `Moved convoy to ${getMarket(marketId).name} for ${formatMoney(cost)}.`, "info");
    tickEconomy(state, { skipEvents: false });
    return true;
  }

  function upgradeCargo(state) {
    const cost = getCargoUpgradeCost(state);
    if (state.player.money < cost) {
      addLog(state, "Cargo expansion needs more cash.", "warn");
      return false;
    }
    state.player.money = roundMoney(state.player.money - cost);
    state.player.capacity += 25;
    addLog(state, `Cargo capacity expanded to ${state.player.capacity}.`, "good");
    return true;
  }

  function getCargoUpgradeCost(state) {
    return Math.round(780 + state.player.capacity * 28);
  }

  function getPromoteCost(state) {
    return Math.round(160 + getGood(state.selectedGood).basePrice * 2.6);
  }

  function getSupplierCost(state) {
    return Math.round(150 + getGood(state.selectedGood).basePrice * 2.25);
  }

  function getScanCost(state) {
    return 115;
  }

  function promoteDemand(state) {
    const cost = getPromoteCost(state);
    const good = getGood(state.selectedGood);
    if (!state.unlockedGoods[good.id]) {
      addLog(state, "Select an unlocked good before funding demand.", "warn");
      return false;
    }
    if (state.player.money < cost) {
      addLog(state, "Demand campaign needs more cash.", "warn");
      return false;
    }
    const market = getCurrentMarketState(state);
    state.player.money = roundMoney(state.player.money - cost);
    market.demand[good.id] = clamp(market.demand[good.id] + randomBetween(10, 18), 18, 260);
    addLog(state, `Demand campaign lifted ${good.name} interest in ${getMarket(state.player.location).name}.`, "good");
    return true;
  }

  function secureSupplier(state) {
    const cost = getSupplierCost(state);
    const good = getGood(state.selectedGood);
    if (!state.unlockedGoods[good.id]) {
      addLog(state, "Select an unlocked good before sourcing supply.", "warn");
      return false;
    }
    if (state.player.money < cost) {
      addLog(state, "Supplier contract needs more cash.", "warn");
      return false;
    }
    const market = getCurrentMarketState(state);
    state.player.money = roundMoney(state.player.money - cost);
    market.supply[good.id] = clamp(market.supply[good.id] + randomBetween(12, 22), 18, 260);
    addLog(state, `Supplier contract increased ${good.name} supply in ${getMarket(state.player.location).name}.`, "good");
    return true;
  }

  function scanMarket(state) {
    const cost = getScanCost(state);
    if (state.player.money < cost) {
      addLog(state, "Market scan needs more cash.", "warn");
      return false;
    }
    state.player.money = roundMoney(state.player.money - cost);

    let best = null;
    GOODS.forEach((good) => {
      if (!state.unlockedGoods[good.id]) {
        return;
      }
      MARKETS.forEach((buyMarket) => {
        if (!state.unlockedMarkets[buyMarket.id]) {
          return;
        }
        MARKETS.forEach((sellMarket) => {
          if (!state.unlockedMarkets[sellMarket.id] || buyMarket.id === sellMarket.id) {
            return;
          }
          const buy = getTradePrice(state, buyMarket.id, good.id, "buy");
          const sell = getTradePrice(state, sellMarket.id, good.id, "sell");
          const route = estimateRouteCost(buyMarket.id, sellMarket.id);
          const margin = sell - buy - route / 10;
          if (!best || margin > best.margin) {
            best = { good, buyMarket, sellMarket, buy, sell, margin };
          }
        });
      });
    });

    if (best && best.margin > 0) {
      addLog(
        state,
        `Scan: ${best.good.name} looks strongest from ${best.buyMarket.name} at ${formatMoney(best.buy)} to ${best.sellMarket.name} at ${formatMoney(best.sell)}.`,
        "good"
      );
    } else {
      addLog(state, "Scan: no clear arbitrage after spreads and freight.", "warn");
    }
    return true;
  }

  function estimateRouteCost(fromId, toId) {
    const from = getMarket(fromId);
    const to = getMarket(toId);
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    return Math.round(18 + Math.sqrt(dx * dx + dy * dy) * 0.28);
  }

  function formatMoney(value) {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }

  function formatDecimal(value, places) {
    return Number(value).toFixed(places == null ? 1 : places);
  }

  function createIcon(name) {
    return `<span class="good-icon"><svg aria-hidden="true"><use href="#icon-${name}"></use></svg></span>`;
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeLoadedState(JSON.parse(saved)) : createInitialState();
    } catch (error) {
      return createInitialState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      addLog(state, "Game saved locally.", "good");
      return true;
    } catch (error) {
      addLog(state, "Save failed in this browser context.", "bad");
      return false;
    }
  }

  function autosave(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      return false;
    }
    return true;
  }

  function clearSave() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      return false;
    }
    return true;
  }

  function getNextUnlock(state) {
    const netWorth = getNetWorth(state);
    const candidates = [];
    GOODS.forEach((good) => {
      if (!state.unlockedGoods[good.id]) {
        candidates.push({ type: "Good", name: good.name, target: good.unlockNetWorth });
      }
    });
    MARKETS.forEach((market) => {
      if (!state.unlockedMarkets[market.id]) {
        candidates.push({ type: "Market", name: market.name, target: market.unlockNetWorth });
      }
    });
    candidates.sort((a, b) => a.target - b.target);
    const next = candidates.find((candidate) => candidate.target > netWorth);
    return next || null;
  }

  function buildSparkline(values) {
    const recent = values.slice(-18);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const span = Math.max(0.01, max - min);
    const points = recent.map((value, index) => {
      const x = (index / Math.max(1, recent.length - 1)) * 72;
      const y = 24 - ((value - min) / span) * 20 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `<svg class="sparkline" width="78" height="28" viewBox="0 0 78 28" aria-hidden="true"><polyline points="${points.join(" ")}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
  }

  function trendFor(marketState, goodId) {
    const current = marketState.price[goodId];
    const previous = marketState.lastPrice[goodId] || current;
    const change = ((current - previous) / Math.max(0.01, previous)) * 100;
    if (change > 0.35) {
      return { cls: "trend-up", icon: "up", label: `+${formatDecimal(change, 1)}%` };
    }
    if (change < -0.35) {
      return { cls: "trend-down", icon: "down", label: `${formatDecimal(change, 1)}%` };
    }
    return { cls: "trend-flat", icon: "flat", label: "Flat" };
  }

  function render(state, elements) {
    const currentMarket = getMarket(state.player.location);
    const marketState = getCurrentMarketState(state);
    const used = getInventoryUsed(state);
    const netWorth = getNetWorth(state);

    elements.dayLabel.textContent = `Day ${state.day}`;
    elements.moneyLabel.textContent = formatMoney(state.player.money);
    elements.netWorthLabel.textContent = formatMoney(netWorth);
    elements.cargoLabel.textContent = `${used}/${state.player.capacity}`;
    elements.capacityBadge.textContent = `${state.player.capacity - used} left`;
    elements.locationBadge.textContent = currentMarket.name;
    elements.goodsTitle.textContent = `${currentMarket.name} Prices`;
    elements.tickLabel.textContent = `Tick ${state.tick}`;
    elements.eventCountBadge.textContent = `${state.events.length} active`;
    elements.selectedGoodBadge.textContent = getGood(state.selectedGood).name;
    elements.pauseButton.innerHTML = state.paused
      ? `<svg aria-hidden="true"><use href="#icon-play"></use></svg><span>Resume</span>`
      : `<svg aria-hidden="true"><use href="#icon-pause"></use></svg><span>Pause</span>`;

    const nextUnlock = getNextUnlock(state);
    elements.unlockBadge.textContent = nextUnlock
      ? `${nextUnlock.name} at ${formatMoney(nextUnlock.target)}`
      : "All unlocked";

    renderMap(state, elements.routeMap);
    renderMarketList(state, elements.marketList);
    renderGoodsTable(state, elements.goodsTableBody, marketState);
    renderInventory(state, elements.inventoryList);
    renderEvents(state, elements.eventList);
    renderProgress(state, elements.progressList);
    renderLog(state, elements.logList);
    renderOperations(state, elements);
    renderChart(state, elements.priceCanvas);
  }

  function renderMap(state, container) {
    const lines = [
      ["harbor", "agraria"],
      ["harbor", "foundry"],
      ["agraria", "foundry"],
      ["foundry", "neon"],
      ["neon", "alpine"],
      ["agraria", "alpine"]
    ];
    const laneMarkup = lines
      .map(([fromId, toId]) => {
        const from = getMarket(fromId);
        const to = getMarket(toId);
        return `<path class="map-lane" d="M${from.x} ${from.y} L${to.x} ${to.y}"></path>`;
      })
      .join("");
    const nodeMarkup = MARKETS.map((market) => {
      const locked = !state.unlockedMarkets[market.id];
      const current = state.player.location === market.id;
      const cls = ["map-node", locked ? "locked" : "", current ? "current" : ""].filter(Boolean).join(" ");
      const labelCls = locked ? "map-label locked" : "map-label";
      return `
        <g>
          <circle class="${cls}" cx="${market.x}" cy="${market.y}" r="${current ? 12 : 10}"></circle>
          <text class="${labelCls}" x="${market.x + 15}" y="${market.y - 2}">${market.name}</text>
          <text class="map-sub" x="${market.x + 15}" y="${market.y + 13}">${locked ? `Unlock ${formatMoney(market.unlockNetWorth)}` : market.tag}</text>
        </g>
      `;
    }).join("");

    container.innerHTML = `
      <svg class="market-map-svg" viewBox="0 0 520 230" role="img" aria-label="Unlocked and locked trade routes">
        <path d="M30 182 C86 130 110 188 166 142 C220 96 252 132 314 92 C370 55 438 90 492 34" fill="none" stroke="rgba(23,127,118,0.13)" stroke-width="42" stroke-linecap="round"></path>
        ${laneMarkup}
        ${nodeMarkup}
      </svg>
    `;
  }

  function renderMarketList(state, container) {
    container.innerHTML = MARKETS.map((market) => {
      const locked = !state.unlockedMarkets[market.id];
      const current = state.player.location === market.id;
      const cost = current ? "Here" : locked ? formatMoney(market.unlockNetWorth) : formatMoney(getTravelCost(state, market.id));
      return `
        <button class="market-button ${current ? "is-current" : ""}" type="button" data-travel="${market.id}" ${locked || current ? "disabled" : ""}>
          <span>
            <strong>${market.name}</strong>
            <small>${locked ? "Locked route" : market.tag}</small>
          </span>
          <span class="route-cost">${cost}</span>
        </button>
      `;
    }).join("");
  }

  function renderGoodsTable(state, tbody, marketState) {
    tbody.innerHTML = GOODS.map((good) => {
      const locked = !state.unlockedGoods[good.id];
      const selected = state.selectedGood === good.id;
      const supply = marketState.supply[good.id];
      const demand = marketState.demand[good.id];
      const trend = trendFor(marketState, good.id);
      const owned = state.player.inventory[good.id] || 0;
      const pressure = marketState.npcPressure[good.id];
      const pressureText = pressure > 0.4 ? "NPC buying" : pressure < -0.4 ? "NPC selling" : "NPC neutral";
      const unlockText = locked ? `<span class="locked-tag">Unlock ${formatMoney(good.unlockNetWorth)}</span>` : good.note;
      return `
        <tr class="${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}" data-select-good="${good.id}">
          <td>
            <div class="row-good">
              ${createIcon(good.id)}
              <span>
                <strong>${good.name}</strong>
                <small>${unlockText}</small>
              </span>
            </div>
          </td>
          <td class="price-buy">${locked ? "--" : formatMoney(getTradePrice(state, state.player.location, good.id, "buy"))}</td>
          <td class="price-sell">${locked ? "--" : formatMoney(getTradePrice(state, state.player.location, good.id, "sell"))}</td>
          <td>
            <div class="metric-line">
              <span>${Math.round(supply)}</span>
              <span class="bar" style="--value:${clamp(supply / 2.4, 4, 100)}%"><span></span></span>
            </div>
            <span class="metric-sub">${pressureText}</span>
          </td>
          <td>
            <div class="metric-line">
              <span>${Math.round(demand)}</span>
              <span class="bar demand" style="--value:${clamp(demand / 2.4, 4, 100)}%"><span></span></span>
            </div>
            <span class="metric-sub">Base ${formatMoney(good.basePrice)}</span>
          </td>
          <td>
            <span class="trend-pill ${trend.cls}">
              <svg aria-hidden="true"><use href="#icon-${trend.icon}"></use></svg>
              ${trend.label}
            </span>
            ${buildSparkline(marketState.history[good.id])}
          </td>
          <td>${owned}</td>
          <td>
            <span class="trade-actions">
              <button class="trade-button buy" type="button" data-buy="${good.id}" ${locked ? "disabled" : ""}>
                <svg aria-hidden="true"><use href="#icon-coin"></use></svg>
                Buy
              </button>
              <button class="trade-button sell" type="button" data-sell="${good.id}" ${locked || owned <= 0 ? "disabled" : ""}>
                <svg aria-hidden="true"><use href="#icon-route"></use></svg>
                Sell
              </button>
            </span>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderInventory(state, container) {
    const items = GOODS.filter((good) => (state.player.inventory[good.id] || 0) > 0);
    if (!items.length) {
      container.innerHTML = `<p class="empty-state">Cargo hold is empty.</p>`;
      return;
    }
    container.innerHTML = items.map((good) => {
      const qty = state.player.inventory[good.id];
      const avg = getAveragePrice(state, good.id);
      return `
        <div class="inventory-item">
          <span>
            <strong>${good.name}</strong>
            <small>${qty} ${good.unit}</small>
          </span>
          <span>${formatMoney(qty * avg * SELL_MARKDOWN)}</span>
        </div>
      `;
    }).join("");
  }

  function renderEvents(state, container) {
    if (!state.events.length) {
      container.innerHTML = `<p class="empty-state">No active shocks. The market is breathing normally.</p>`;
      return;
    }
    container.innerHTML = state.events.map((event) => `
      <div class="event-item ${event.tone}">
        <span>
          <strong>${event.name}</strong>
          <small>${event.summary}</small>
        </span>
        <span>${event.remaining}t</span>
      </div>
    `).join("");
  }

  function renderProgress(state, container) {
    const netWorth = getNetWorth(state);
    const candidates = [
      ...GOODS.filter((good) => !state.unlockedGoods[good.id]).map((good) => ({ label: good.name, kind: "Good", target: good.unlockNetWorth })),
      ...MARKETS.filter((market) => !state.unlockedMarkets[market.id]).map((market) => ({ label: market.name, kind: "Market", target: market.unlockNetWorth }))
    ].sort((a, b) => a.target - b.target).slice(0, 3);

    if (!candidates.length) {
      container.innerHTML = `
        <div class="progress-row">
          <span>
            <strong>Network complete</strong>
            <small>All desks and markets unlocked</small>
          </span>
          <span class="progress-meter" style="--value:100%"><span></span></span>
        </div>
      `;
      return;
    }

    container.innerHTML = candidates.map((item) => {
      const progress = clamp((netWorth / item.target) * 100, 0, 100);
      return `
        <div class="progress-row">
          <span>
            <strong>${item.label}</strong>
            <small>${item.kind} at ${formatMoney(item.target)}</small>
          </span>
          <span class="progress-meter" style="--value:${progress}%"><span></span></span>
        </div>
      `;
    }).join("");
  }

  function renderLog(state, container) {
    container.innerHTML = state.log.slice(0, 18).map((entry) => `
      <div class="log-entry ${entry.type || ""}">
        <span>
          <small>Day ${entry.day}, Tick ${entry.tick}</small><br>
          ${entry.message}
        </span>
      </div>
    `).join("");
  }

  function renderOperations(state, elements) {
    const cargoCost = getCargoUpgradeCost(state);
    const promoteCost = getPromoteCost(state);
    const supplierCost = getSupplierCost(state);
    const scanCost = getScanCost(state);
    elements.cargoUpgradeCost.textContent = formatMoney(cargoCost);
    elements.promoteCost.textContent = formatMoney(promoteCost);
    elements.supplierCost.textContent = formatMoney(supplierCost);
    elements.scanCost.textContent = formatMoney(scanCost);
    elements.upgradeCargoButton.disabled = state.player.money < cargoCost;
    elements.promoteButton.disabled = state.player.money < promoteCost || !state.unlockedGoods[state.selectedGood];
    elements.supplierButton.disabled = state.player.money < supplierCost || !state.unlockedGoods[state.selectedGood];
    elements.scanButton.disabled = state.player.money < scanCost;
  }

  function renderChart(state, canvas) {
    if (!canvas || !canvas.getContext) {
      return;
    }
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, rect.width || canvas.clientWidth || 640);
    const height = Math.max(220, rect.height || 280);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padding = { left: 48, right: 18, top: 22, bottom: 34 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const histories = MARKETS.filter((market) => state.unlockedMarkets[market.id]).map((market) => ({
      market,
      values: state.markets[market.id].history[state.selectedGood].slice(-MAX_HISTORY)
    }));
    const allValues = histories.flatMap((item) => item.values);
    const min = Math.min(...allValues) * 0.96;
    const max = Math.max(...allValues) * 1.04;
    const span = Math.max(1, max - min);

    ctx.fillStyle = "#fbfcf9";
    ctx.strokeStyle = "#d8ded5";
    ctx.lineWidth = 1;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeRect(padding.left, padding.top, plotW, plotH);

    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#66716f";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i += 1) {
      const value = min + (span * i) / 4;
      const y = padding.top + plotH - (plotH * i) / 4;
      ctx.strokeStyle = i === 0 ? "#b8c4bb" : "#e2e7e0";
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
      ctx.fillText(formatMoney(value), padding.left - 8, y);
    }

    histories.forEach((item) => {
      ctx.strokeStyle = MARKET_COLORS[item.market.id] || "#177f76";
      ctx.lineWidth = item.market.id === state.player.location ? 3 : 1.8;
      ctx.beginPath();
      item.values.forEach((value, index) => {
        const x = padding.left + (index / Math.max(1, item.values.length - 1)) * plotW;
        const y = padding.top + plotH - ((value - min) / span) * plotH;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    let legendX = padding.left;
    histories.forEach((item) => {
      ctx.fillStyle = MARKET_COLORS[item.market.id] || "#177f76";
      ctx.fillRect(legendX, height - 20, 10, 10);
      ctx.fillStyle = "#172121";
      ctx.fillText(item.market.name, legendX + 14, height - 11);
      legendX += ctx.measureText(item.market.name).width + 36;
    });
  }

  function bindEvents(state, elements, rerender, restartLoop) {
    elements.pauseButton.addEventListener("click", () => {
      state.paused = !state.paused;
      rerender();
    });

    elements.tickButton.addEventListener("click", () => {
      tickEconomy(state);
      rerender();
    });

    elements.speedRange.addEventListener("input", () => {
      state.speed = Number(elements.speedRange.value);
      restartLoop();
      rerender();
    });

    elements.saveButton.addEventListener("click", () => {
      saveState(state);
      rerender();
    });

    elements.resetButton.addEventListener("click", () => {
      if (typeof global.confirm === "function" && !global.confirm("Reset this trading run and clear the local save?")) {
        return;
      }
      clearSave();
      const fresh = createInitialState();
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, fresh);
      elements.quantityInput.value = 5;
      elements.speedRange.value = state.speed;
      rerender();
      restartLoop();
    });

    elements.marketList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-travel]");
      if (!button) {
        return;
      }
      travelToMarket(state, button.dataset.travel);
      rerender();
    });

    elements.goodsTableBody.addEventListener("click", (event) => {
      const row = event.target.closest("[data-select-good]");
      if (row) {
        state.selectedGood = row.dataset.selectGood;
      }
      const buyButton = event.target.closest("[data-buy]");
      const sellButton = event.target.closest("[data-sell]");
      const qty = Math.max(1, Math.floor(Number(elements.quantityInput.value) || 1));
      if (buyButton) {
        buyGood(state, buyButton.dataset.buy, qty);
      }
      if (sellButton) {
        sellGood(state, sellButton.dataset.sell, qty);
      }
      rerender();
    });

    elements.upgradeCargoButton.addEventListener("click", () => {
      upgradeCargo(state);
      rerender();
    });

    elements.promoteButton.addEventListener("click", () => {
      promoteDemand(state);
      rerender();
    });

    elements.supplierButton.addEventListener("click", () => {
      secureSupplier(state);
      rerender();
    });

    elements.scanButton.addEventListener("click", () => {
      scanMarket(state);
      rerender();
    });

    window.addEventListener("resize", () => renderChart(state, elements.priceCanvas));
  }

  function getElements(documentRef) {
    const ids = [
      "dayLabel",
      "moneyLabel",
      "netWorthLabel",
      "cargoLabel",
      "pauseButton",
      "tickButton",
      "speedRange",
      "saveButton",
      "resetButton",
      "locationBadge",
      "routeMap",
      "marketList",
      "goodsTitle",
      "quantityInput",
      "goodsTableBody",
      "inventoryList",
      "capacityBadge",
      "eventList",
      "eventCountBadge",
      "priceCanvas",
      "selectedGoodBadge",
      "upgradeCargoButton",
      "promoteButton",
      "supplierButton",
      "scanButton",
      "cargoUpgradeCost",
      "promoteCost",
      "supplierCost",
      "scanCost",
      "progressList",
      "unlockBadge",
      "logList",
      "tickLabel"
    ];
    return ids.reduce((acc, id) => {
      acc[id] = documentRef.getElementById(id);
      return acc;
    }, {});
  }

  function startGame(documentRef) {
    const state = loadState();
    const elements = getElements(documentRef);
    elements.speedRange.value = state.speed;
    let intervalId = null;

    function intervalDelay() {
      return [0, 3200, 2200, 1300, 750][state.speed] || 2200;
    }

    function rerender() {
      render(state, elements);
      autosave(state);
    }

    function restartLoop() {
      if (intervalId) {
        clearInterval(intervalId);
      }
      intervalId = setInterval(() => {
        if (!state.paused) {
          tickEconomy(state);
          rerender();
        }
      }, intervalDelay());
    }

    bindEvents(state, elements, rerender, restartLoop);
    rerender();
    restartLoop();
  }

  const api = {
    GOODS,
    MARKETS,
    EVENT_TEMPLATES,
    createInitialState,
    tickEconomy,
    buyGood,
    sellGood,
    travelToMarket,
    upgradeCargo,
    promoteDemand,
    secureSupplier,
    scanMarket,
    getNetWorth,
    getInventoryUsed,
    getTradePrice,
    getTravelCost,
    formatMoney
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.TradeEconomySim = api;

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => startGame(document));
  }
})(typeof window !== "undefined" ? window : globalThis);
