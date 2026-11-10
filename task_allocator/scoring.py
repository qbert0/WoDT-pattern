"""Scoring port pinned against WareTwin's internal allocator by parity tests."""
import math

def jsround(x):
    return math.floor(x + 0.5)

def js_to_fixed0(x):
    return str(jsround(x)) if x >= 0 else str(-jsround(-x))

WEIGHTS = {"distance": 0.35, "battery": 0.25, "workload": 0.15, "congestion": 0.15, "health": 0.10}

def lift_cost(state, r, l, SIM):
    """電梯成本（規格書 §7.2）：走到電梯 + 排隊估計 + 就位估計；FAULT = inf（與 TS 相同）"""
    L = state["lifts"][l["id"]]
    if L["fault"]:
        return math.inf
    approach = math.hypot(r["position"][0] - (l["cell"][0] - 1.5), r["position"][2] - (l["cell"][1] + 0.5)) / (SIM["MAX_SPEED"] * 0.8)
    # 預約者上車前仍留在 queue 裡，只有「不在任一 queue」（已離隊上車中）才額外 +1，避免重複計等待成本
    rb = L["reserved_by"]
    reserved_extra = 1 if rb and rb not in L["queue"]["1"] and rb not in L["queue"]["2"] else 0
    queue_len = len(L["queue"]["1"]) + len(L["queue"]["2"]) + reserved_extra
    per_service = (SIM["LIFT_DOOR_TICKS"] * 4 + SIM["LIFT_TRAVEL_TICKS"] + SIM["LIFT_LEVEL_TICKS"] + SIM["LIFT_COOLDOWN_TICKS"] + 40) * SIM["TICK_S"]
    busy = 0 if L["state"] == "IDLE" else per_service * 0.5
    wrong_floor = SIM["LIFT_TRAVEL_TICKS"] * SIM["TICK_S"] if (L["floor"] is not None and L["floor"] != r["floor"]) else 0
    return approach + queue_len * per_service + busy + wrong_floor

def rank(S, layout, task, idle, SIM):
    if not idle:
        return [], {}
    src = next(l for l in layout["locations"] if l["id"] == task["source"])
    weights = dict(WEIGHTS)
    src_floor = src.get("floor", 1)
    lift_pick: dict[str, str] = {}   # 每台候選當下算出的最佳電梯（round-6 P2：稽核與實際路線綁定）
    cands = []
    for r in idle:
        # 跨樓層：地面距離 + 固定懲罰 + 「實際電梯狀態」的預估等待（排隊長度/忙碌/所在樓層），換算成等效距離
        flat = math.hypot(r["position"][0] - src["access_point"][0], r["position"][2] - src["access_point"][1])
        d = flat; lift_info = None
        if r["floor"] != src_floor:
            ranked = sorted(({"l": l, "cost": lift_cost(S, r, l, SIM)} for l in layout["lifts"]), key=lambda x: (x["cost"], x["l"]["id"]))
            best_l = ranked[0] if ranked else None
            if best_l and best_l["cost"] < math.inf:
                approach = math.hypot(r["position"][0] - (best_l["l"]["cell"][0] - 1.5), r["position"][2] - (best_l["l"]["cell"][1] + 0.5)) / (SIM["MAX_SPEED"] * 0.8)
                wait_s = jsround((best_l["cost"] - approach) * 10) / 10
                lift_info = {"id": best_l["l"]["id"], "waitS": wait_s}
                lift_pick[r["id"]] = best_l["l"]["id"]
            else:
                lift_info = {"id": "—", "waitS": 60}
            d = flat + SIM["LIFT_XFLOOR_PENALTY_M"] + lift_info["waitS"] * SIM["MAX_SPEED"] * 0.8
        zone = S["zones"].get(r["zone"]) if r["zone"] else None
        cong = zone["congestion"] if zone else 0
        tc = r["stats"]["tasks_completed"]
        workload = "HIGH" if tc > 8 else "MEDIUM" if tc > 4 else "LOW"
        score = (weights["distance"] * (1 - min(1, d / 120)) + weights["battery"] * (r["battery"] / 100)
                 + weights["workload"] * (1 if workload == "LOW" else 0.6 if workload == "MEDIUM" else 0.2)
                 + weights["congestion"] * (1 - cong) + weights["health"] * (r["health"] / 100))
        if lift_info:
            reasons = [f"{js_to_fixed0(flat)}m ground", f"+{SIM['LIFT_XFLOOR_PENALTY_M']}m cross-floor via {lift_info['id']}",
                       f"est. lift wait {lift_info['waitS']:g}s", f"{js_to_fixed0(r['battery'])}% battery"]
        else:
            reasons = [f"{js_to_fixed0(d)}m from task", f"{js_to_fixed0(r['battery'])}% battery", f"{workload.lower()} workload"]
        if cong < 0.3:
            reasons.append("no route congestion")
        cands.append({"robot_id": r["id"], "score": jsround(score * 1000) / 1000, "distance_m": jsround(d), "battery": jsround(r["battery"]),
                      "workload": workload, "congestion": jsround(cong * 100) / 100, "health": r["health"], "reasons": reasons, "rejected_reason": None})
    cands.sort(key=lambda c: -c["score"])
    best = cands[0]
    for c in cands[1:]:
        c["rejected_reason"] = ("battery too low" if c["battery"] < 40 else "farther from task" if c["distance_m"] > best["distance_m"] * 1.5
                                else "high workload" if c["workload"] == "HIGH" else "lower score")
    return cands, lift_pick
