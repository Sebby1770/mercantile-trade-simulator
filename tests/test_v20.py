"""2.0 captain systems: hull, encounters, contracts, repairs."""
from __future__ import annotations

import random

from engine import (
    GOAL,
    START_CASH,
    START_HULL,
    GameWorld,
    PlayerState,
    resolve_encounter,
    roll_encounter,
)


def test_fresh_captain_has_a_ship():
    p = PlayerState(pid="cap")
    assert p.hull == START_HULL
    assert p.crew == 4
    assert p.morale > 0
    assert p.wrecked() is False


def test_repair_costs_coin_and_restores_hull():
    p = PlayerState(pid="cap")
    p.hull = 70
    cost = p.repair(10)
    assert cost == 10 * 18
    assert p.hull == 80
    assert p.cash == START_CASH - cost


def test_hire_crew():
    p = PlayerState(pid="cap")
    p.hire_crew()
    assert p.crew == 5
    assert p.cash < START_CASH


def test_resolve_storm_damages_hull():
    enc = {
        "id": "storm",
        "dmg": 12,
        "choices": [{"id": "reef", "label": "Reef"}],
    }
    result = resolve_encounter(
        enc, "reef", cash=2000, hull=100, crew=4, inventory={}, rng=random.Random(1)
    )
    assert result["hull"] == -12
    assert "Storm" in result["log"] or "squall" in result["log"].lower() or "hull" in result["log"].lower()


def test_fight_can_unlock_privateer_flag():
    enc = {
        "id": "pirates",
        "tribute": 100,
        "choices": [{"id": "fight", "label": "Fight"}],
    }
    rng = random.Random(0)
    won = False
    for seed in range(40):
        result = resolve_encounter(
            enc,
            "fight",
            cash=2000,
            hull=100,
            crew=12,
            inventory={},
            rng=random.Random(seed),
        )
        if "privateer" in result["flags"]:
            won = True
            break
    assert won


def test_apply_encounter_mutates_player():
    p = PlayerState(pid="cap")
    p.apply_encounter_result({"hull": -15, "cash": -10, "morale": -3, "log": "boom", "flags": ["storm_sailor"]})
    assert p.hull == START_HULL - 15
    assert "storm_sailor" in p.achievements
    assert p.pending_encounter is None


def test_tycoon_achievement():
    w = GameWorld(seed=1)
    p = PlayerState(pid="ty")
    p.cash = GOAL + 10
    newly = p.check_achievements(w.markets, day=1)
    assert "tycoon" in newly


def test_contract_roundtrip():
    w = GameWorld(seed=4)
    p = PlayerState(pid="job")
    job = None
    for _ in range(30):
        job = w.issue_contract(p)
        if job:
            break
        w.step([p])
    assert job is not None
    p.inventory[job["good"]] = {"qty": job["qty"] + 1, "cost": 10}
    p.location = job["dest"]
    done = w.complete_contracts(p)
    assert done
    assert p.contracts_done >= 1
    assert "contractor" in p.achievements


def test_serialize_includes_ship_stats():
    w = GameWorld(seed=2)
    p = PlayerState(pid="ser")
    data = w.serialize(p)
    player = data["player"]
    assert "hull" in player
    assert "crew" in player
    assert "morale" in player
    assert player["wrecked"] is False


def test_roll_encounter_can_be_calm():
    calm = 0
    stormy = 0
    for seed in range(80):
        enc = roll_encounter(random.Random(seed), 100, 4)
        if enc is None:
            calm += 1
        else:
            stormy += 1
    assert calm > 10
    assert stormy > 5
