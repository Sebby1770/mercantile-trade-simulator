"""Mercantile — FastAPI WebSocket + REST game server"""
import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from engine import (
    VERSION, GameWorld, PlayerState, TravelInfo,
    ROUTES, ROUTES_RAW, CITIES, CITIES_DEFS, GOODS, GOODS_DEFS, BUILDINGS, ACHIEVEMENTS,
    CARGO_UPGRADE_COSTS, SPEED_UPGRADE_COSTS, CARGO_LEVELS,
    GOAL, START_CASH,
)

# Seed from env for reproducible offline runs; omit for live entropy.
_WORLD_SEED = os.environ.get('MERCANTILE_SEED')
world = GameWorld(seed=int(_WORLD_SEED) if _WORLD_SEED is not None else None)
connections: dict[str, tuple[WebSocket, PlayerState]] = {}

SIM_TOKEN = os.environ.get('SIM_TOKEN', 'dev')
IS_PRODUCTION = os.environ.get('ENV', '').lower() in {'production', 'prod'}


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_game_loop())
    yield


app = FastAPI(
    title='Mercantile Trade Simulator',
    version=VERSION,
    lifespan=lifespan,
)


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


# ─── REST API ────────────────────────────────────────────────────────────────


class TickBody(BaseModel):
    n: int = Field(default=1, ge=1, le=500)


def _require_sim_token(x_sim_token: Optional[str]) -> None:
    """In production, require X-Sim-Token; elsewhere accept default/dev token or open access."""
    if IS_PRODUCTION:
        if not x_sim_token or x_sim_token != SIM_TOKEN:
            raise HTTPException(status_code=403, detail='Invalid or missing X-Sim-Token')
    elif x_sim_token is not None and x_sim_token != SIM_TOKEN:
        # Non-prod: if a token is sent, it must match; omission is allowed for testing.
        raise HTTPException(status_code=403, detail='Invalid X-Sim-Token')


@app.get('/api/health')
async def api_health():
    return {
        'ok': True,
        'service': 'mercantile-trade-simulator',
        'tick': world.tick,
        'players': len(connections),
        'version': VERSION,
    }


@app.get('/api/snapshot')
async def api_snapshot():
    """Public economy snapshot without private player wallets."""
    snap = world.public_snapshot()
    snap['players'] = len(connections)
    return snap


@app.get('/api/cities')
async def api_cities():
    return {
        'cities': [
            {
                'id': c['id'],
                'name': c['name'],
                'tag': c['tag'],
                'x': c['x'],
                'y': c['y'],
                'color': c['color'],
            }
            for c in CITIES_DEFS
        ],
        'routes': [{'a': a, 'b': b, 'd': d} for a, b, d in ROUTES_RAW],
    }


@app.get('/api/goods')
async def api_goods():
    return {'goods': GOODS_DEFS}


@app.post('/api/sim/tick')
async def api_sim_tick(
    body: TickBody | None = None,
    x_sim_token: Optional[str] = Header(default=None, alias='X-Sim-Token'),
):
    """Advance the world N ticks (offline / testing). Protected in production."""
    _require_sim_token(x_sim_token)
    n = (body.n if body else 1)
    players = [p for _, p in connections.values()]
    last_ev = None
    for _ in range(n):
        last_ev = world.step(players)
    return {
        'ok': True,
        'ticks_advanced': n,
        'tick': world.tick,
        'last_event': (
            {'title': last_ev.title, 'kind': last_ev.kind, 'desc': last_ev.desc}
            if last_ev else None
        ),
    }


@app.get('/api/players/{pid}/journal')
async def api_player_journal(
    pid: str,
    fmt: str = Query(default='markdown', pattern='^(markdown|csv)$'),
    n: int = Query(default=40, ge=1, le=80),
):
    """Export a connected player's trade journal as markdown or CSV."""
    conn = connections.get(pid)
    if not conn:
        raise HTTPException(status_code=404, detail='Player not connected')
    _, player = conn
    text = player.journal(fmt=fmt, n=n)
    media = 'text/csv' if fmt == 'csv' else 'text/markdown'
    return PlainTextResponse(text, media_type=media)


@app.get('/api/journal')
async def api_journal_by_query(
    pid: str = Query(..., description='Connected player id'),
    fmt: str = Query(default='markdown', pattern='^(markdown|csv)$'),
    n: int = Query(default=40, ge=1, le=80),
):
    """Alternate journal endpoint: ?pid=…"""
    return await api_player_journal(pid=pid, fmt=fmt, n=n)


@app.get('/api/achievements')
async def api_achievements():
    return {'achievements': list(ACHIEVEMENTS.values())}


# ─── WebSocket ───────────────────────────────────────────────────────────────


@app.websocket('/ws')
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    pid = str(uuid.uuid4())[:8]
    player = PlayerState(pid=pid)
    player.reputation = {cid: 0.0 for cid in CITIES}
    player.add_log('system', 'Welcome, trader. Your empire begins here.', world.tick)
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
    p.check_achievements(world.markets, day=world.tick, crisis_active=False)
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
    p.check_achievements(world.markets, day=world.tick, crisis_active=False)
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
    p.reset_progress()
    p.add_log('system', 'New game started. Good luck, trader.', world.tick)
    return _ok('Game reset.')


# Static files last so /api/* and /ws take precedence
STATIC_DIR = Path(__file__).parent / 'static'
app.mount('/', StaticFiles(directory=STATIC_DIR, html=True), name='static')
