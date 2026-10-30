# Balance report (seeded battle simulations)

Made by `npm run report:balance -- --write` with seed `balance-v1`. Same seed, same numbers. Read-only: nothing in the game was changed.

Both sides pick moves the way a clever boss does (the player picks its best move 3 times in 4). The simulated player uses no items, no vitamins and no healing, so a real run is easier than these numbers. Read the shape of the curve, not the exact percentages.

## 1. Species strength

444 fully evolved wild lines at level 50, each in 40 one-on-one battles against random lines.

- **3** win 90% or more (possible outliers on the strong side).
- **27** win 10% or less (possible outliers on the weak side, often because most of their moves are not supported yet).

| Strongest | Win rate | Weakest | Win rate |
|---|---|---|---|
| Ursaluna | 98% | Luvdisc | 0% |
| Steelix | 93% | Jynx | 0% |
| Garchomp | 90% | Solrock | 3% |
| Carracosta | 88% | Smeargle | 3% |
| Haxorus | 88% | Shuckle | 3% |
| Gyarados | 85% | Minun | 3% |
| Salamence | 85% | Garbodor | 3% |
| Tyrantrum | 85% | Blissey | 3% |
| Gholdengo | 83% | Xatu | 5% |
| Glimmora | 83% | Weezing | 5% |
| Golisopod | 83% | Swoobat | 5% |
| Tauros | 83% | Medicham | 5% |
| Escavalier | 80% | Female Indeedee | 5% |
| Metagross | 80% | Roaming Form Gimmighoul | 5% |
| Orthworm | 80% | Ferrothorn | 5% |

## 2. Difficulty curve (full campaign)

A fresh party of random wild-line Pokémon at the level ordinary enemies have at that point, against a random boss, 40 battles per row. Party size: 3 at the first gym, 6 from the fourth.

