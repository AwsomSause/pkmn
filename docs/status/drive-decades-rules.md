# Drive plan: Decades rule options
Four optional run modifiers (Modifiers page, Battle category), each with a +5% reward bonus. No save change: they are ordinary modifier ids, and the battle sees them through `battleContent` flags (`Ruleset.frostbite`, `drowsy`, `normalFollowsUser`).
- **Own-Type Normal:** Normal-type moves take the user's first type, both sides. A Normal-type user is unchanged.
- **Frostbite:** Freeze no longer skips turns or thaws by chance. A frozen Pokémon's special attacks are halved (same cut as burn on physical) and it loses 1/16 HP per turn. Fire hits still thaw.
- **Drowsy:** a sleeping Pokémon acts about half the time (the sleep counter still runs down). This uses the battle RNG only when the rule is on.
- **Ability Pick:** the Camp's Ability Capsule becomes free and unlimited, so any party Pokémon can take any of its own abilities (hidden included). Reuses the existing capsule screen; no new UI. Our species have at most 3 abilities, so "1 of 6" is "any of its own".
- The exact Decades wording for Frostbite and Drowsy was not read, so these are our reading of the plan's one-line description.
- Tests: `tests/unit/decadesRules.test.ts`, `tests/unit/capsuleQuests.test.ts`.
