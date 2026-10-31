# Sweep C: trainer classes as data and NPC movesets (5.17)

Built: 10 new ordinary trainer classes (Lass, Camper, Picnicker, Swimmer, Breeder, Battle Girl, Ranger, Ace Trainer, Veteran, Reporter) using the NPC art; every class now has a style, personality tags and intro/win/lose lines (the intro is spoken before ordinary trainer battles). `balance.extraTrainerClasses` switches the new ones off (the old-seed pin test does). Each of the 51 NPC trainers has a fixed supported moveset per signature species (`signatureMovesets`, built by `npm run data:npc-movesets`, used when that species is picked as the starter).
Limits: `style` does not change the AI yet; win/lose lines are data only (not shown yet).
