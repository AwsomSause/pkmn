# Left-out final leftovers (2.3 retired team, 2.5 #15 and #157)

- **Retired-team battle (2.3):** event "The Team That Fell Short" (`retired-team`, stage 4+). The team is the newest past run that did not win, rebuilt from the run record (species and levels), like the champion defense. New event condition `retiredGhost`, trainer-battle flag `retired`. Run record only; not a replay of that run's inputs.
- **Signature moments (#15):** the battle recap adds "Signature moment" lines found in the fight's numbers: a sweep (one Pokémon knocks out 3+ foes) and a clutch (the MVP finished at 15% HP or less). Major battles only (same as the recap). `RecapTally.kos` is new (optional, defaults empty).
- **Temporary ally (#157):** event battle field `ally` (a species). The ally is added to the party for the fight, the battle becomes a double battle (needs 2+ foes), and `battle.loaner` marks it. It leaves the party when the battle ends, earns no XP, and does not keep you alive: if only the ally is left standing you lose. Event "Two on One" (`borrowed-ally`).
- Still skipped: 159 (no map weather).
- Saves: no version bump (optional fields). Events were inserted into events.json by script (the generator is stale).