| Region | Battle | Party level | Boss levels | Party size | Player wins |
|---|---|---|---|---|---|
| 1 | gym 1 | 15 | 17–20 | 3 | 53% |
| 1 | gym 2 | 22 | 24–27 | 4 | 53% |
| 1 | gym 3 | 27 | 29–32 | 5 | 33% |
| 1 | gym 4 | 31 | 33–36 | 6 | 65% |
| 1 | gym 5 | 35 | 37–40 | 6 | 40% |
| 1 | gym 6 | 38 | 40–43 | 6 | 25% |
| 1 | gym 7 | 42 | 44–47 | 6 | 40% |
| 1 | gym 8 | 45 | 47–50 | 6 | 18% |
| 1 | Elite Four | 45 | 46–49 | 6 | 38% |
| 1 | champion | 45 | 48–50 | 6 | 20% |
| 2 | gym 1 | 63 | 65–68 | 6 | 23% |
| 2 | gym 2 | 69 | 71–74 | 6 | 33% |
| 2 | gym 3 | 75 | 77–80 | 6 | 40% |
| 2 | gym 4 | 80 | 82–85 | 6 | 33% |
| 2 | gym 5 | 84 | 86–89 | 6 | 30% |
| 2 | gym 6 | 88 | 90–93 | 6 | 28% |
| 2 | gym 7 | 92 | 94–97 | 6 | 30% |
| 2 | gym 8 | 95 | 97–100 | 6 | 25% |
| 2 | Elite Four | 95 | 96–99 | 6 | 55% |
| 2 | champion | 95 | 98–100 | 6 | 20% |
| 3 | gym 1 | 100 | 100–100 | 6 | 38% |
| 3 | gym 2 | 100 | 100–100 | 6 | 30% |
| 3 | gym 3 | 100 | 100–100 | 6 | 25% |
| 3 | gym 4 | 100 | 100–100 | 6 | 28% |
| 3 | gym 5 | 100 | 100–100 | 6 | 35% |
| 3 | gym 6 | 100 | 100–100 | 6 | 20% |
| 3 | gym 7 | 100 | 100–100 | 6 | 10% |
| 3 | gym 8 | 100 | 100–100 | 6 | 30% |
| 3 | Elite Four | 100 | 100–100 | 6 | 45% |
| 3 | champion | 100 | 100–100 | 6 | 13% |
| 4 | gym 1 | 100 | 100–100 | 6 | 38% |
| 4 | gym 2 | 100 | 100–100 | 6 | 48% |
| 4 | gym 3 | 100 | 100–100 | 6 | 30% |
| 4 | gym 4 | 100 | 100–100 | 6 | 33% |
| 4 | gym 5 | 100 | 100–100 | 6 | 30% |
| 4 | gym 6 | 100 | 100–100 | 6 | 38% |
| 4 | gym 7 | 100 | 100–100 | 6 | 15% |
| 4 | gym 8 | 100 | 100–100 | 6 | 40% |
| 4 | Elite Four | 100 | 100–100 | 6 | 30% |
| 4 | champion | 100 | 100–100 | 6 | 30% |
| 5 | gym 1 | 100 | 100–100 | 6 | 40% |
| 5 | gym 2 | 100 | 100–100 | 6 | 38% |
| 5 | gym 3 | 100 | 100–100 | 6 | 30% |
| 5 | gym 4 | 100 | 100–100 | 6 | 35% |
| 5 | gym 5 | 100 | 100–100 | 6 | 30% |
| 5 | gym 6 | 100 | 100–100 | 6 | 30% |
| 5 | gym 7 | 100 | 100–100 | 6 | 30% |
| 5 | gym 8 | 100 | 100–100 | 6 | 43% |
| 5 | Elite Four | 100 | 100–100 | 6 | 50% |
| 5 | champion | 100 | 100–100 | 6 | 10% |
| 6 | gym 1 | 100 | 100–100 | 6 | 43% |
| 6 | gym 2 | 100 | 100–100 | 6 | 28% |
| 6 | gym 3 | 100 | 100–100 | 6 | 38% |
| 6 | gym 4 | 100 | 100–100 | 6 | 30% |
| 6 | gym 5 | 100 | 100–100 | 6 | 38% |
| 6 | gym 6 | 100 | 100–100 | 6 | 45% |
| 6 | gym 7 | 100 | 100–100 | 6 | 35% |
| 6 | gym 8 | 100 | 100–100 | 6 | 30% |
| 6 | Elite Four | 100 | 100–100 | 6 | 15% |
| 6 | champion | 100 | 100–100 | 6 | 18% |
| 7 | gym 1 | 100 | 100–100 | 6 | 35% |
| 7 | gym 2 | 100 | 100–100 | 6 | 28% |
| 7 | gym 3 | 100 | 100–100 | 6 | 33% |
| 7 | gym 4 | 100 | 100–100 | 6 | 43% |
| 7 | gym 5 | 100 | 100–100 | 6 | 33% |
| 7 | gym 6 | 100 | 100–100 | 6 | 28% |
| 7 | gym 7 | 100 | 100–100 | 6 | 40% |
| 7 | gym 8 | 100 | 100–100 | 6 | 57% |
| 7 | Elite Four | 100 | 100–100 | 6 | 30% |
| 7 | champion | 100 | 100–100 | 6 | 18% |
| 8 | gym 1 | 100 | 100–100 | 6 | 35% |
| 8 | gym 2 | 100 | 100–100 | 6 | 28% |
| 8 | gym 3 | 100 | 100–100 | 6 | 38% |
| 8 | gym 4 | 100 | 100–100 | 6 | 25% |
| 8 | gym 5 | 100 | 100–100 | 6 | 28% |
| 8 | gym 6 | 100 | 100–100 | 6 | 33% |
| 8 | gym 7 | 100 | 100–100 | 6 | 40% |
| 8 | gym 8 | 100 | 100–100 | 6 | 40% |
| 8 | Elite Four | 100 | 100–100 | 6 | 28% |
| 8 | champion | 100 | 100–100 | 6 | 5% |
| 9 | gym 1 | 100 | 100–100 | 6 | 43% |
| 9 | gym 2 | 100 | 100–100 | 6 | 35% |
| 9 | gym 3 | 100 | 100–100 | 6 | 43% |
| 9 | gym 4 | 100 | 100–100 | 6 | 38% |
| 9 | gym 5 | 100 | 100–100 | 6 | 23% |
| 9 | gym 6 | 100 | 100–100 | 6 | 33% |
| 9 | gym 7 | 100 | 100–100 | 6 | 30% |
| 9 | gym 8 | 100 | 100–100 | 6 | 33% |
| 9 | Elite Four | 100 | 100–100 | 6 | 33% |
| 9 | champion | 100 | 100–100 | 6 | 8% |
| 10 | gym 1 | 100 | 100–100 | 6 | 33% |
| 10 | gym 2 | 100 | 100–100 | 6 | 35% |
| 10 | gym 3 | 100 | 100–100 | 6 | 35% |
| 10 | gym 4 | 100 | 100–100 | 6 | 43% |
| 10 | gym 5 | 100 | 100–100 | 6 | 33% |
| 10 | gym 6 | 100 | 100–100 | 6 | 25% |
| 10 | gym 7 | 100 | 100–100 | 6 | 35% |
| 10 | gym 8 | 100 | 100–100 | 6 | 23% |
| 10 | Elite Four | 100 | 100–100 | 6 | 18% |
| 10 | champion | 100 | 100–100 | 6 | 5% |

