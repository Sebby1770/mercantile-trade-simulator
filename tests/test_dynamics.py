"""Unit tests for the core game engine."""
import math

import pytest

from engine import (
    CITIES, GOODS, ROUTES, ROUTES_RAW,
    CARGO_LEVELS, SPEED_LEVELS,
    GameWorld, PlayerState, TravelInfo, START_CASH,
)


@pytest.fixture
def world():
    return GameWorld()


@pytest.fixture
def player():
    p = PlayerState(pid='test1234')
    p.reputation = {cid: 0.0 for cid in CITIES}
    return p


# ─── Static data integrity ───────────────────────────────────────────────────

def test_routes_are_bidirectional():
    for a, b, d in ROUTES_RAW:
        assert ROUTES[f'{a}:{b}'] == d
        assert ROUTES[f'{b}:{a}'] == d


def test_routes_reference_known_cities():
    for a, b, _ in ROUTES_RAW:
        assert a in CITIES and b in CITIES


def test_every_city_reachable():
    """The route graph must be fully connected."""
    start = next(iter(CITIES))
    seen = {start}
    frontier = [start]
    while frontier:
        cur = frontier.pop()
        for other in CITIES:
            if other not in seen and f'{cur}:{other}' in ROUTES:
                seen.add(other)
                frontier.append(other)
    assert seen == set(CITIES)


def test_city_bias_covers_all_goods():
    for c in CITIES.values():
        missing = set(GOODS) - set(c['bias'])
        assert not missing, f'{c["id"]} missing bias for {missing}'


# ─── Market dynamics ─────────────────────────────────────────────────────────

def test_initial_markets_have_positive_prices(world):
    for cid in CITIES:
        for gid in GOODS:
            m = world.markets[cid][gid]
            assert m.price > 0
            assert m.stock > 0
            assert m.demand > 0


def test_step_advances_tick_and_keeps_prices_sane(world):
    for _ in range(50):
        world.step([])
    assert world.tick == 50
    for cid in CITIES:
        for gid in GOODS:
            m = world.markets[cid][gid]
            assert math.isfinite(m.price)
            assert m.price >= GOODS[gid]['base'] * 0.12
            assert m.stock >= 2.0
            assert m.demand >= 2.0


def test_history_is_bounded(world):
    for _ in range(120):
        world.step([])
    for cid in CITIES:
        for gid in GOODS:
            assert len(world.history[cid][gid]) <= 100


def test_events_spawn_and_expire(world):
    spawned = 0
    for _ in range(200):
        if world.step([]):
            spawned += 1
    assert spawned >= 5
    for ev in world.events:
        assert ev.expires > world.tick


def test_event_mods_apply_to_targeted_city(world):
    from engine import EventRecord
    world.events.append(EventRecord(
        inst_id='t1', tmpl_id='drought', title='Drought', kind='crisis',
        desc='test', target_type='city', target='veridian',
        target_name='Veridian Port', goods=['food'], s_mul=0.4, d_mul=1.35,
        expires=world.tick + 100,
    ))
    sm, dm = world._event_mods('veridian', 'food')
    assert sm == pytest.approx(0.4)
    assert dm == pytest.approx(1.35)
    # untouched city and good
    assert world._event_mods('ironhold', 'food') == (1.0, 1.0)
    assert world._event_mods('veridian', 'ore') == (1.0, 1.0)


def test_crisis_raises_price_over_time(world):
    from engine import EventRecord
    baseline = world.markets['veridian']['food'].price
    world.events.append(EventRecord(
        inst_id='t2', tmpl_id='famine', title='Famine', kind='crisis',
        desc='test', target_type='city', target='veridian',
        target_name='Veridian Port', goods=['food'], s_mul=0.3, d_mul=2.5,
        expires=10_000,
    ))
    for _ in range(60):
        world.step([])
    assert world.markets['veridian']['food'].price > baseline


# ─── Player state ────────────────────────────────────────────────────────────

def test_cargo_max_grows_with_level_and_warehouse(player):
    assert player.cargo_max() == CARGO_LEVELS[0]
    player.cargo_level = 2
    assert player.cargo_max() == CARGO_LEVELS[2]
    player.buildings = {'veridian': ['warehouse']}
    player.location = 'veridian'
    assert player.cargo_max() == CARGO_LEVELS[2] + 10
    player.location = 'ironhold'  # warehouse only applies while docked there
    assert player.cargo_max() == CARGO_LEVELS[2]


def test_trading_post_modifiers(player):
    assert player.buy_modifier('veridian') == 1.0
    assert player.sell_modifier('veridian') == 1.0
    player.buildings = {'veridian': ['trading_post']}
    assert player.buy_modifier('veridian') == pytest.approx(0.95)
    assert player.sell_modifier('veridian') == pytest.approx(1.05)


def test_net_worth_includes_inventory_and_loan(world, player):
    base = player.net_worth(world.markets)
    assert base == pytest.approx(START_CASH)
    player.loan = 500
    player.inventory = {'food': {'qty': 10, 'cost': 15.0}}
    nw = player.net_worth(world.markets)
    avg_food = sum(world.markets[cid]['food'].price for cid in world.markets) / len(world.markets)
    assert nw == pytest.approx(START_CASH - 500 + 10 * avg_food)


def test_log_is_bounded(player):
    for i in range(200):
        player.add_log('system', f'entry {i}', i)
    assert len(player.log) <= 80
    assert player.log[-1]['msg'] == 'entry 199'


def test_travel_arrival_and_loan_interest(world, player):
    player.travel = TravelInfo(frm='veridian', to='ironhold', eta_tick=world.tick + 1)
    player.loan = 1000.0
    world.step([player])
    assert player.travel is None
    assert player.location == 'ironhold'
    assert player.loan == pytest.approx(1000.0 * 1.003)


def test_buildings_generate_income(world, player):
    player.buildings = {'veridian': ['trading_post', 'plantation']}
    cash0 = player.cash
    world.step([player])
    assert player.cash > cash0 + 30  # trading post + plantation revenue


# ─── Route analysis & serialization ──────────────────────────────────────────

def test_best_routes_are_direct_and_profitable(world):
    for _ in range(30):
        world.step([])
    routes = world.best_routes()
    assert len(routes) <= 5
    for r in routes:
        assert f"{r['buy_city']}:{r['sell_city']}" in ROUTES
        assert r['sell_price'] > r['buy_price']
        assert r['margin'] > 5.0
        assert r['score'] > 0


def test_serialize_shape(world, player):
    data = world.serialize(player)
    assert set(data) >= {'tick', 'markets', 'history', 'events', 'rivals', 'bestRoutes', 'player', 'meta'}
    assert data['player']['cash'] == pytest.approx(START_CASH)
    assert data['player']['cargoMax'] == CARGO_LEVELS[0]
    assert set(data['markets']) == set(CITIES)
    for cid in CITIES:
        assert set(data['markets'][cid]) == set(GOODS)
    assert len(data['meta']['speedLevels']) == len(SPEED_LEVELS)
    # must be JSON-serializable end to end
    import json
    json.dumps(data)


def test_rivals_act_over_time(world):
    for _ in range(80):
        world.step([])
    assert any(r.last_action != 'scouting markets' for r in world.rivals)
    for r in world.rivals:
        assert math.isfinite(world._rival_nw(r))
