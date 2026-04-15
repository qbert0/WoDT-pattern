# Smart Grinder Simulator

Mo hinh nay tach thanh 2 app doc lap:

- `simulator_app`: gia lap may xay ca phe
- `digital_twin_app`: nhan state, day len Ditto, nhan command tu Ditto

Command chinh cua grinder:

- `grind`
- `stop`
- `set_bean_amount`

State chinh:

- `power_status`
- `grinder_status`
- `bean_amount`
- `target_amount`
- `grind_complete`

Chay simulator:

```powershell
python -m smart_grinder_simulator.scripts.run_simulation
```

Chay digital twin:

```powershell
python -m smart_grinder_simulator.scripts.run_digital_twin
```

Seed Neo4j:

```powershell
python -m smart_grinder_simulator.scripts.seed_neo4j
```
