# Balance report (seeded battle simulations)

Made by `npm run report:balance -- --write` with seed `balance-v1`. Same seed, same numbers. Read-only: nothing in the game was changed.

Both sides pick moves the way a clever boss does (the player picks its best move 3 times in 4). The simulated player uses no items, no vitamins and no healing, so a real run is easier than these numbers. Read the shape of the curve, not the exact percentages.

## 1. Species strength

590 fully evolved wild lines at level 50, each in 40 one-on-one battles against random lines.

- **1** win 90% or more (possible outliers on the strong side).
- **27** win 10% or less (possible outliers on the weak side, often because most of their moves are not supported yet).

| Strongest | Win rate | Weakest | Win rate |
|---|---|---|---|
| Slaking | 95% | Wobbuffet | 0% |
| Fan Rotom | 88% | Wishiwashi | 0% |
| Escavalier | 85% | Pyukumuku | 0% |
| Delta Metagross (Ruin) | 85% | Delta Ditto (Water) | 0% |
| Delta Roserade | 85% | Delta Ditto (Psychic) | 0% |
| Corviknight | 83% | Delta Ditto (Ice) | 0% |
| Darmanitan | 83% | Delta Ditto (Dark) | 0% |
| Excadrill | 83% | Jumpluff | 3% |
| Garchomp | 83% | Delta Ditto (Dragon) | 3% |
| Klefki | 83% | Delta Ditto | 3% |
| Gardevoir | 80% | Shuckle | 5% |
| Goodra | 80% | Shedinja | 5% |
| Delta Snorlax (Summer) | 80% | Luvdisc | 5% |
| Delta Typhlosion | 80% | Delta Ditto (Steel) | 5% |
| Walrein | 80% | Delta Ditto (Rock) | 5% |

## 2. Difficulty curve (full campaign)

A fresh party of random wild-line Pokémon at the level ordinary enemies have at that point, against a random boss, 40 battles per row. Party size: 3 at the first gym, 6 from the fourth.

