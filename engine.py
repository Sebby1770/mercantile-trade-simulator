"""Mercantile — Core game engine (runs server-side, authoritative)"""
from __future__ import annotations
import csv
import io
import math
import random
from dataclasses import dataclass, field
from typing import Optional

VERSION = "2.0.0"
TICK_INTERVAL = 1.5
HISTORY_LEN = 100
GOAL = 500_000
START_CASH = 2_000
BASE_CARGO = 20
MILLIONAIRE_THRESHOLD = 100_000
GLOBE_TROTTER_CITIES = 5
START_HULL = 100
START_CREW = 4
START_MORALE = 72
REPAIR_COST_PER_HP = 18
HIRE_COST = 120

# ─── GOODS ──────────────────────────────────────────────────────────────────

GOODS_DEFS = [
    dict(id='food',   name='Food',        base=18,   vol=0.18, elast=0.55, cat='raw'),
    dict(id='water',  name='Water',       base=9,    vol=0.12, elast=0.50, cat='raw'),
    dict(id='coal',   name='Coal',        base=25,   vol=0.16, elast=0.55, cat='raw'),
    dict(id='fuel',   name='Fuel',        base=55,   vol=0.22, elast=0.65, cat='raw'),
    dict(id='ore',    name='Ore',         base=32,   vol=0.20, elast=0.60, cat='raw'),
    dict(id='timber', name='Timber',      base=28,   vol=0.17, elast=0.58, cat='raw'),
    dict(id='wool',   name='Wool',        base=42,   vol=0.18, elast=0.58, cat='raw'),
    dict(id='herbs',  name='Herbs',       base=38,   vol=0.22, elast=0.60, cat='raw'),
    dict(id='mach',   name='Machinery',   base=175,  vol=0.15, elast=0.55, cat='processed'),
    dict(id='text',   name='Textiles',    base=85,   vol=0.18, elast=0.60, cat='processed'),
    dict(id='meds',   name='Medicine',    base=230,  vol=0.24, elast=0.65, cat='processed'),
    dict(id='elec',   name='Electronics', base=310,  vol=0.28, elast=0.70, cat='processed'),
    dict(id='spice',  name='Spices',      base=85,   vol=0.32, elast=0.75, cat='luxury'),
    dict(id='arms',   name='Weapons',     base=440,  vol=0.22, elast=0.65, cat='luxury'),
    dict(id='silk',   name='Silk',        base=320,  vol=0.26, elast=0.72, cat='luxury'),
    dict(id='lux',    name='Luxuries',    base=580,  vol=0.30, elast=0.80, cat='luxury'),
    dict(id='art',    name='Artifacts',   base=920,  vol=0.35, elast=0.85, cat='luxury'),
]
GOODS = {g['id']: g for g in GOODS_DEFS}

# ─── CITIES ─────────────────────────────────────────────────────────────────

CITIES_DEFS = [
    dict(id='veridian',  name='Veridian Port',  tag='Coastal · Agricultural',  x=120, y=85,  color='#4ade80',
         bias=dict(food=2.4,water=2.0,spice=1.4,fuel=0.7,mach=0.6,elec=0.5,arms=0.7,lux=0.6,meds=0.8,ore=0.7,coal=0.6,timber=1.5,wool=1.2,herbs=1.3,silk=0.8,text=1.0,art=0.6)),
    dict(id='ironhold',  name='Ironhold',        tag='Mining Hub',              x=265, y=200, color='#fbbf24',
         bias=dict(ore=2.8,mach=1.4,fuel=0.9,food=0.6,water=0.7,elec=0.7,meds=0.7,spice=0.5,arms=1.2,lux=0.5,coal=2.3,timber=0.8,wool=0.6,herbs=0.5,silk=0.5,text=0.7,art=0.7)),
    dict(id='neonbay',   name='Neon Bay',         tag='Tech Capital',           x=445, y=65,  color='#60a5fa',
         bias=dict(elec=2.6,mach=1.6,lux=1.3,food=0.8,water=0.9,ore=0.5,fuel=0.8,spice=1.0,meds=1.0,arms=0.6,coal=0.5,timber=0.6,wool=0.7,herbs=0.8,silk=1.2,text=1.0,art=1.3)),
    dict(id='solis',     name='Solis Reach',      tag='Desert Refinery',        x=165, y=315, color='#f97316',
         bias=dict(fuel=2.8,ore=1.3,spice=1.6,water=0.35,food=0.45,mach=0.7,elec=0.6,lux=0.7,meds=0.6,arms=0.9,coal=1.7,timber=0.4,wool=0.5,herbs=0.4,silk=0.7,text=0.6,art=0.5)),
    dict(id='stormgate', name='Stormgate',        tag='Frontier Fortress',      x=605, y=285, color='#f87171',
         bias=dict(arms=2.6,mach=1.2,fuel=1.1,meds=0.5,food=0.7,water=0.7,elec=0.7,lux=0.4,spice=0.7,ore=1.0,coal=1.1,timber=1.3,wool=0.8,herbs=0.6,silk=0.4,text=0.8,art=0.6)),
    dict(id='aurelia',   name='Aurelia',          tag='Imperial Capital',       x=685, y=85,  color='#c084fc',
         bias=dict(lux=2.6,meds=1.7,spice=1.6,elec=1.3,food=0.7,water=0.8,ore=0.5,fuel=0.7,mach=0.8,arms=0.6,coal=0.5,timber=0.6,wool=0.9,herbs=1.2,silk=2.3,text=1.4,art=2.9)),
    dict(id='khalMesa',  name='Khal Mesa',        tag='Highland Trade Hub',     x=380, y=235, color='#34d399',
         bias=dict(wool=1.9,herbs=1.7,text=1.6,spice=1.4,food=1.1,water=1.1,ore=0.9,coal=0.8,fuel=0.9,mach=0.9,elec=0.8,arms=0.9,lux=0.9,meds=1.3,silk=1.1,art=1.1,timber=1.2)),
    dict(id='theDrift',  name='The Drift',        tag='Wasteland Smugglers',    x=325, y=365, color='#fb7185',
         bias=dict(arms=1.9,fuel=1.4,coal=1.2,art=1.7,silk=1.3,spice=1.5,water=0.45,food=0.55,meds=0.5,ore=0.9,mach=0.8,elec=0.9,lux=1.2,timber=0.8,wool=0.7,herbs=0.8,text=0.8)),
]
CITIES = {c['id']: c for c in CITIES_DEFS}

