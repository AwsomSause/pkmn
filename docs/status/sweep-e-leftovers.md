# Sweep E: 1.4 leftovers and noted gaps

- **Hidden achievements** Penny Pincher (won run, spent at most `balance.frugalRunMaxSpent` in shops), No Turning Back (won, no rest stops), One of a Kind (won with six Pokémon of six types), Wrong Way, Right Result (won after a wipe). Counters `frugalWins`, `noHealWins`, `rainbowWins`, `comebackWins` are worked out at run end in `core/relationships.ts`.
- **Species-tagged starter events**: new event condition `starter` (type, species or species tag of the Pokémon you started with); five "Starter Stories" events (Fire, Water, Grass, Electric, Eevee).
- **Spooky NPCs**: the Spooky events now show NPC art (Channeler, Lady, Ruin Maniac, Psychic) and a new Medium's Table event sells a clue or a charm.
- **Regional Circuit region choice**: a "Circuit region" row in Run Prep (enabled only for that mode); `rules.regionId`; the seed pick is unchanged when none is chosen.
- **Daily set rotation**: the Daily Run's three starters are now drawn from the date (`dailyStarters`) from the classic, region and type sets, and replace the draft (`starterOverride`).
Still open: a Lab view of today's Daily set; the Medium does not yet have a full shop.