## 3. Abilities

Abilities run in every simulated battle. Average one-on-one win rate of the lines that have each ability (abilities on at least 4 lines). An ability far from the middle is worth a look: it may be too strong, or may not be doing anything.

| Strongest | Lines | Win rate | Weakest | Lines | Win rate |
|---|---|---|---|---|---|
| sniper | 4 | 68% | synchronize | 5 | 21% |
| intimidate | 6 | 66% | technician | 5 | 27% |
| shell-armor | 9 | 63% | keen-eye | 5 | 30% |
| blaze | 9 | 62% | swarm | 6 | 32% |
| sap-sipper | 4 | 62% | shed-skin | 6 | 33% |
| sturdy | 10 | 59% | unburden | 4 | 33% |
| ice-body | 4 | 57% | pressure | 5 | 34% |
| mold-breaker | 5 | 57% | tangled-feet | 4 | 34% |
| flash-fire | 6 | 55% | klutz | 4 | 37% |
| frisk | 10 | 55% | gluttony | 7 | 39% |

## 4. With Mega, Tera, Z-Moves and Dynamax

The same simulations, but the player owns every key item, Mega Stone and Z-Crystal. Mega Evolution and Gigantamax happen by themselves; each battle the player also uses one of Tera, a Z-Move or Dynamax (picked by the seed) from the second turn. Bosses use their own transformations in both runs (from gym 5 and in the league). A big gap between the two columns shows how much the mechanics change a fight.

One-on-one at level 50: average win rate 47% without the kit, 61% with it. Lines that win 90% or more with the kit: **24** (without: 3).

Biggest gains from the kit:

| Line | Without | With |
|---|---|---|
| Feraligatr | 15% | 88% |
| Malamar | 43% | 90% |
| Kangaskhan | 38% | 85% |
| Chimecho | 33% | 78% |
| Meowstic | 30% | 75% |
| Pidgeot | 48% | 90% |
| Altaria | 28% | 68% |
| Mawile | 35% | 75% |
| Reuniclus | 33% | 73% |
| Ambipom | 18% | 55% |

