"""Handler and WebSocket integration tests for the game server."""
import math

import pytest
from starlette.testclient import TestClient

import server
from engine import CITIES, GOODS, START_CASH, PlayerState


@pytest.fixture
def player():
    p = PlayerState(pid='handler1')
    p.reputation = {cid: 0.0 for cid in CITIES}
    return p


@pytest.fixture(autouse=True)
def clean_sessions():
    server.sessions.clear()
    server.session_seen.clear()
    yield
    server.sessions.clear()
    server.session_seen.clear()


# ─── Input validation helpers ────────────────────────────────────────────────

@pytest.mark.parametrize('raw', ['abc', None, [], {}, float('nan'), float('inf'), -3, 0, 1e9 + 1e18])
def test_int_qty_rejects_garbage(raw):
    assert server._int_qty(raw) is None


def test_int_qty_accepts_normal_values():
    assert server._int_qty(5) == 5
    assert server._int_qty('12') == 12
    assert server._int_qty(3.9) == 3


@pytest.mark.parametrize('raw', ['xyz', None, float('nan'), float('inf'), -50, 0, 1e13])
def test_money_rejects_garbage(raw):
    assert server._money(raw) is None


def test_money_accepts_normal_values():
    assert server._money(500) == 500.0
    assert server._money('250.5') == 250.5


# ─── Action handlers ─────────────────────────────────────────────────────────

def test_buy_and_sell_roundtrip(player):
    resp = server._buy({'good': 'food', 'qty': 5}, player)
    assert resp['type'] == 'ok'
    assert player.inventory['food']['qty'] == 5
    assert player.cash < START_CASH

    resp = server._sell({'good': 'food', 'qty': 5}, player)
    assert resp['type'] == 'ok'
    assert 'food' not in player.inventory


def test_buy_rejects_more_than_market_stock(player):
    m = server.world.markets[player.location]['food']
    m.stock = 4.0
    resp = server._buy({'good': 'food', 'qty': 10}, player)
    assert resp['type'] == 'error'
    assert 'only has 4' in resp['msg'].lower()
    assert player.inventory == {}


def test_buy_rejects_nan_and_negative_qty(player):
    for bad in [float('nan'), -5, 0, 'lots']:
        resp = server._buy({'good': 'food', 'qty': bad}, player)
        assert resp['type'] == 'error'
    assert player.inventory == {}
    assert player.cash == START_CASH


def test_buy_respects_cargo_and_cash(player):
    player.cash = 10.0
    resp = server._buy({'good': 'art', 'qty': 1}, player)
    assert resp['type'] == 'error'  # too expensive
    player.cash = 1e9
    resp = server._buy({'good': 'food', 'qty': 21}, player)
    assert resp['type'] == 'error'  # cargo max is 20


def test_sell_requires_inventory(player):
    resp = server._sell({'good': 'food', 'qty': 3}, player)
    assert resp['type'] == 'error'


def test_travel_validation(player):
    assert server._travel({'to': 'atlantis'}, player)['type'] == 'error'
    assert server._travel({'to': player.location}, player)['type'] == 'error'
    # aurelia has no direct route from veridian
    assert server._travel({'to': 'aurelia'}, player)['type'] == 'error'
    resp = server._travel({'to': 'ironhold'}, player)
    assert resp['type'] == 'ok'
    assert player.travel is not None
    # can't trade or re-travel in transit
    assert server._buy({'good': 'food', 'qty': 1}, player)['type'] == 'error'
    assert server._travel({'to': 'neonbay'}, player)['type'] == 'error'


def test_build_requires_presence_and_funds(player):
    player.cash = 100.0
    assert server._build({'building': 'warehouse'}, player)['type'] == 'error'  # can't afford
    player.cash = 50_000.0
    assert server._build({'building': 'castle'}, player)['type'] == 'error'  # unknown
    resp = server._build({'building': 'warehouse', 'city': 'ironhold'}, player)
    assert resp['type'] == 'error'  # not there
    resp = server._build({'building': 'warehouse'}, player)
    assert resp['type'] == 'ok'
    assert 'warehouse' in player.buildings[player.location]
    resp = server._build({'building': 'warehouse'}, player)
    assert resp['type'] == 'error'  # duplicate


def test_upgrades_progress_and_cap(player):
    player.cash = 1e7
    for _ in range(3):
        assert server._upgrade_cargo(player)['type'] == 'ok'
    assert server._upgrade_cargo(player)['type'] == 'error'
    for _ in range(2):
        assert server._upgrade_speed(player)['type'] == 'ok'
    assert server._upgrade_speed(player)['type'] == 'error'


