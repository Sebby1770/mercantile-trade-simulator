"""Engine unit tests — deterministic economy, trading, travel, serialize."""
from __future__ import annotations

import math

import pytest

from engine import (
    ACHIEVEMENTS,
    CITIES,
    GOODS,
    MILLIONAIRE_THRESHOLD,
    ROUTES,
    START_CASH,
    VERSION,
    GameWorld,
    PlayerState,
    TravelInfo,
    compute_target_price,
    format_log_csv,
    format_log_markdown,
    route_exists,
)


def test_version():
    assert VERSION == '2.0.0'


def test_compute_target_price_basic():
    # demand == stock → target equals base
    assert compute_target_price(100.0, 50.0, 50.0, 0.5) == pytest.approx(100.0)
    # higher demand raises price
    high = compute_target_price(100.0, 100.0, 50.0, 0.5)
    low = compute_target_price(100.0, 25.0, 50.0, 0.5)
    assert high > 100.0 > low
    # zero stock is safe (no ZeroDivision / nan)
    p = compute_target_price(10.0, 5.0, 0.0, 0.5)
    assert math.isfinite(p) and p > 0


def test_route_exists():
    assert route_exists('veridian', 'ironhold') is True
    assert route_exists('ironhold', 'veridian') is True  # bidirectional
    assert route_exists('veridian', 'aurelia') is False
    assert route_exists('veridian', 'ironhold', routes=ROUTES) is True


def test_seeded_world_is_deterministic():
    a = GameWorld(seed=42)
    b = GameWorld(seed=42)
    for _ in range(15):
        a.step([])
        b.step([])
    assert a.tick == b.tick == 15
    # Spot-check a few market prices
    for cid in list(CITIES)[:3]:
        for gid in list(GOODS)[:3]:
            assert a.markets[cid][gid].price == pytest.approx(b.markets[cid][gid].price)
    # Events should match (same RNG stream)
    assert len(a.events) == len(b.events)
    if a.events:
        assert a.events[0].tmpl_id == b.events[0].tmpl_id
        assert a.events[0].expires == b.events[0].expires


def test_different_seeds_diverge():
    a = GameWorld(seed=1)
    b = GameWorld(seed=2)
    for _ in range(10):
        a.step([])
        b.step([])
    # At least one price should differ
    diffs = [
        abs(a.markets[cid][gid].price - b.markets[cid][gid].price)
        for cid in CITIES
        for gid in GOODS
    ]
    assert max(diffs) > 0.01


def test_seed_none_still_runs():
    w = GameWorld(seed=None)
    w.step([])
    assert w.tick == 1
    assert 'veridian' in w.markets


def test_buy_sell_money_conservation_ish():
    """Cash + inventory cost basis should track buy/sell without free money."""
    w = GameWorld(seed=7)
    p = PlayerState(pid='t1')
    gid = 'food'
    m = w.markets[p.location][gid]
    price = m.price
    qty = 3
    cost = price * qty
    start_cash = p.cash

    # Simulate buy (mirrors server._buy economics)
    assert cost <= p.cash
    p.cash -= cost
    p.inventory[gid] = {'qty': qty, 'cost': price}
    p.total_trades += 1
    m.stock = max(2.0, m.stock - qty)

    assert p.cash == pytest.approx(start_cash - cost)
    assert p.cargo_used() == qty

    # Sell all at current market price
    sell_price = m.price
    revenue = sell_price * qty
    profit = revenue - p.inventory[gid]['cost'] * qty
    p.cash += revenue
    p.total_profit += profit
    p.total_trades += 1
    del p.inventory[gid]
    m.stock += qty * 0.7

    assert p.cargo_used() == 0
    assert p.cash == pytest.approx(start_cash - cost + revenue)
    assert p.total_profit == pytest.approx(profit)
    # No free money beyond market price movement
    assert p.cash == pytest.approx(start_cash + profit)


