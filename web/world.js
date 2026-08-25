/* Offline captain simulation — playable without the Python server. */
(function (global) {
  "use strict";

  const VERSION = "2.0.0";
  const GOAL = 500000;
  const START_CASH = 2000;
  const START_HULL = 100;

  const GOODS = [
    { id: "food", name: "Food", base: 18, vol: 0.18, elast: 0.55, cat: "raw" },
    { id: "water", name: "Water", base: 9, vol: 0.12, elast: 0.5, cat: "raw" },
    { id: "coal", name: "Coal", base: 25, vol: 0.16, elast: 0.55, cat: "raw" },
    { id: "fuel", name: "Fuel", base: 55, vol: 0.22, elast: 0.65, cat: "raw" },
    { id: "ore", name: "Ore", base: 32, vol: 0.2, elast: 0.6, cat: "raw" },
    { id: "timber", name: "Timber", base: 28, vol: 0.17, elast: 0.58, cat: "raw" },
    { id: "spice", name: "Spices", base: 85, vol: 0.32, elast: 0.75, cat: "luxury" },
    { id: "text", name: "Textiles", base: 85, vol: 0.18, elast: 0.6, cat: "processed" },
    { id: "meds", name: "Medicine", base: 230, vol: 0.24, elast: 0.65, cat: "processed" },
    { id: "elec", name: "Electronics", base: 310, vol: 0.28, elast: 0.7, cat: "processed" },
    { id: "silk", name: "Silk", base: 320, vol: 0.26, elast: 0.72, cat: "luxury" },
    { id: "arms", name: "Weapons", base: 440, vol: 0.22, elast: 0.65, cat: "luxury" },
    { id: "lux", name: "Luxuries", base: 580, vol: 0.3, elast: 0.8, cat: "luxury" },
    { id: "art", name: "Artifacts", base: 920, vol: 0.35, elast: 0.85, cat: "luxury" },
  ];
  const GOODS_MAP = Object.fromEntries(GOODS.map((g) => [g.id, g]));

  const CITIES = [
    { id: "veridian", name: "Veridian Port", tag: "Grain & timber coast", x: 118, y: 92, color: "#4ade80" },
    { id: "ironhold", name: "Ironhold", tag: "Forge & ore", x: 268, y: 210, color: "#fbbf24" },
    { id: "neonbay", name: "Neon Bay", tag: "Glass and circuitry", x: 448, y: 72, color: "#60a5fa" },
    { id: "solis", name: "Solis Reach", tag: "Desert refinery", x: 168, y: 328, color: "#f97316" },
    { id: "stormgate", name: "Stormgate", tag: "Frontier guns", x: 612, y: 292, color: "#f87171" },
    { id: "aurelia", name: "Aurelia", tag: "Imperial capital", x: 692, y: 88, color: "#c084fc" },
    { id: "khalMesa", name: "Khal Mesa", tag: "Highland caravans", x: 384, y: 242, color: "#34d399" },
    { id: "theDrift", name: "The Drift", tag: "Smuggler flats", x: 328, y: 372, color: "#fb7185" },
  ];
  const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));

  const ROUTES_RAW = [
    ["veridian", "ironhold", 4], ["veridian", "neonbay", 3], ["veridian", "solis", 6],
    ["ironhold", "solis", 4], ["ironhold", "khalMesa", 3], ["ironhold", "stormgate", 5],
    ["neonbay", "aurelia", 3], ["neonbay", "khalMesa", 4],
    ["khalMesa", "stormgate", 4], ["khalMesa", "theDrift", 3],
    ["solis", "theDrift", 3],
    ["stormgate", "aurelia", 4], ["stormgate", "theDrift", 5],
  ];
  const ROUTES = {};
  ROUTES_RAW.forEach(([a, b, d]) => {
    ROUTES[`${a}:${b}`] = d;
    ROUTES[`${b}:${a}`] = d;
  });

  const SPEED = [1, 0.75, 0.55];
  const CARGO = [20, 40, 80, 150];
  const CARGO_COST = [0, 8000, 20000, 50000];
  const SPEED_COST = [0, 12000, 35000];
  const SAVE_KEY = "mercantile.captain.v2";

  class Rng {
    constructor(seed) {
      this.s = (seed >>> 0) || 1;
    }
    next() {
      this.s = (Math.imul(1664525, this.s) + 1013904223) >>> 0;
      return this.s;
    }
    random() { return this.next() / 4294967296; }
    range(n) { return this.next() % n; }
    pick(list) { return list[this.range(list.length)]; }
  }

  function targetPrice(base, demand, stock, elast) {
    return base * Math.pow(Math.max(demand, 1e-9) / Math.max(stock, 1e-9), elast);
  }

  class World {
    constructor(seed) {
      this.seed = seed == null ? (Math.random() * 1e9) | 0 : Number(seed);
      this.rng = new Rng(this.seed);
      this.tick = 0;
      this.events = [];
      this.nextEvent = 8 + this.rng.range(6);
      this.markets = {};
      CITIES.forEach((c) => {
        this.markets[c.id] = {};
        GOODS.forEach((g) => {
          const bias = 0.7 + this.rng.random() * 0.8;
          const stock = 40 + this.rng.range(40);
          const demand = stock * bias;
          const price = targetPrice(g.base, demand, stock, g.elast);
          this.markets[c.id][g.id] = {
            stock, demand, baseStock: stock, baseDemand: demand,
            price, prev: price,
          };
        });
      });
      this.player = {
        cash: START_CASH, loan: 0, hull: START_HULL, crew: 4, morale: 72,
        location: "veridian", travel: null, cargoLevel: 0, speedLevel: 0,
        inventory: {}, visited: ["veridian"], log: [], achievements: [],
        contracts: [], crossings: 0, contractsDone: 0, trades: 0, profit: 0,
        pending: null,
      };
    }

    cargoMax() { return CARGO[this.player.cargoLevel]; }
    cargoUsed() {
      return Object.values(this.player.inventory).reduce((a, h) => a + h.qty, 0);
    }
    neighbors(id) {
      return ROUTES_RAW
        .filter(([a, b]) => a === id || b === id)
        .map(([a, b, d]) => ({ id: a === id ? b : a, dist: d }));
    }
    netWorth() {
      let v = this.player.cash - this.player.loan;
      Object.entries(this.player.inventory).forEach(([gid, h]) => {
        const avg = CITIES.reduce((s, c) => s + this.markets[c.id][gid].price, 0) / CITIES.length;
        v += h.qty * avg;
      });
      return v;
    }
    log(kind, msg) {
      this.player.log.push({ kind, msg, day: this.tick });
      if (this.player.log.length > 80) this.player.log = this.player.log.slice(-80);
    }
    unlock(id) {
      if (this.player.achievements.includes(id)) return;
      this.player.achievements.push(id);
      this.log("achievement", `Unlocked: ${id.replace(/_/g, " ")}`);
    }

    price(city, gid) { return this.markets[city][gid].price; }

    buy(gid, qty) {
      qty = Math.max(1, qty | 0);
      if (this.player.travel) throw new Error("Underway — you cannot trade at sea.");
      const m = this.markets[this.player.location][gid];
      const price = m.price;
      const cost = price * qty;
      if (cost > this.player.cash) throw new Error("Not enough coin.");
      if (this.cargoUsed() + qty > this.cargoMax()) throw new Error("Hold is full.");
      this.player.cash -= cost;
      const hold = this.player.inventory[gid] || { qty: 0, cost: 0 };
      const total = hold.qty + qty;
      hold.cost = (hold.cost * hold.qty + price * qty) / total;
      hold.qty = total;
      this.player.inventory[gid] = hold;
      m.stock = Math.max(2, m.stock - qty);
      this.player.trades += 1;
      this.unlock("first_trade");
      this.log("buy", `Bought ${qty} ${GOODS_MAP[gid].name} @ ${price.toFixed(0)}`);
    }

    sell(gid, qty) {
      qty = Math.max(1, qty | 0);
      if (this.player.travel) throw new Error("Underway — you cannot trade at sea.");
      const hold = this.player.inventory[gid];
      if (!hold || hold.qty < qty) throw new Error("You do not hold that cargo.");
      const m = this.markets[this.player.location][gid];
      const revenue = m.price * qty;
      const profit = revenue - hold.cost * qty;
      hold.qty -= qty;
      if (hold.qty <= 0) delete this.player.inventory[gid];
      this.player.cash += revenue;
      this.player.profit += profit;
      this.player.trades += 1;
      m.stock += qty * 0.7;
      this.log("sell", `Sold ${qty} ${GOODS_MAP[gid].name} @ ${m.price.toFixed(0)} (${profit >= 0 ? "+" : ""}${profit.toFixed(0)})`);
      this._completeContracts();
    }

    travel(to) {
      if (this.player.travel) throw new Error("Already underway.");
      if (this.player.hull <= 0) throw new Error("The ship is a wreck.");
      const dist = ROUTES[`${this.player.location}:${to}`];
      if (!dist) throw new Error("No charted lane to that port.");
      const days = Math.max(1, Math.round(dist * SPEED[this.player.speedLevel]));
      this.player.travel = {
        from: this.player.location,
        to,
        start: this.tick,
        eta: this.tick + days,
        days,
      };
      this.log("travel", `Cast off for ${CITY[to].name} (${days} days).`);
    }

    repair(hp = 15) {
      const missing = START_HULL - this.player.hull;
      hp = Math.min(hp, missing);
      if (hp <= 0) throw new Error("Hull is sound.");
      const cost = hp * 18;
      if (this.player.cash < cost) throw new Error("Cannot afford the yard.");
      this.player.cash -= cost;
      this.player.hull += hp;
      this.log("yard", `Carpenters patch ${hp} hull for $${cost}.`);
    }

    hire() {
      if (this.player.crew >= 12) throw new Error("No bunks left.");
      if (this.player.cash < 120) throw new Error("Cannot afford a hire.");
      this.player.cash -= 120;
      this.player.crew += 1;
      this.player.morale = Math.min(100, this.player.morale + 4);
      this.log("tavern", "A new hand signs the articles.");
    }

    upgradeCargo() {
      const nxt = this.player.cargoLevel + 1;
      if (nxt >= CARGO.length) throw new Error("Hold is already cavernous.");
      const cost = CARGO_COST[nxt];
      if (this.player.cash < cost) throw new Error("Too rich a refit.");
      this.player.cash -= cost;
      this.player.cargoLevel = nxt;
      this.log("yard", `Hold expanded to ${CARGO[nxt]} crates.`);
    }

    upgradeSpeed() {
      const nxt = this.player.speedLevel + 1;
      if (nxt >= SPEED.length) throw new Error("She already flies.");
      const cost = SPEED_COST[nxt];
      if (this.player.cash < cost) throw new Error("Too rich a refit.");
      this.player.cash -= cost;
      this.player.speedLevel = nxt;
      this.log("yard", "New canvas. The ship is quicker.");
    }

    takeContract() {
      if (this.player.travel) throw new Error("Not while underway.");
      if (this.player.contracts.length >= 2) throw new Error("Two bonds is enough.");
      const n = this.neighbors(this.player.location);
      if (!n.length) throw new Error("No bond posted.");
      const dest = this.rng.pick(n);
      const g = this.rng.pick(GOODS);
      const qty = 2 + this.rng.range(4);
      const buy = this.price(this.player.location, g.id);
      const reward = Math.round(qty * buy * 0.22 + dest.dist * 18);
      const job = {
        id: `c${this.tick}${this.rng.range(90)}`,
        good: g.id, qty, dest: dest.id,
        destName: CITY[dest.id].name,
        reward, expires: this.tick + 12 + dest.dist * 2,
      };
      this.player.contracts.push(job);
      this.log("contract", `Bond: ${qty} ${g.name} to ${job.destName} for $${reward}.`);
      return job;
    }

    _completeContracts() {
      const p = this.player;
      p.contracts = p.contracts.filter((job) => {
        if (this.tick > job.expires) {
          this.log("contract", "A bond expired.");
          return false;
        }
        const hold = p.inventory[job.good];
        if (p.location === job.dest && hold && hold.qty >= job.qty) {
          hold.qty -= job.qty;
          if (hold.qty <= 0) delete p.inventory[job.good];
          p.cash += job.reward;
          p.contractsDone += 1;
          this.unlock("contractor");
          this.log("contract", `Delivered to ${job.destName} (+$${job.reward}).`);
          return false;
        }
        return true;
      });
    }

    _rollEncounter() {
      const r = this.rng.random();
      if (r < 0.55) return null;
      if (r < 0.74) {
        const dmg = 6 + this.rng.range(11);
        return {
          id: "storm", title: "Squall line",
          text: "The sky shears open. Green water comes over the rail.",
          dmg,
          choices: [
            { id: "reef", label: "Reef sail", hint: `Hull −${dmg}` },
            { id: "push", label: "Drive her", hint: "Faster, worse beating" },
          ],
        };
      }
      if (r < 0.9) {
        const tribute = 80 + this.rng.range(140);
        return {
          id: "pirates", title: "Black sails",
          text: "A corsair hauls up on your quarter and fires a warning gun.",
          tribute,
          choices: [
            { id: "pay", label: `Pay $${tribute}`, hint: "Coin for the hull" },
            { id: "fight", label: "Board them", hint: `Crew ${this.player.crew}` },
            { id: "flee", label: "Run", hint: "Shot across the stern" },
          ],
        };
      }
      return {
        id: "merchant", title: "Friendly barque",
        text: "Another captain offers to take a crate at a sweet premium.",
        choices: [
          { id: "trade", label: "Sell a crate", hint: "+12% on one good" },
          { id: "wave", label: "Dip flags", hint: "Sail on" },
        ],
      };
    }

    resolveEncounter(choice) {
      const enc = this.player.pending;
      if (!enc) return;
      const p = this.player;
      if (enc.id === "storm") {
        let dmg = enc.dmg || 8;
        if (choice === "push") dmg = Math.round(dmg * 1.6);
        p.hull = Math.max(0, p.hull - dmg);
        this.unlock("storm_sailor");
        this.log("sea", `The squall takes ${dmg} hull.`);
      } else if (enc.id === "pirates") {
        if (choice === "pay") {
          const pay = Math.min(p.cash, enc.tribute || 100);
          p.cash -= pay;
          p.morale = Math.max(0, p.morale - 6);
          this.log("sea", `Tribute paid ($${pay.toFixed(0)}).`);
        } else if (choice === "fight") {
          const chance = Math.min(0.82, 0.28 + p.crew * 0.09);
          if (this.rng.random() < chance) {
            const prize = 60 + this.rng.range(120);
            p.cash += prize;
            p.morale = Math.min(100, p.morale + 8);
            this.unlock("privateer");
            this.log("sea", `You beat the corsair off. Salvage $${prize}.`);
          } else {
            p.hull = Math.max(0, p.hull - (10 + this.rng.range(12)));
            p.morale = Math.max(0, p.morale - 10);
            this.log("sea", "They board, loot, and vanish.");
            this._loseCrate();
          }
        } else {
          p.hull = Math.max(0, p.hull - (8 + this.rng.range(8)));
          this.log("sea", "You run. Shot splinters the taffrail.");
          if (this.rng.random() < 0.35) this._loseCrate();
        }
      } else if (enc.id === "merchant" && choice === "trade") {
        const ids = Object.keys(p.inventory);
        if (ids.length) {
          const gid = this.rng.pick(ids);
          const unit = p.inventory[gid].cost || 20;
          p.cash += unit * 1.12;
          this._loseCrate(gid);
          this.log("sea", `Sold a crate of ${GOODS_MAP[gid].name} over the rail.`);
        }
      } else {
        this.log("sea", "You keep your heading.");
      }
      p.pending = null;
    }

    _loseCrate(gid) {
      const ids = gid ? [gid] : Object.keys(this.player.inventory);
      if (!ids.length) return;
      const id = gid || this.rng.pick(ids);
      const hold = this.player.inventory[id];
      if (!hold) return;
      hold.qty -= 1;
      if (hold.qty <= 0) delete this.player.inventory[id];
    }

    step() {
      this.tick += 1;
      const p = this.player;
      CITIES.forEach((c) => {
        GOODS.forEach((g) => {
          const m = this.markets[c.id][g.id];
          m.stock += (m.baseStock - m.stock) * 0.1;
          m.stock *= 1 + (this.rng.random() - 0.5) * 0.04;
          m.stock = Math.max(2, m.stock);
          m.demand += (m.baseDemand - m.demand) * 0.14;
          m.demand *= 1 + (this.rng.random() - 0.5) * 0.05;
          m.demand = Math.max(2, m.demand);
          const target = targetPrice(g.base, m.demand, m.stock, g.elast);
          const noise = 1 + (this.rng.random() - 0.5) * g.vol * 0.15;
          m.prev = m.price;
          m.price += (target * noise - m.price) * 0.28;
          m.price = Math.max(g.base * 0.12, m.price);
        });
      });
      this.events = this.events.filter((e) => e.until > this.tick);
      if (this.tick >= this.nextEvent) {
        const city = this.rng.pick(CITIES);
        const boom = this.rng.random() > 0.45;
        this.events.push({
          title: boom ? "Harbor festival" : "Port crisis",
          kind: boom ? "boom" : "crisis",
          city: city.id,
          text: boom
            ? `${city.name} throws lanterns into the night — luxury demand spikes.`
            : `Trouble in ${city.name}. Staples run short.`,
          until: this.tick + 10 + this.rng.range(10),
        });
        this.nextEvent = this.tick + 9 + this.rng.range(8);
      }
      this.events.forEach((ev) => {
        const gids = ev.kind === "boom" ? ["lux", "silk", "spice"] : ["food", "water", "fuel"];
        gids.forEach((gid) => {
          if (!this.markets[ev.city][gid]) return;
          this.markets[ev.city][gid].demand *= ev.kind === "boom" ? 1.04 : 1.03;
          this.markets[ev.city][gid].stock *= ev.kind === "boom" ? 1.0 : 0.97;
        });
      });
      if (p.travel && this.tick >= p.travel.eta) {
        p.location = p.travel.to;
        p.travel = null;
        p.crossings += 1;
        if (!p.visited.includes(p.location)) p.visited.push(p.location);
        this.log("travel", `Made ${CITY[p.location].name}.`);
        const enc = this._rollEncounter();
        if (enc) p.pending = enc;
        this._completeContracts();
      }
      if (p.visited.length >= 5) this.unlock("globe_trotter");
      if (this.netWorth() >= 100000) this.unlock("millionaire");
      if (this.netWorth() >= GOAL) this.unlock("tycoon");
      p.morale = Math.max(0, Math.min(100, p.morale + (p.crew >= 4 ? 0.3 : -0.5)));
    }

    won() { return this.netWorth() >= GOAL; }
    lost() { return this.player.hull <= 0 || (this.player.cash < 30 && this.cargoUsed() === 0 && this.player.hull < 25); }

    snapshot() {
      return JSON.stringify({ seed: this.seed, tick: this.tick, player: this.player, events: this.events, markets: this.markets, nextEvent: this.nextEvent, v: VERSION });
    }
    static load(raw) {
      const data = JSON.parse(raw);
      const w = new World(data.seed);
      w.tick = data.tick;
      w.player = data.player;
      w.events = data.events || [];
      w.markets = data.markets;
      w.nextEvent = data.nextEvent;
      return w;
    }
    persist() { localStorage.setItem(SAVE_KEY, this.snapshot()); }
    static restore() {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? World.load(raw) : null;
    }
  }

  global.Mercantile = {
    VERSION, GOAL, GOODS, GOODS_MAP, CITIES, CITY, ROUTES, ROUTES_RAW,
    CARGO, SPEED, SAVE_KEY, World,
  };
})(window);