ROUTES_RAW = [
    ('veridian','ironhold',4), ('veridian','neonbay',3), ('veridian','solis',6),
    ('ironhold','solis',4), ('ironhold','khalMesa',3), ('ironhold','stormgate',5),
    ('neonbay','aurelia',3), ('neonbay','khalMesa',4),
    ('khalMesa','stormgate',4), ('khalMesa','theDrift',3),
    ('solis','theDrift',3),
    ('stormgate','aurelia',4), ('stormgate','theDrift',5),
]
ROUTES: dict[str, int] = {}
for _a, _b, _d in ROUTES_RAW:
    ROUTES[f'{_a}:{_b}'] = _d
    ROUTES[f'{_b}:{_a}'] = _d

# ─── BUILDINGS ──────────────────────────────────────────────────────────────

BUILDINGS = {
    'trading_post': dict(name='Trading Post',  cost=5_000,  desc='+5% sell, -5% buy. $30/tick passive income.'),
    'warehouse':    dict(name='Warehouse',     cost=3_000,  desc='+10 cargo while docked here.'),
    'intel_office': dict(name='Intel Office',  cost=8_000,  desc='Early event warnings. Shows buy/sell signals.'),
    'smelter':      dict(name='Smelter',       cost=15_000, desc='Auto-converts Ore → Machinery every 3 ticks.'),
    'plantation':   dict(name='Plantation',    cost=10_000, desc='Produces 2 Food/tick, sells automatically.'),
}

CARGO_LEVELS = [20, 40, 80, 150]
CARGO_UPGRADE_COSTS = [0, 8_000, 20_000, 50_000]
SPEED_LEVELS = [1.0, 0.75, 0.55]
SPEED_UPGRADE_COSTS = [0, 12_000, 35_000]

# ─── ACHIEVEMENTS ───────────────────────────────────────────────────────────

ACHIEVEMENTS = {
    'first_trade': dict(
        id='first_trade',
        name='First Trade',
        desc='Complete your first buy or sell.',
    ),
    'millionaire': dict(
        id='millionaire',
        name='Millionaire',
        desc=f'Reach a net worth of ${MILLIONAIRE_THRESHOLD:,}.',
    ),
    'globe_trotter': dict(
        id='globe_trotter',
        name='Globe Trotter',
        desc=f'Visit {GLOBE_TROTTER_CITIES} different cities.',
    ),
    'event_survivor': dict(
        id='event_survivor',
        name='Event Survivor',
        desc='Remain active during a market crisis.',
    ),
    'storm_sailor': dict(
        id='storm_sailor',
        name='Storm Sailor',
        desc='Survive a storm at sea.',
    ),
    'privateer': dict(
        id='privateer',
        name='Privateer',
        desc='Fight off a pirate boarding.',
    ),
    'contractor': dict(
        id='contractor',
        name='Bonded Merchant',
        desc='Complete a delivery contract.',
    ),
    'tycoon': dict(
        id='tycoon',
        name='Harbor Tycoon',
        desc=f'Reach the campaign goal of ${GOAL:,}.',
    ),
}

# ─── EVENTS ─────────────────────────────────────────────────────────────────

EVENT_POOL = [
    dict(id='drought',   title='Drought',              kind='crisis', target='city',   goods=['food','water'],         s=0.40, d=1.35, dur=(18,30), desc=lambda t: f'Crops fail across {t}.'),
    dict(id='plague',    title='Plague Outbreak',      kind='crisis', target='city',   goods=['meds','herbs'],         s=0.55, d=2.60, dur=(14,24), desc=lambda t: f'Disease spreads through {t}.'),
    dict(id='war',       title='War Declaration',      kind='crisis', target='city',   goods=['arms','fuel','meds'],   s=0.65, d=2.30, dur=(22,38), desc=lambda t: f'{t} mobilizes for war.'),
    dict(id='strike',    title='Mining Strike',        kind='crisis', target='city',   goods=['ore','coal'],           s=0.28, d=1.00, dur=(12,22), desc=lambda t: f'Miners walk out in {t}.'),
    dict(id='embargo',   title='Fuel Embargo',         kind='crisis', target='global', goods=['fuel','coal'],          s=0.50, d=1.50, dur=(20,34), desc=lambda _: 'Global fuel sanctions imposed.'),
    dict(id='pirates',   title='Pirate Raids',         kind='crisis', target='city',   goods=['silk','spice','art'],   s=0.55, d=1.00, dur=(14,24), desc=lambda t: f'Pirates intercept {t} trade lanes.'),
    dict(id='famine',    title='Famine',               kind='crisis', target='city',   goods=['food','water','meds'],  s=0.75, d=2.10, dur=(16,28), desc=lambda t: f'Starvation grips {t}.'),
    dict(id='coldsnap',  title='Cold Snap',            kind='crisis', target='city',   goods=['fuel','coal','timber'], s=0.60, d=1.90, dur=(16,26), desc=lambda t: f'Freezing temperatures hit {t}.'),
    dict(id='epidemic',  title='Livestock Epidemic',   kind='crisis', target='city',   goods=['wool','food'],          s=0.45, d=1.40, dur=(14,24), desc=lambda t: f'Disease kills livestock in {t}.'),
    dict(id='techboom',  title='Tech Boom',            kind='boom',   target='city',   goods=['elec','mach'],          s=1.00, d=2.50, dur=(16,28), desc=lambda t: f'{t} announces a technological breakthrough.'),
    dict(id='festival',  title='Imperial Festival',    kind='boom',   target='city',   goods=['lux','spice','silk'],   s=1.00, d=2.00, dur=(14,22), desc=lambda t: f'Grand celebrations erupt in {t}.'),
    dict(id='oreFInd',   title='Ore Discovery',        kind='boom',   target='city',   goods=['ore','coal'],           s=2.50, d=1.00, dur=(18,30), desc=lambda t: f'Massive deposit found near {t}.'),
    dict(id='harvest',   title='Bumper Harvest',       kind='boom',   target='city',   goods=['food','water','wool'],  s=2.10, d=1.00, dur=(18,28), desc=lambda t: f'Record yields reported from {t}.'),
    dict(id='peace',     title='Peace Accord',         kind='boom',   target='global', goods=['arms'],                 s=1.20, d=0.38, dur=(18,30), desc=lambda _: 'Regional peace lowers military demand.'),
    dict(id='silkroad',  title='Silk Road Opens',      kind='boom',   target='global', goods=['silk','spice','art'],   s=1.50, d=1.80, dur=(24,36), desc=lambda _: 'Ancient trade routes reopen.'),
]

