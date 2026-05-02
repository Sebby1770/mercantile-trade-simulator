"""Mercantile — FastAPI WebSocket game server"""
import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from engine import (
    GameWorld, PlayerState, TravelInfo,
    ROUTES, CITIES, GOODS, BUILDINGS,
    CARGO_UPGRADE_COSTS, SPEED_UPGRADE_COSTS, CARGO_LEVELS,
    GOAL, START_CASH,
)

world = GameWorld()
connections: dict[str, tuple[WebSocket, PlayerState]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_game_loop())
    yield


app = FastAPI(lifespan=lifespan)


async def _game_loop():
    while True:
        t0 = time.monotonic()
        players = [p for _, p in connections.values()]
        new_ev = world.step(players)

        dead = []
        for pid, (ws, player) in list(connections.items()):
            try:
                payload = world.serialize(player)
                if new_ev:
                    payload['newEvent'] = {
                        'title': new_ev.title,
                        'kind': new_ev.kind,
                        'desc': new_ev.desc,
                    }
                await ws.send_text(json.dumps({'type': 'state', 'data': payload}))
            except Exception:
                dead.append(pid)
        for pid in dead:
            connections.pop(pid, None)

        elapsed = time.monotonic() - t0
        await asyncio.sleep(max(0.05, 1.5 - elapsed))


@app.websocket('/ws')
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    pid = str(uuid.uuid4())[:8]
    player = PlayerState(pid=pid)
    player.reputation = {cid: 0.0 for cid in CITIES}
    player.add_log('system', 'Welcome, trader. Your empire begins here.', 0)
    connections[pid] = (ws, player)

    # Send immediate snapshot so UI doesn't wait for first tick
    await ws.send_text(json.dumps({
        'type': 'state',
        'data': world.serialize(player),
    }))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            resp = _handle(msg, player)
            if resp:
                await ws.send_text(json.dumps(resp))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        connections.pop(pid, None)


def _handle(msg: dict, p: PlayerState) -> dict | None:
    act = msg.get('type')
    handlers = {
        'buy':            lambda: _buy(msg, p),
        'sell':           lambda: _sell(msg, p),
        'travel':         lambda: _travel(msg, p),
        'build':          lambda: _build(msg, p),
        'upgrade_cargo':  lambda: _upgrade_cargo(p),
        'upgrade_speed':  lambda: _upgrade_speed(p),
        'take_loan':      lambda: _take_loan(msg, p),
        'repay_loan':     lambda: _repay_loan(msg, p),
        'reset':          lambda: _reset(p),
    }
    fn = handlers.get(act)
    return fn() if fn else None


def _err(msg: str) -> dict:
    return {'type': 'error', 'msg': msg}


def _ok(msg: str) -> dict:
    return {'type': 'ok', 'msg': msg}


def _buy(msg: dict, p: PlayerState) -> dict:
    if p.travel:
        return _err('Cannot trade while in transit.')
    gid = msg.get('good')
    qty = int(msg.get('qty', 1))
    if gid not in GOODS or qty < 1:
        return _err('Invalid good or quantity.')
    m = world.markets[p.location][gid]
    price = m.price * p.buy_modifier(p.location)
    cost = price * qty
    space = p.cargo_max() - p.cargo_used()
    if qty > space:
        return _err(f'Only {space} cargo space remaining.')
    if cost > p.cash:
        return _err(f'Need ${cost:,.2f} — you have ${p.cash:,.2f}.')
    p.cash -= cost
    m.stock = max(2.0, m.stock - qty)
    m.demand = max(2.0, m.demand + qty * 0.3)
    prev = p.inventory.get(gid, {'qty': 0, 'cost': 0.0})
    nq = prev['qty'] + qty
    p.inventory[gid] = {'qty': nq, 'cost': (prev['qty'] * prev['cost'] + cost) / nq}
    p.total_trades += 1
    p.reputation[p.location] = min(1.0, p.reputation.get(p.location, 0) + 0.01)
    p.add_log('buy', f'Bought {qty}x {GOODS[gid]["name"]} @ ${price:.2f} = ${cost:,.2f}', world.tick)
    return _ok(f'Bought {qty}x {GOODS[gid]["name"]}')


def _sell(msg: dict, p: PlayerState) -> dict:
    if p.travel:
        return _err('Cannot trade while in transit.')
    gid = msg.get('good')
    qty = int(msg.get('qty', 1))
    if gid not in GOODS or qty < 1:
        return _err('Invalid good or quantity.')
    hold = p.inventory.get(gid)
    if not hold or hold['qty'] < qty:
        return _err(f'Not enough {GOODS[gid]["name"]} in cargo.')
    m = world.markets[p.location][gid]
    price = m.price * p.sell_modifier(p.location)
    revenue = price * qty
    profit = revenue - hold['cost'] * qty
    p.cash += revenue
    p.total_profit += profit
    p.total_trades += 1
    m.stock += qty * 0.7
    m.demand = max(2.0, m.demand - qty * 0.5)
    hold['qty'] -= qty
    if hold['qty'] <= 0:
        del p.inventory[gid]
    p.reputation[p.location] = min(1.0, p.reputation.get(p.location, 0) + 0.01)
    sign = '+' if profit >= 0 else ''
    p.add_log('sell', f'Sold {qty}x {GOODS[gid]["name"]} @ ${price:.2f} → P&L {sign}${profit:,.2f}', world.tick)
    return _ok(f'Sold. P&L: {sign}${profit:,.2f}')