def test_loan_lifecycle_rejects_nan(player):
    for bad in [float('nan'), float('inf'), -100, 0, 'much']:
        assert server._take_loan({'amount': bad}, player)['type'] == 'error'
        assert server._repay_loan({'amount': bad}, player)['type'] == 'error'
    assert player.loan == 0.0
    assert math.isfinite(player.cash)

    resp = server._take_loan({'amount': 1000}, player)
    assert resp['type'] == 'ok'
    assert player.loan == pytest.approx(1000)
    assert player.cash == pytest.approx(START_CASH + 1000)

    resp = server._repay_loan({'amount': 400}, player)
    assert resp['type'] == 'ok'
    assert player.loan == pytest.approx(600)


def test_loan_capped_by_net_worth(player):
    resp = server._take_loan({'amount': 1e9}, player)
    assert resp['type'] == 'error'


def test_reset_restores_defaults(player):
    player.cash = 1.0
    player.loan = 999.0
    player.inventory = {'food': {'qty': 3, 'cost': 10.0}}
    server._reset(player)
    assert player.cash == START_CASH
    assert player.loan == 0.0
    assert player.inventory == {}
    assert player.location == 'veridian'


def test_unknown_action_is_ignored(player):
    assert server._handle({'type': 'hack_the_bank'}, player) is None


# ─── Session registry ────────────────────────────────────────────────────────

def test_resolve_session_creates_and_resumes():
    p1, resumed = server._resolve_session('tok_abcdef123456')
    assert not resumed
    p1.cash = 12345.0
    p2, resumed = server._resolve_session('tok_abcdef123456')
    assert resumed
    assert p2 is p1


def test_resolve_session_rejects_bad_tokens():
    p, resumed = server._resolve_session('bad token! ' * 10)
    assert not resumed
    assert server.sessions == {}
    p, resumed = server._resolve_session(None)
    assert not resumed
    assert server.sessions == {}


def test_sweep_drops_idle_sessions():
    server._resolve_session('tok_sweeptest12')
    assert 'tok_sweeptest12' in server.sessions
    server.session_seen['tok_sweeptest12'] -= server.SESSION_TTL + 1
    server._sweep_sessions()
    assert 'tok_sweeptest12' not in server.sessions


# ─── WebSocket integration ───────────────────────────────────────────────────

def test_websocket_snapshot_and_trade():
    client = TestClient(server.app)
    with client.websocket_connect('/ws?token=tok_wstest12345') as ws:
        snap = ws.receive_json()
        assert snap['type'] == 'state'
        assert snap['data']['player']['cash'] == pytest.approx(START_CASH)
        assert set(snap['data']['markets']) == set(CITIES)

        ws.send_json({'type': 'buy', 'good': 'food', 'qty': 2})
        resp = ws.receive_json()
        assert resp['type'] == 'ok'


def test_websocket_survives_malformed_messages():
    client = TestClient(server.app)
    with client.websocket_connect('/ws?token=tok_malformed12') as ws:
        ws.receive_json()
        ws.send_text('this is not json {{{')
        assert ws.receive_json()['type'] == 'error'
        ws.send_text('[1, 2, 3]')
        assert ws.receive_json()['type'] == 'error'
        ws.send_json({'type': 'buy', 'good': 'food', 'qty': 'NaN'})
        assert ws.receive_json()['type'] == 'error'
        # connection still alive and usable
        ws.send_json({'type': 'buy', 'good': 'food', 'qty': 1})
        assert ws.receive_json()['type'] == 'ok'


def test_websocket_session_resumes_after_disconnect():
    client = TestClient(server.app)
    with client.websocket_connect('/ws?token=tok_resume12345') as ws:
        ws.receive_json()
        ws.send_json({'type': 'buy', 'good': 'water', 'qty': 3})
        assert ws.receive_json()['type'] == 'ok'

    with client.websocket_connect('/ws?token=tok_resume12345') as ws:
        snap = ws.receive_json()
        inv = snap['data']['player']['inventory']
        assert inv.get('water', {}).get('qty') == 3

    # a different token gets a fresh player
    with client.websocket_connect('/ws?token=tok_fresh123456') as ws:
        snap = ws.receive_json()
        assert snap['data']['player']['inventory'] == {}