RIVAL_DEFS = [
    dict(name='Black Crow Co.',    strategy='aggressive',   start=1200),
    dict(name='Sable & Rook',      strategy='conservative', start=1000),
    dict(name='Iron Sun Trading',  strategy='opportunist',  start=1100),
    dict(name='House Aldric',      strategy='luxury',       start=900),
]

# ─── PURE HELPERS (testable) ─────────────────────────────────────────────────


def compute_target_price(base: float, demand: float, stock: float, elast: float) -> float:
    """Equilibrium target price: base * (demand / stock) ** elast."""
    safe_stock = max(stock, 1e-9)
    safe_demand = max(demand, 1e-9)
    return base * math.pow(safe_demand / safe_stock, elast)


def route_key(a: str, b: str) -> str:
    return f'{a}:{b}'


def route_exists(a: str, b: str, routes: dict[str, int] | None = None) -> bool:
    table = routes if routes is not None else ROUTES
    return route_key(a, b) in table


def format_log_markdown(log: list[dict], n: int | None = None) -> str:
    """Render the last N captain's log entries as Markdown."""
    entries = log[-n:] if n is not None else log
    lines = ['# Trade Journal', '']
    if not entries:
        lines.append('_No entries yet._')
        return '\n'.join(lines)
    lines.append('| Day | Kind | Message |')
    lines.append('| --- | ---- | ------- |')
    for e in entries:
        msg = str(e.get('msg', '')).replace('|', '\\|')
        lines.append(f"| {e.get('day', '')} | {e.get('kind', '')} | {msg} |")
    return '\n'.join(lines) + '\n'


def roll_encounter(rng: random.Random, hull: float, crew: int) -> Optional[dict]:
    """Maybe return a sea encounter while traveling. None = calm crossing."""
    roll = rng.random()
    if roll < 0.55:
        return None
    if roll < 0.72:
        dmg = 6 + rng.randint(0, 10)
        return {
            'id': 'storm',
            'title': 'Squall line',
            'text': 'Black water stacks against the bow. The masts scream.',
            'choices': [
                {'id': 'reef', 'label': 'Reef sail', 'hint': f'Hull -{dmg}'},
                {'id': 'push', 'label': 'Push through', 'hint': 'Faster, risk more hull'},
            ],
            'dmg': dmg,
        }
    if roll < 0.88:
        tribute = 80 + rng.randint(0, 140)
        return {
            'id': 'pirates',
            'title': 'Black sails',
            'text': 'A low corsair cuts across your wake and demands tribute.',
            'choices': [
                {'id': 'pay', 'label': f'Pay ${tribute}', 'hint': 'Lose coin, keep hull'},
                {'id': 'fight', 'label': 'Fight', 'hint': f'Crew {crew} decide it'},
                {'id': 'flee', 'label': 'Flee', 'hint': 'Hull damage, maybe lose cargo'},
            ],
            'tribute': tribute,
        }
    return {
        'id': 'merchant',
        'title': 'Friendly barque',
        'text': 'Another captain signals: they will buy a little cargo at a fair premium.',
        'choices': [
            {'id': 'trade', 'label': 'Sell a crate', 'hint': '+12% on one good'},
            {'id': 'wave', 'label': 'Wave and pass', 'hint': 'No change'},
        ],
    }


