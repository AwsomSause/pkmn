# Sweep D: later modes (5.13)

Built: three new modes in `runRules.json`, picked in Run Prep like the other modes.
- **Draft Lab**: bundles the Random Draft modifier (starter set and draft rule random every run); no permanent rewards.
- **Regional Circuit**: new campaign `regional-circuit` (one region picked by the seed, 8 stages, full gyms and Elite Four); half the account rewards.
- **Research Expedition**: new campaign `expedition-route` (3 regions, 3 stages each, far fewer trainer columns), bundles Variant Hunt (more events) and Scarce Supplies (half starting money and items); 75% of the rewards.
Modes can now bundle modifiers (`bundles`, merged in `makeRules`).
Not built: Boss Gauntlet is the existing Boss Rush modifier; Rival Ladder and Custom Seed are not part of 5.13.
Limits: Regional Circuit picks any regular region (it does not yet let the player choose); Expedition has no discovery goals beyond the existing event rewards.