def test_travel_and_arrival():
    w = GameWorld(seed=3)
    p = PlayerState(pid='traveler')
    assert p.location == 'veridian'
    assert 'veridian' in p.visited_cities

    dist = ROUTES['veridian:ironhold']
    p.travel = TravelInfo(frm='veridian', to='ironhold', eta_tick=w.tick + dist)
    for _ in range(dist):
        w.step([p])
    assert p.travel is None
    assert p.location == 'ironhold'
    assert 'ironhold' in p.visited_cities


def test_serialize_keys():
    w = GameWorld(seed=9)
    p = PlayerState(pid='ser')
    w.step([p])
    data = w.serialize(p)

    for key in ('tick', 'version', 'markets', 'history', 'events', 'rivals',
                'bestRoutes', 'player', 'meta'):
        assert key in data

    player = data['player']
    for key in ('pid', 'cash', 'loan', 'inventory', 'location', 'travel',
                'cargoUsed', 'cargoMax', 'netWorth', 'totalProfit', 'totalTrades',
                'log', 'achievements', 'unlockedAchievements', 'visitedCities'):
        assert key in player

    assert data['version'] == VERSION
    assert data['meta']['goal'] > 0
    assert len(data['meta']['goods']) == len(GOODS)
    assert len(data['meta']['cities']) == len(CITIES)
    assert isinstance(player['achievements'], list)
    assert len(player['achievements']) == len(ACHIEVEMENTS)


def test_public_snapshot_has_no_private_player():
    w = GameWorld(seed=11)
    w.step([])
    snap = w.public_snapshot()
    assert 'player' not in snap
    assert 'markets' in snap
    assert 'tick' in snap
    assert snap['version'] == VERSION


def test_first_trade_achievement():
    w = GameWorld(seed=5)
    p = PlayerState(pid='ach')
    assert 'first_trade' not in p.achievements
    p.total_trades = 1
    newly = p.check_achievements(w.markets, day=1)
    assert 'first_trade' in newly
    assert 'first_trade' in p.achievements
    # Idempotent
    assert p.check_achievements(w.markets, day=2) == []


def test_millionaire_achievement():
    w = GameWorld(seed=5)
    p = PlayerState(pid='rich')
    p.cash = MILLIONAIRE_THRESHOLD + 1
    newly = p.check_achievements(w.markets, day=1)
    assert 'millionaire' in newly


def test_globe_trotter_achievement():
    w = GameWorld(seed=5)
    p = PlayerState(pid='globe')
    for cid in list(CITIES.keys())[:5]:
        p.mark_visited(cid)
    newly = p.check_achievements(w.markets, day=1)
    assert 'globe_trotter' in newly


def test_event_survivor_achievement():
    w = GameWorld(seed=5)
    p = PlayerState(pid='surv')
    newly = p.check_achievements(w.markets, day=1, crisis_active=True)
    assert 'event_survivor' in newly
    assert p.crisis_ticks == 1


def test_journal_markdown_and_csv():
    p = PlayerState(pid='j')
    p.add_log('buy', 'Bought 2x Food', 1)
    p.add_log('sell', 'Sold 2x Food', 2)
    md = p.journal(fmt='markdown', n=10)
    assert '# Trade Journal' in md
    assert 'Bought 2x Food' in md
    csv_text = p.journal(fmt='csv', n=10)
    assert 'day,kind,msg' in csv_text
    assert 'buy' in csv_text


def test_format_log_helpers_empty():
    assert 'No entries' in format_log_markdown([])
    assert format_log_csv([]).startswith('day,kind,msg')


def test_player_reset_progress():
    p = PlayerState(pid='r')
    p.cash = 99999
    p.total_trades = 5
    p.achievements = ['first_trade']
    p.inventory = {'food': {'qty': 2, 'cost': 10}}
    p.reset_progress()
    assert p.cash == START_CASH
    assert p.total_trades == 0
    assert p.achievements == []
    assert p.inventory == {}
    assert p.visited_cities == ['veridian']


def test_best_routes_structure():
    w = GameWorld(seed=13)
    for _ in range(5):
        w.step([])
    routes = w.best_routes(top_n=3)
    assert len(routes) <= 3
    for r in routes:
        assert route_exists(r['buy_city'], r['sell_city'])
        assert r['margin'] > 0
        assert 'good' in r