def resolve_encounter(
    encounter: dict,
    choice: str,
    *,
    cash: float,
    hull: float,
    crew: int,
    inventory: dict,
    rng: random.Random,
) -> dict:
    """Apply an encounter choice. Returns deltas + log line (no player mutation)."""
    kind = encounter.get('id')
    choice = (choice or '').strip() or (
        encounter.get('choices') or [{'id': 'wave'}]
    )[0]['id']
    hull_d = 0.0
    cash_d = 0.0
    morale_d = 0.0
    lost_good = None
    log = 'The sea is quiet.'
    flags: list[str] = []

    if kind == 'storm':
        dmg = float(encounter.get('dmg') or 8)
        if choice == 'push':
            dmg = round(dmg * 1.6)
            hull_d = -dmg
            morale_d = -4
            log = f'You drive into the squall. Hull -{int(dmg)}.'
        else:
            hull_d = -dmg
            log = f'Canvas comes down. The squall hammers the hull (-{int(dmg)}).'
        flags.append('storm_sailor')
    elif kind == 'pirates':
        tribute = float(encounter.get('tribute') or 100)
        if choice == 'pay':
            cash_d = -min(cash, tribute)
            log = f'You pay {abs(cash_d):.0f} in tribute and they veer off.'
            morale_d = -6
        elif choice == 'fight':
            chance = min(0.82, 0.28 + crew * 0.09)
            if rng.random() < chance:
                prize = 60 + rng.randint(0, 120)
                cash_d = prize
                morale_d = 8
                log = f'Steel and smoke. The corsair shears away. Salvage ${prize}.'
                flags.append('privateer')
            else:
                hull_d = -(10 + rng.randint(0, 12))
                morale_d = -10
                log = 'They board, loot a little, and vanish into fog.'
                if inventory:
                    lost_good = rng.choice(list(inventory.keys()))
        else:
            hull_d = -(8 + rng.randint(0, 8))
            log = 'You dump wind and run. Shot grazes the stern.'
            if inventory and rng.random() < 0.35:
                lost_good = rng.choice(list(inventory.keys()))
    elif kind == 'merchant' and choice == 'trade' and inventory:
        gid = rng.choice(list(inventory.keys()))
        unit = float(inventory[gid].get('cost') or 20)
        cash_d = round(unit * 1.12, 2)
        lost_good = gid
        log = 'You sell a single crate over the rail at a friendly premium.'
    elif kind == 'merchant':
        log = 'You dip flags and keep your heading.'

    return {
        'hull': hull_d,
        'cash': cash_d,
        'morale': morale_d,
        'lost_good': lost_good,
        'log': log,
        'flags': flags,
    }


def format_log_csv(log: list[dict], n: int | None = None) -> str:
    """Render the last N captain's log entries as CSV."""
    entries = log[-n:] if n is not None else log
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=['day', 'kind', 'msg'], extrasaction='ignore')
    writer.writeheader()
    for e in entries:
        writer.writerow({'day': e.get('day', ''), 'kind': e.get('kind', ''), 'msg': e.get('msg', '')})
    return buf.getvalue()


# ─── DATA CLASSES ────────────────────────────────────────────────────────────

@dataclass
class MarketState:
    stock: float
    baseline_stock: float
    demand: float
    baseline_demand: float
    price: float
    prev_price: float = 0.0


@dataclass
class TravelInfo:
    frm: str
    to: str
    eta_tick: int


@dataclass
class Rival:
    id: str
    name: str
    strategy: str
    cash: float
    inventory: dict = field(default_factory=dict)
    location: str = 'veridian'
    travel: Optional[TravelInfo] = None
    last_action: str = 'scouting markets'
    cargo_max: int = 22


@dataclass
class EventRecord:
    inst_id: str
    tmpl_id: str
    title: str
    kind: str
    desc: str
    target_type: str
    target: Optional[str]
    target_name: str
    goods: list
    s_mul: float
    d_mul: float
    expires: int