def _travel(msg: dict, p: PlayerState) -> dict:
    if p.travel:
        return _err('Already traveling.')
    to = msg.get('to')
    if to not in CITIES:
        return _err('Unknown city.')
    if to == p.location:
        return _err('Already there.')
    dist = ROUTES.get(f'{p.location}:{to}')
    if not dist:
        return _err('No direct route.')
    ticks = max(1, round(dist * p.travel_speed()))
    p.travel = TravelInfo(frm=p.location, to=to, eta_tick=world.tick + ticks)
    p.add_log('travel', f'Departed {CITIES[p.location]["name"]} → {CITIES[to]["name"]} ({ticks}d)', world.tick)
    return _ok(f'Traveling to {CITIES[to]["name"]}.')


def _build(msg: dict, p: PlayerState) -> dict:
    btype = msg.get('building')
    city = msg.get('city', p.location)
    if btype not in BUILDINGS:
        return _err('Unknown building.')
    if city not in CITIES:
        return _err('Unknown city.')
    blist = p.buildings.get(city, [])
    if btype in blist:
        return _err(f'{BUILDINGS[btype]["name"]} already built here.')
    cost = BUILDINGS[btype]['cost']
    if p.cash < cost:
        return _err(f'Need ${cost:,}.')
    p.cash -= cost
    p.buildings.setdefault(city, []).append(btype)
    p.add_log('system', f'Built {BUILDINGS[btype]["name"]} in {CITIES[city]["name"]}.', world.tick)
    return _ok(f'Built {BUILDINGS[btype]["name"]}.')


def _upgrade_cargo(p: PlayerState) -> dict:
    nxt = p.cargo_level + 1
    if nxt >= len(CARGO_UPGRADE_COSTS):
        return _err('Maximum cargo reached.')
    cost = CARGO_UPGRADE_COSTS[nxt]
    if p.cash < cost:
        return _err(f'Need ${cost:,}.')
    p.cash -= cost
    p.cargo_level = nxt
    p.add_log('system', f'Cargo hold expanded to {CARGO_LEVELS[nxt]} units.', world.tick)
    return _ok(f'Cargo upgraded to {CARGO_LEVELS[nxt]} units.')


def _upgrade_speed(p: PlayerState) -> dict:
    nxt = p.speed_level + 1
    if nxt >= len(SPEED_UPGRADE_COSTS):
        return _err('Maximum speed reached.')
    cost = SPEED_UPGRADE_COSTS[nxt]
    if p.cash < cost:
        return _err(f'Need ${cost:,}.')
    p.cash -= cost
    p.speed_level = nxt
    p.add_log('system', 'Ship upgraded. Travel times reduced.', world.tick)
    return _ok('Ship speed upgraded.')


def _take_loan(msg: dict, p: PlayerState) -> dict:
    amount = float(msg.get('amount', 0))
    if amount <= 0:
        return _err('Invalid amount.')
    max_loan = max(0.0, p.net_worth(world.markets) * 1.5 - p.loan)
    if amount > max_loan:
        return _err(f'Max available loan: ${max_loan:,.2f}')
    p.loan += amount
    p.cash += amount
    p.add_log('system', f'Borrowed ${amount:,.2f}. Interest: {p.loan_rate * 100:.1f}%/tick.', world.tick)
    return _ok(f'Borrowed ${amount:,.2f}.')


def _repay_loan(msg: dict, p: PlayerState) -> dict:
    amount = float(msg.get('amount', 0))
    repay = min(amount, p.loan, p.cash)
    if repay <= 0:
        return _err('Nothing to repay.')
    p.cash -= repay
    p.loan -= repay
    p.add_log('system', f'Repaid ${repay:,.2f}. Remaining: ${p.loan:,.2f}.', world.tick)
    return _ok(f'Repaid ${repay:,.2f}.')


def _reset(p: PlayerState) -> dict:
    p.cash = START_CASH
    p.inventory = {}
    p.location = 'veridian'
    p.travel = None
    p.cargo_level = 0
    p.speed_level = 0
    p.loan = 0.0
    p.buildings = {}
    p.reputation = {cid: 0.0 for cid in CITIES}
    p.log = []
    p.total_profit = 0.0
    p.total_trades = 0
    p.add_log('system', 'New game started. Good luck, trader.', world.tick)
    return _ok('Game reset.')


app.mount('/', StaticFiles(directory='.', html=True), name='static')