| Region | Battle | Party level | Player wins | With the kit |
|---|---|---|---|---|
| 1 | gym 1 | 15 | 53% | 57% |
| 1 | gym 2 | 22 | 53% | 60% |
| 1 | gym 3 | 27 | 33% | 35% |
| 1 | gym 4 | 31 | 65% | 83% |
| 1 | gym 5 | 35 | 40% | 48% |
| 1 | gym 6 | 38 | 25% | 40% |
| 1 | gym 7 | 42 | 40% | 60% |
| 1 | gym 8 | 45 | 18% | 33% |
| 1 | Elite Four | 45 | 38% | 65% |
| 1 | champion | 45 | 20% | 25% |
| 2 | gym 1 | 63 | 23% | 53% |
| 2 | gym 2 | 69 | 33% | 45% |
| 2 | gym 3 | 75 | 40% | 60% |
| 2 | gym 4 | 80 | 33% | 40% |
| 2 | gym 5 | 84 | 30% | 45% |
| 2 | gym 6 | 88 | 28% | 45% |
| 2 | gym 7 | 92 | 30% | 43% |
| 2 | gym 8 | 95 | 25% | 55% |
| 2 | Elite Four | 95 | 55% | 75% |
| 2 | champion | 95 | 20% | 25% |
| 3 | gym 1 | 100 | 38% | 53% |
| 3 | gym 2 | 100 | 30% | 40% |
| 3 | gym 3 | 100 | 25% | 40% |
| 3 | gym 4 | 100 | 28% | 38% |
| 3 | gym 5 | 100 | 35% | 50% |
| 3 | gym 6 | 100 | 20% | 48% |
| 3 | gym 7 | 100 | 10% | 30% |
| 3 | gym 8 | 100 | 30% | 35% |
| 3 | Elite Four | 100 | 45% | 48% |
| 3 | champion | 100 | 13% | 30% |
| 4 | gym 1 | 100 | 38% | 50% |
| 4 | gym 2 | 100 | 48% | 50% |
| 4 | gym 3 | 100 | 30% | 45% |
| 4 | gym 4 | 100 | 33% | 48% |
| 4 | gym 5 | 100 | 30% | 48% |
| 4 | gym 6 | 100 | 38% | 38% |
| 4 | gym 7 | 100 | 15% | 33% |
| 4 | gym 8 | 100 | 40% | 53% |
| 4 | Elite Four | 100 | 30% | 40% |
| 4 | champion | 100 | 30% | 48% |
| 5 | gym 1 | 100 | 40% | 57% |
| 5 | gym 2 | 100 | 38% | 48% |
| 5 | gym 3 | 100 | 30% | 45% |
| 5 | gym 4 | 100 | 35% | 55% |
| 5 | gym 5 | 100 | 30% | 40% |
| 5 | gym 6 | 100 | 30% | 50% |
| 5 | gym 7 | 100 | 30% | 38% |
| 5 | gym 8 | 100 | 43% | 48% |
| 5 | Elite Four | 100 | 50% | 53% |
| 5 | champion | 100 | 10% | 18% |
| 6 | gym 1 | 100 | 43% | 45% |
| 6 | gym 2 | 100 | 28% | 50% |
| 6 | gym 3 | 100 | 38% | 50% |
| 6 | gym 4 | 100 | 30% | 45% |
| 6 | gym 5 | 100 | 38% | 50% |
| 6 | gym 6 | 100 | 45% | 45% |
| 6 | gym 7 | 100 | 35% | 38% |
| 6 | gym 8 | 100 | 30% | 38% |
| 6 | Elite Four | 100 | 15% | 35% |
| 6 | champion | 100 | 18% | 18% |
| 7 | gym 1 | 100 | 35% | 55% |
| 7 | gym 2 | 100 | 28% | 50% |
| 7 | gym 3 | 100 | 33% | 43% |
| 7 | gym 4 | 100 | 43% | 65% |
| 7 | gym 5 | 100 | 33% | 35% |
| 7 | gym 6 | 100 | 28% | 48% |
| 7 | gym 7 | 100 | 40% | 43% |
| 7 | gym 8 | 100 | 57% | 60% |
| 7 | Elite Four | 100 | 30% | 43% |
| 7 | champion | 100 | 18% | 20% |
| 8 | gym 1 | 100 | 35% | 55% |
| 8 | gym 2 | 100 | 28% | 53% |
| 8 | gym 3 | 100 | 38% | 48% |
| 8 | gym 4 | 100 | 25% | 40% |
| 8 | gym 5 | 100 | 28% | 38% |
| 8 | gym 6 | 100 | 33% | 45% |
| 8 | gym 7 | 100 | 40% | 48% |
| 8 | gym 8 | 100 | 40% | 45% |
| 8 | Elite Four | 100 | 28% | 38% |
| 8 | champion | 100 | 5% | 5% |
| 9 | gym 1 | 100 | 43% | 50% |
| 9 | gym 2 | 100 | 35% | 40% |
| 9 | gym 3 | 100 | 43% | 48% |
| 9 | gym 4 | 100 | 38% | 50% |
| 9 | gym 5 | 100 | 23% | 35% |
| 9 | gym 6 | 100 | 33% | 48% |
| 9 | gym 7 | 100 | 30% | 28% |
| 9 | gym 8 | 100 | 33% | 38% |
| 9 | Elite Four | 100 | 33% | 40% |
| 9 | champion | 100 | 8% | 10% |
| 10 | gym 1 | 100 | 33% | 53% |
| 10 | gym 2 | 100 | 35% | 55% |
| 10 | gym 3 | 100 | 35% | 53% |
| 10 | gym 4 | 100 | 43% | 50% |
| 10 | gym 5 | 100 | 33% | 57% |
| 10 | gym 6 | 100 | 25% | 33% |
| 10 | gym 7 | 100 | 35% | 57% |
| 10 | gym 8 | 100 | 23% | 55% |
| 10 | Elite Four | 100 | 18% | 25% |
| 10 | champion | 100 | 5% | 10% |