@dataclass
class PlayerState:
    pid: str
    cash: float = START_CASH
    inventory: dict = field(default_factory=dict)
    location: str = 'veridian'
    travel: Optional[TravelInfo] = None
    cargo_level: int = 0
    speed_level: int = 0
    loan: float = 0.0
    loan_rate: float = 0.003
    buildings: dict = field(default_factory=dict)
    reputation: dict = field(default_factory=dict)
    log: list = field(default_factory=list)
    total_profit: float = 0.0
    total_trades: int = 0
    achievements: list = field(default_factory=list)
    visited_cities: list = field(default_factory=list)
    crisis_ticks: int = 0
    hull: float = START_HULL
    crew: int = START_CREW
    morale: float = START_MORALE
    contracts: list = field(default_factory=list)
    pending_encounter: Optional[dict] = None
    crossings: int = 0
    contracts_done: int = 0

    def __post_init__(self):
        if not self.visited_cities:
            self.visited_cities = [self.location]

    def cargo_max(self) -> int:
        base = CARGO_LEVELS[self.cargo_level]
        for city, blist in self.buildings.items():
            if 'warehouse' in blist and city == self.location:
                base += 10
        return base

    def travel_speed(self) -> float:
        return SPEED_LEVELS[self.speed_level]

    def cargo_used(self) -> int:
        return sum(h['qty'] for h in self.inventory.values())

    def buy_modifier(self, city: str) -> float:
        return 0.95 if 'trading_post' in self.buildings.get(city, []) else 1.0

    def sell_modifier(self, city: str) -> float:
        return 1.05 if 'trading_post' in self.buildings.get(city, []) else 1.0

    def net_worth(self, markets: dict) -> float:
        v = self.cash - self.loan
        for gid, h in self.inventory.items():
            prices = [markets[cid][gid].price for cid in markets]
            v += h['qty'] * (sum(prices) / len(prices))
        return v

    def add_log(self, kind: str, msg: str, day: int):
        self.log.append({'kind': kind, 'msg': msg, 'day': day})
        if len(self.log) > 80:
            self.log = self.log[-80:]

    def mark_visited(self, city_id: str):
        if city_id not in self.visited_cities:
            self.visited_cities.append(city_id)

    def unlock_achievement(self, aid: str, day: int = 0) -> bool:
        if aid not in ACHIEVEMENTS or aid in self.achievements:
            return False
        self.achievements.append(aid)
        meta = ACHIEVEMENTS[aid]
        self.add_log('achievement', f'Achievement unlocked: {meta["name"]} — {meta["desc"]}', day)
        return True

    def check_achievements(self, markets: dict, day: int = 0, crisis_active: bool = False) -> list[str]:
        """Evaluate achievement conditions; return newly unlocked ids."""
        newly: list[str] = []
        if crisis_active:
            self.crisis_ticks += 1

        if self.total_trades >= 1 and self.unlock_achievement('first_trade', day):
            newly.append('first_trade')
        if self.net_worth(markets) >= MILLIONAIRE_THRESHOLD and self.unlock_achievement('millionaire', day):
            newly.append('millionaire')
        if len(self.visited_cities) >= GLOBE_TROTTER_CITIES and self.unlock_achievement('globe_trotter', day):
            newly.append('globe_trotter')
        if self.crisis_ticks >= 1 and self.unlock_achievement('event_survivor', day):
            newly.append('event_survivor')
        if self.net_worth(markets) >= GOAL and self.unlock_achievement('tycoon', day):
            newly.append('tycoon')
        return newly

    def apply_encounter_result(self, result: dict, day: int = 0) -> None:
        self.hull = max(0.0, min(100.0, self.hull + float(result.get('hull') or 0)))
        self.cash = max(0.0, self.cash + float(result.get('cash') or 0))
        self.morale = max(0.0, min(100.0, self.morale + float(result.get('morale') or 0)))
        lost = result.get('lost_good')
        if lost and lost in self.inventory:
            hold = self.inventory[lost]
            hold['qty'] -= 1
            if hold['qty'] <= 0:
                del self.inventory[lost]
        for flag in result.get('flags') or []:
            self.unlock_achievement(flag, day)
        if result.get('log'):
            self.add_log('sea', result['log'], day)
        self.pending_encounter = None

    def wrecked(self) -> bool:
        return self.hull <= 0

    def repair(self, hp: int = 20) -> float:
        hp = max(1, int(hp))
        missing = int(START_HULL - self.hull)
        hp = min(hp, missing)
        if hp <= 0:
            return 0.0
        cost = hp * REPAIR_COST_PER_HP
        if self.cash < cost:
            raise ValueError('not enough coin to repair')
        self.cash -= cost
        self.hull += hp
        return cost

    def hire_crew(self) -> None:
        if self.crew >= 12:
            raise ValueError('no bunks left')
        if self.cash < HIRE_COST:
            raise ValueError('cannot afford a hire')
        self.cash -= HIRE_COST
        self.crew += 1
        self.morale = min(100.0, self.morale + 4)

    def journal(self, fmt: str = 'markdown', n: int = 40) -> str:
        """Export the captain's log as markdown or csv."""
        if fmt == 'csv':
            return format_log_csv(self.log, n)
        return format_log_markdown(self.log, n)

    def reset_progress(self):
        """Restore a player to a fresh start (keeps pid)."""
        self.cash = START_CASH
        self.inventory = {}
        self.location = 'veridian'
        self.travel = None
        self.cargo_level = 0
        self.speed_level = 0
        self.loan = 0.0
        self.buildings = {}
        self.reputation = {cid: 0.0 for cid in CITIES}
        self.log = []
        self.total_profit = 0.0
        self.total_trades = 0
        self.achievements = []
        self.visited_cities = ['veridian']
        self.crisis_ticks = 0
        self.hull = START_HULL
        self.crew = START_CREW
        self.morale = START_MORALE
        self.contracts = []
        self.pending_encounter = None
        self.crossings = 0
        self.contracts_done = 0


# ─── GAME WORLD ─────────────────────────────────────────────────────────────