| Region | Battle | Party level | Boss levels | Party size | Player wins |
|---|---|---|---|---|---|
| 1 | gym 1 | 15 | 17–20 | 3 | 63% |
| 1 | gym 2 | 22 | 24–27 | 4 | 57% |
| 1 | gym 3 | 27 | 29–32 | 5 | 45% |
| 1 | gym 4 | 31 | 33–36 | 6 | 60% |
| 1 | gym 5 | 35 | 37–40 | 6 | 40% |
| 1 | gym 6 | 38 | 40–43 | 6 | 30% |
| 1 | gym 7 | 42 | 44–47 | 6 | 30% |
| 1 | gym 8 | 45 | 47–50 | 6 | 30% |
| 1 | Elite Four | 45 | 46–49 | 6 | 43% |
| 1 | champion | 45 | 48–50 | 6 | 3% |
| 2 | gym 1 | 63 | 65–68 | 6 | 28% |
| 2 | gym 2 | 69 | 71–74 | 6 | 35% |
| 2 | gym 3 | 75 | 77–80 | 6 | 8% |
| 2 | gym 4 | 80 | 82–85 | 6 | 5% |
| 2 | gym 5 | 84 | 86–89 | 6 | 13% |
| 2 | gym 6 | 88 | 90–93 | 6 | 18% |
| 2 | gym 7 | 92 | 94–97 | 6 | 5% |
| 2 | gym 8 | 95 | 97–100 | 6 | 10% |
| 2 | Elite Four | 95 | 96–99 | 6 | 38% |
| 2 | champion | 95 | 98–100 | 6 | 0% |
| 3 | gym 1 | 100 | 100–100 | 6 | 8% |
| 3 | gym 2 | 100 | 100–100 | 6 | 10% |
| 3 | gym 3 | 100 | 100–100 | 6 | 8% |
| 3 | gym 4 | 100 | 100–100 | 6 | 5% |
| 3 | gym 5 | 100 | 100–100 | 6 | 15% |
| 3 | gym 6 | 100 | 100–100 | 6 | 5% |
| 3 | gym 7 | 100 | 100–100 | 6 | 10% |
| 3 | gym 8 | 100 | 100–100 | 6 | 8% |
| 3 | Elite Four | 100 | 100–100 | 6 | 20% |
| 3 | champion | 100 | 100–100 | 6 | 0% |
| 4 | gym 1 | 100 | 100–100 | 6 | 20% |
| 4 | gym 2 | 100 | 100–100 | 6 | 15% |
| 4 | gym 3 | 100 | 100–100 | 6 | 15% |
| 4 | gym 4 | 100 | 100–100 | 6 | 15% |
| 4 | gym 5 | 100 | 100–100 | 6 | 13% |
| 4 | gym 6 | 100 | 100–100 | 6 | 8% |
| 4 | gym 7 | 100 | 100–100 | 6 | 10% |
| 4 | gym 8 | 100 | 100–100 | 6 | 8% |
| 4 | Elite Four | 100 | 100–100 | 6 | 13% |
| 4 | champion | 100 | 100–100 | 6 | 0% |
| 5 | gym 1 | 100 | 100–100 | 6 | 18% |
| 5 | gym 2 | 100 | 100–100 | 6 | 13% |
| 5 | gym 3 | 100 | 100–100 | 6 | 15% |
| 5 | gym 4 | 100 | 100–100 | 6 | 8% |
| 5 | gym 5 | 100 | 100–100 | 6 | 8% |
| 5 | gym 6 | 100 | 100–100 | 6 | 5% |
| 5 | gym 7 | 100 | 100–100 | 6 | 5% |
| 5 | gym 8 | 100 | 100–100 | 6 | 13% |
| 5 | Elite Four | 100 | 100–100 | 6 | 8% |
| 5 | champion | 100 | 100–100 | 6 | 0% |
| 6 | gym 1 | 100 | 100–100 | 6 | 20% |
| 6 | gym 2 | 100 | 100–100 | 6 | 5% |
| 6 | gym 3 | 100 | 100–100 | 6 | 15% |
| 6 | gym 4 | 100 | 100–100 | 6 | 18% |
| 6 | gym 5 | 100 | 100–100 | 6 | 10% |
| 6 | gym 6 | 100 | 100–100 | 6 | 10% |
| 6 | gym 7 | 100 | 100–100 | 6 | 20% |
| 6 | gym 8 | 100 | 100–100 | 6 | 5% |
| 6 | Elite Four | 100 | 100–100 | 6 | 15% |
| 6 | champion | 100 | 100–100 | 6 | 0% |
| 7 | gym 1 | 100 | 100–100 | 6 | 13% |
| 7 | gym 2 | 100 | 100–100 | 6 | 15% |
| 7 | gym 3 | 100 | 100–100 | 6 | 13% |
| 7 | gym 4 | 100 | 100–100 | 6 | 13% |
| 7 | gym 5 | 100 | 100–100 | 6 | 8% |
| 7 | gym 6 | 100 | 100–100 | 6 | 8% |
| 7 | gym 7 | 100 | 100–100 | 6 | 10% |
| 7 | gym 8 | 100 | 100–100 | 6 | 10% |
| 7 | Elite Four | 100 | 100–100 | 6 | 3% |
| 7 | champion | 100 | 100–100 | 6 | 0% |
| 8 | gym 1 | 100 | 100–100 | 6 | 10% |
| 8 | gym 2 | 100 | 100–100 | 6 | 23% |
| 8 | gym 3 | 100 | 100–100 | 6 | 13% |
| 8 | gym 4 | 100 | 100–100 | 6 | 13% |
| 8 | gym 5 | 100 | 100–100 | 6 | 13% |
| 8 | gym 6 | 100 | 100–100 | 6 | 18% |
| 8 | gym 7 | 100 | 100–100 | 6 | 10% |
| 8 | gym 8 | 100 | 100–100 | 6 | 8% |
| 8 | Elite Four | 100 | 100–100 | 6 | 3% |
| 8 | champion | 100 | 100–100 | 6 | 0% |
| 9 | gym 1 | 100 | 100–100 | 6 | 8% |
| 9 | gym 2 | 100 | 100–100 | 6 | 13% |
| 9 | gym 3 | 100 | 100–100 | 6 | 5% |
| 9 | gym 4 | 100 | 100–100 | 6 | 10% |
| 9 | gym 5 | 100 | 100–100 | 6 | 15% |
| 9 | gym 6 | 100 | 100–100 | 6 | 13% |
| 9 | gym 7 | 100 | 100–100 | 6 | 25% |
| 9 | gym 8 | 100 | 100–100 | 6 | 13% |
| 9 | Elite Four | 100 | 100–100 | 6 | 0% |
| 9 | champion | 100 | 100–100 | 6 | 0% |
| 10 | gym 1 | 100 | 100–100 | 6 | 8% |
| 10 | gym 2 | 100 | 100–100 | 6 | 5% |
| 10 | gym 3 | 100 | 100–100 | 6 | 5% |
| 10 | gym 4 | 100 | 100–100 | 6 | 15% |
| 10 | gym 5 | 100 | 100–100 | 6 | 20% |
| 10 | gym 6 | 100 | 100–100 | 6 | 5% |
| 10 | gym 7 | 100 | 100–100 | 6 | 18% |
| 10 | gym 8 | 100 | 100–100 | 6 | 8% |
| 10 | Elite Four | 100 | 100–100 | 6 | 0% |
| 10 | champion | 100 | 100–100 | 6 | 0% |