class GameWorld:
    """Shared authoritative economy — all players interact with the same market."""

    def __init__(self, seed: int | None = None):
        # Isolated RNG so tests can be deterministic; None uses system entropy.
        self.seed = seed
        self.rng = random.Random(seed) if seed is not None else random.Random()
        self.tick: int = 0
        self.markets: dict[str, dict[str, MarketState]] = {}
        self.history: dict[str, dict[str, list]] = {}
        self.events: list[EventRecord] = []
        self.rivals: list[Rival] = []
        self.next_event_tick: int = 8 + self.rng.randint(0, 5)
        self._init_markets()
        self._init_rivals()

    def _init_markets(self):
        for c in CITIES_DEFS:
            cid = c['id']
            self.markets[cid] = {}
            self.history[cid] = {}
            for g in GOODS_DEFS:
                gid = g['id']
                bias = c['bias'].get(gid, 1.0)
                bs = 65 * bias
                bd = 65 / bias
                self.markets[cid][gid] = MarketState(
                    stock=bs * (0.88 + self.rng.random() * 0.24),
                    baseline_stock=bs,
                    demand=bd * (0.88 + self.rng.random() * 0.24),
                    baseline_demand=bd,
                    price=g['base'] * (0.88 + self.rng.random() * 0.24),
                    prev_price=g['base'],
                )
                self.history[cid][gid] = []

    def _init_rivals(self):
        city_ids = list(CITIES.keys())
        for i, rd in enumerate(RIVAL_DEFS):
            self.rivals.append(Rival(
                id=f'rival_{i}',
                name=rd['name'],
                strategy=rd['strategy'],
                cash=rd['start'],
                location=city_ids[i % len(city_ids)],
            ))

    # ── Economy ──────────────────────────────────────────────────────────────

    def _event_mods(self, city_id: str, good_id: str) -> tuple[float, float]:
        sm, dm = 1.0, 1.0
        for ev in self.events:
            if good_id not in ev.goods:
                continue
            if ev.target_type == 'global' or ev.target == city_id:
                sm *= ev.s_mul
                dm *= ev.d_mul
        return sm, dm

    def _tick_market(self, city_id: str, good_id: str):
        m = self.markets[city_id][good_id]
        g = GOODS[good_id]
        sm, dm = self._event_mods(city_id, good_id)

        m.stock += (m.baseline_stock * sm - m.stock) * 0.10
        m.stock *= 1 + (self.rng.random() - 0.5) * 0.04
        m.stock = max(2.0, m.stock)

        m.demand += (m.baseline_demand * dm - m.demand) * 0.14
        m.demand *= 1 + (self.rng.random() - 0.5) * 0.05
        m.demand = max(2.0, m.demand)

        target_p = compute_target_price(g['base'], m.demand, m.stock, g['elast'])
        noise = 1 + (self.rng.random() - 0.5) * g['vol'] * 0.15
        m.prev_price = m.price
        m.price += (target_p * noise - m.price) * 0.28
        m.price = max(g['base'] * 0.12, m.price)

        hist = self.history[city_id][good_id]
        hist.append(round(m.price, 2))
        if len(hist) > HISTORY_LEN:
            hist.pop(0)

    def _maybe_spawn_event(self) -> Optional[EventRecord]:
        if self.tick < self.next_event_tick:
            return None
        tmpl = self.rng.choice(EVENT_POOL)
        if tmpl['target'] == 'city':
            c = self.rng.choice(CITIES_DEFS)
            target, tname = c['id'], c['name']
        else:
            target, tname = None, 'Global Markets'
        ev = EventRecord(
            inst_id=f"ev{self.tick}{self.rng.randint(100,999)}",
            tmpl_id=tmpl['id'],
            title=tmpl['title'],
            kind=tmpl['kind'],
            desc=tmpl['desc'](tname),
            target_type=tmpl['target'],
            target=target,
            target_name=tname,
            goods=list(tmpl['goods']),
            s_mul=tmpl['s'],
            d_mul=tmpl['d'],
            expires=self.tick + self.rng.randint(*tmpl['dur']),
        )
        self.events.append(ev)
        self.next_event_tick = self.tick + self.rng.randint(8, 14)
        return ev

    # ── AI Rivals ────────────────────────────────────────────────────────────

    def _rival_nw(self, r: Rival) -> float:
        v = r.cash
        for gid, h in r.inventory.items():
            prices = [self.markets[cid][gid].price for cid in self.markets]
            v += h['qty'] * (sum(prices) / len(prices))
        return v

    def _rival_cargo(self, r: Rival) -> int:
        return sum(h['qty'] for h in r.inventory.values())

    def _tick_rival(self, r: Rival):
        if r.travel:
            if self.tick >= r.travel.eta_tick:
                r.location = r.travel.to
                r.travel = None
                r.last_action = f'arrived at {CITIES[r.location]["name"]}'
            return

        strat = r.strategy
        focus = (['silk','lux','art','spice','elec','meds'] if strat == 'luxury'
                 else ['food','water','ore','coal','timber','wool','mach','text'] if strat == 'conservative'
                 else list(GOODS.keys()))

        did = False

        # Try sell
        for gid, h in list(r.inventory.items()):
            if h['qty'] <= 0:
                continue
            price = self.markets[r.location][gid].price
            threshold = 1.08 if strat == 'conservative' else 1.05
            if price > h['cost'] * threshold:
                qty = min(h['qty'], 5 if strat == 'aggressive' else 3)
                r.cash += qty * price
                m = self.markets[r.location][gid]
                m.stock += qty * 0.6
                m.demand = max(2.0, m.demand - qty * 0.4)
                h['qty'] -= qty
                if h['qty'] <= 0:
                    del r.inventory[gid]
                r.last_action = f'sold {qty} {GOODS[gid]["name"]} in {CITIES[r.location]["name"]}'
                did = True
                break

        # Try buy
        if not did and self._rival_cargo(r) < r.cargo_max:
            avg = {gid: sum(self.markets[cid][gid].price for cid in self.markets) / len(self.markets) for gid in focus}
            best_gid, best_ratio = None, float('inf')
            for gid in focus:
                here = self.markets[r.location][gid].price
                ratio = here / avg[gid] if avg[gid] else float('inf')
                if ratio < 0.82 and ratio < best_ratio and here * 3 <= r.cash:
                    best_ratio = ratio
                    best_gid = gid
            if best_gid:
                m = self.markets[r.location][best_gid]
                qty = min(r.cargo_max - self._rival_cargo(r), int(r.cash / m.price) if m.price > 0 else 0, 5)
                if qty > 0:
                    r.cash -= qty * m.price
                    m.stock = max(2.0, m.stock - qty * 0.7)
                    prev = r.inventory.get(best_gid, {'qty': 0, 'cost': 0.0})
                    nq = prev['qty'] + qty
                    r.inventory[best_gid] = {'qty': nq, 'cost': (prev['qty'] * prev['cost'] + qty * m.price) / nq}
                    r.last_action = f'bought {qty} {GOODS[best_gid]["name"]} in {CITIES[r.location]["name"]}'
                    did = True

        # Travel
        if not did:
            best_city, best_score = None, float('-inf')
            for cid in CITIES:
                if cid == r.location:
                    continue
                score = sum(h['qty'] * (self.markets[cid][gid].price - h['cost'])
                            for gid, h in r.inventory.items())
                score -= ROUTES.get(f'{r.location}:{cid}', 5) * 5
                if score > best_score:
                    best_score, best_city = score, cid
            if not best_city or best_score < -60:
                candidates = [c for c in CITIES if c != r.location]
                best_city = self.rng.choice(candidates) if candidates else r.location
            dist = ROUTES.get(f'{r.location}:{best_city}', 4)
            r.travel = TravelInfo(frm=r.location, to=best_city, eta_tick=self.tick + dist)
            r.last_action = f'en route to {CITIES[best_city]["name"]}'

    # ── Buildings ────────────────────────────────────────────────────────────

    def _tick_buildings(self, p: PlayerState):
        for city_id, blist in p.buildings.items():
            if 'trading_post' in blist:
                p.cash += 30
            if 'plantation' in blist:
                m = self.markets[city_id]['food']
                income = 2 * m.price * 0.9
                m.stock += 2.0
                p.cash += income
            if 'smelter' in blist and self.tick % 3 == 0:
                ore_m = self.markets[city_id]['ore']
                mach_m = self.markets[city_id]['mach']
                if ore_m.stock >= 5:
                    ore_m.stock -= 1
                    mach_m.stock += 0.8
                    profit = max(0.0, mach_m.price * 0.85 - ore_m.price)
                    p.cash += profit

    # ── Best route analysis ──────────────────────────────────────────────────

    def best_routes(self, top_n: int = 5) -> list[dict]:
        """Return the top arbitrage opportunities across all cities."""
        opps = []
        for gid in GOODS:
            prices = {cid: self.markets[cid][gid].price for cid in CITIES}
            for buy_city in CITIES:
                for sell_city in CITIES:
                    if buy_city == sell_city:
                        continue
                    dist = ROUTES.get(f'{buy_city}:{sell_city}')
                    if not dist:
                        continue
                    if prices[buy_city] <= 0:
                        continue
                    margin = (prices[sell_city] - prices[buy_city]) / prices[buy_city]
                    if margin > 0.05:
                        opps.append({
                            'good': gid,
                            'buy_city': buy_city,
                            'sell_city': sell_city,
                            'buy_price': round(prices[buy_city], 2),
                            'sell_price': round(prices[sell_city], 2),
                            'margin': round(margin * 100, 1),
                            'dist': dist,
                            'score': round(margin * 100 / dist, 2),
                        })
        opps.sort(key=lambda x: x['score'], reverse=True)
        return opps[:top_n]

    def issue_contract(self, player: PlayerState) -> Optional[dict]:
        """Offer a delivery job from the player's current port."""
        if player.travel or len(player.contracts) >= 2:
            return None
        routes = [r for r in ROUTES_RAW if r[0] == player.location or r[1] == player.location]
        if not routes:
            return None
        a, b, dist = self.rng.choice(routes)
        dest = b if a == player.location else a
        gid = self.rng.choice(list(GOODS.keys()))
        qty = 2 + self.rng.randint(0, 4)
        buy = self.markets[player.location][gid].price
        reward = round(qty * buy * 0.22 + dist * 18, 2)
        job = {
            'id': f'c{self.tick}{self.rng.randint(10, 99)}',
            'good': gid,
            'qty': qty,
            'dest': dest,
            'destName': CITIES[dest]['name'],
            'reward': reward,
            'expires': self.tick + 12 + dist * 2,
        }
        player.contracts.append(job)
        player.add_log(
            'contract',
            f'Bond posted: {qty} {GOODS[gid]["name"]} to {job["destName"]} for ${reward:.0f}.',
            self.tick,
        )
        return job

    def complete_contracts(self, player: PlayerState) -> list[dict]:
        done = []
        keep = []
        for job in player.contracts:
            if self.tick > job['expires']:
                player.add_log('contract', 'A bond expired unsigned.', self.tick)
                continue
            hold = player.inventory.get(job['good'], {}).get('qty', 0)
            if player.location == job['dest'] and hold >= job['qty']:
                player.inventory[job['good']]['qty'] -= job['qty']
                if player.inventory[job['good']]['qty'] <= 0:
                    del player.inventory[job['good']]
                player.cash += job['reward']
                player.contracts_done += 1
                player.unlock_achievement('contractor', self.tick)
                player.add_log(
                    'contract',
                    f'Delivered {job["qty"]} {GOODS[job["good"]]["name"]} to {job["destName"]} (+${job["reward"]:.0f}).',
                    self.tick,
                )
                done.append(job)
            else:
                keep.append(job)
        player.contracts = keep
        return done

    # ── Main step ────────────────────────────────────────────────────────────

    def step(self, players: list[PlayerState] | None = None) -> Optional[EventRecord]:
        players = players or []
        self.tick += 1

        for cid in CITIES:
            for gid in GOODS:
                self._tick_market(cid, gid)

        self.events = [e for e in self.events if e.expires > self.tick]
        new_ev = self._maybe_spawn_event()

        for r in self.rivals:
            self._tick_rival(r)

        crisis_active = any(e.kind == 'crisis' for e in self.events)

        for p in players:
            if p.travel and self.tick >= p.travel.eta_tick:
                dest = p.travel.to
                enc = roll_encounter(self.rng, p.hull, p.crew)
                p.location = dest
                p.travel = None
                p.mark_visited(p.location)
                p.crossings += 1
                p.add_log('travel', f'Arrived at {CITIES[p.location]["name"]}.', self.tick)
                if enc:
                    p.pending_encounter = enc
                    # Auto-resolve with the safest first choice so headless ticks stay playable.
                    result = resolve_encounter(
                        enc,
                        enc['choices'][0]['id'],
                        cash=p.cash,
                        hull=p.hull,
                        crew=p.crew,
                        inventory=p.inventory,
                        rng=self.rng,
                    )
                    p.apply_encounter_result(result, day=self.tick)
            if p.loan > 0:
                p.loan *= (1 + p.loan_rate)
            self._tick_buildings(p)
            self.complete_contracts(p)
            if (not p.travel) and self.tick % 7 == 0 and self.rng.random() < 0.45:
                self.issue_contract(p)
            p.morale = max(0.0, min(100.0, p.morale + (0.4 if p.crew >= 4 else -0.6)))
            p.check_achievements(self.markets, day=self.tick, crisis_active=crisis_active)

        return new_ev

    # ── Public economy snapshot (no private player data) ─────────────────────

    def public_snapshot(self) -> dict:
        """Observer-safe view of the shared economy."""
        avg_price = {
            gid: sum(self.markets[cid][gid].price for cid in self.markets) / len(self.markets)
            for gid in GOODS
        }
        markets_out = {
            cid: {
                gid: {
                    'price': round(m.price, 2),
                    'prev':  round(m.prev_price, 2),
                    'stock': round(m.stock, 1),
                    'base_stock': round(m.baseline_stock, 1),
                    'demand': round(m.demand, 1),
                    'avg': round(avg_price[gid], 2),
                }
                for gid, m in goods.items()
            }
            for cid, goods in self.markets.items()
        }
        events_out = [
            {
                'id': ev.inst_id, 'title': ev.title, 'kind': ev.kind,
                'desc': ev.desc, 'target': ev.target, 'target_name': ev.target_name,
                'target_type': ev.target_type, 'goods': ev.goods,
                'remaining': ev.expires - self.tick,
            }
            for ev in self.events
        ]
        rivals_out = [
            {
                'id': r.id, 'name': r.name, 'nw': round(self._rival_nw(r)),
                'location': r.location, 'traveling': r.travel is not None,
                'last_action': r.last_action,
            }
            for r in self.rivals
        ]
        return {
            'tick': self.tick,
            'version': VERSION,
            'markets': markets_out,
            'events': events_out,
            'rivals': rivals_out,
            'bestRoutes': self.best_routes(),
        }

    # ── Serialisation ────────────────────────────────────────────────────────

    def serialize(self, player: PlayerState) -> dict:
        avg_price = {
            gid: sum(self.markets[cid][gid].price for cid in self.markets) / len(self.markets)
            for gid in GOODS
        }

        markets_out = {
            cid: {
                gid: {
                    'price': round(m.price, 2),
                    'prev':  round(m.prev_price, 2),
                    'stock': round(m.stock, 1),
                    'base_stock': round(m.baseline_stock, 1),
                    'demand': round(m.demand, 1),
                    'avg': round(avg_price[gid], 2),
                }
                for gid, m in goods.items()
            }
            for cid, goods in self.markets.items()
        }

        history_out = {
            cid: {gid: self.history[cid][gid][-80:] for gid in GOODS}
            for cid in CITIES
        }

        events_out = [
            {
                'id': ev.inst_id, 'title': ev.title, 'kind': ev.kind,
                'desc': ev.desc, 'target': ev.target, 'target_name': ev.target_name,
                'target_type': ev.target_type, 'goods': ev.goods,
                'remaining': ev.expires - self.tick,
            }
            for ev in self.events
        ]

        rivals_out = [
            {
                'id': r.id, 'name': r.name, 'nw': round(self._rival_nw(r)),
                'location': r.location, 'traveling': r.travel is not None,
                'last_action': r.last_action,
            }
            for r in self.rivals
        ]

        # Ensure non-crisis achievements stay current on every snapshot
        # (crisis counting is handled in step(); don't double-count here)
        player.check_achievements(self.markets, day=self.tick, crisis_active=False)

        achievements_out = []
        unlocked = set(player.achievements)
        for aid, meta in ACHIEVEMENTS.items():
            achievements_out.append({
                'id': meta['id'],
                'name': meta['name'],
                'desc': meta['desc'],
                'unlocked': aid in unlocked,
            })

        return {
            'tick': self.tick,
            'version': VERSION,
            'markets': markets_out,
            'history': history_out,
            'events': events_out,
            'rivals': rivals_out,
            'bestRoutes': self.best_routes(),
            'player': {
                'pid': player.pid,
                'cash': round(player.cash, 2),
                'loan': round(player.loan, 2),
                'inventory': {gid: {'qty': h['qty'], 'cost': round(h['cost'], 2)}
                              for gid, h in player.inventory.items()},
                'location': player.location,
                'travel': {
                    'from': player.travel.frm, 'to': player.travel.to,
                    'eta': player.travel.eta_tick,
                    'remaining': player.travel.eta_tick - self.tick,
                } if player.travel else None,
                'cargoUsed': player.cargo_used(),
                'cargoMax': player.cargo_max(),
                'cargoLevel': player.cargo_level,
                'speedLevel': player.speed_level,
                'buildings': {cid: list(b) for cid, b in player.buildings.items()},
                'netWorth': round(player.net_worth(self.markets), 2),
                'totalProfit': round(player.total_profit, 2),
                'totalTrades': player.total_trades,
                'visitedCities': list(player.visited_cities),
                'achievements': achievements_out,
                'unlockedAchievements': list(player.achievements),
                'log': player.log[-40:],
                'hull': round(player.hull, 1),
                'crew': player.crew,
                'morale': round(player.morale, 1),
                'contracts': list(player.contracts),
                'pendingEncounter': player.pending_encounter,
                'crossings': player.crossings,
                'contractsDone': player.contracts_done,
                'wrecked': player.wrecked(),
            },
            'meta': {
                'goal': GOAL,
                'version': VERSION,
                'goods': GOODS_DEFS,
                'cities': CITIES_DEFS,
                'routes': [{'a': a, 'b': b, 'd': d} for a, b, d in ROUTES_RAW],
                'buildings': BUILDINGS,
                'cargoLevels': CARGO_LEVELS,
                'cargoUpgradeCosts': CARGO_UPGRADE_COSTS,
                'speedLevels': SPEED_LEVELS,
                'speedUpgradeCosts': SPEED_UPGRADE_COSTS,
                'achievements': list(ACHIEVEMENTS.values()),
            },
        }
