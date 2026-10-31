# Run Events 2: Echoes of Your Own Choices (RE-B01 to RE-B66)

Design only, nothing built. Part of the run-event library (index: `run-events-0-index.md`). Rarity: C/U/R/VR/M. Size: S/M/L/XL.
These events read the run's own **choice log** (flags set by earlier events: spared, stole, helped, lied, sold, fled, won/lost, which key items kept). Each needs a flag or counter in the run record, so they are cheap data events with a `requires` clause.

**RE-B01 The Debt Collector** · U · M
Trigger: you took a "pay later" deal (loan, layaway, credit) 2+ stages ago. Scene: a polite figure waits at the node. Outcomes: pay in full (₽ cost, flag cleared), pay with an item (item taken, no interest), refuse (a fight vs the collector's team; win = debt voided). Reward/Cost: ₽ or a fight. Variations: debt grew with each skipped node.

**RE-B02 The Favour Returns** · U · M
Trigger: you helped an NPC (lost child, rescued Pokémon) earlier. Scene: they reappear with friends. Outcomes: accept thanks (item gift), ask for help (they join a fight once), decline (Bond +1 for humility). Reward/Cost: item or one-off ally. Variations: ally type matches the help you gave.

**RE-B03 Bridge You Burned** · U · M
Trigger: you fled or insulted a trainer earlier. Scene: they wait with a grudge. Outcomes: apologize (they let you pass), fight (their team gets +2 levels, bigger XP), bribe (₽). Reward/Cost: XP. Variations: the more insults, the larger the crew.

**RE-B04 Rumour of Your Deeds** · C · S
Trigger: any big flag (spared a boss, won a hard fight). Scene: townsfolk whisper. Outcomes: let them talk (reputation tag for the stage affects shop prices), correct them, play along (prices drop, fights are tougher). Reward/Cost: prices. Variations: rumours get exaggerated.

**RE-B05 Mirror of Mercy** · R · L
Trigger: you spared 3+ trainers or wild Pokémon this run. Scene: spared ones return in a line to thank you. Outcomes: accept (a cooperative blessing: heal party, shield for next fight), ask for aid (each one joins a boss fight for one move), turn away. Reward/Cost: blessing. Variations: includes the nemesis you spared.

**RE-B06 Mirror of Ruthlessness** · R · L
Trigger: you used the "ruthless" option 3+ times. Scene: shadowed figures watch from the trees. Outcomes: embrace (power buff, shops are more expensive), renounce (clears the tag, Bond +2), challenge them (win: a Dark relic). Reward/Cost: power vs prices. Variations: depends on the tally.

**RE-B07 The Gift You Gave Away** · U · S
Trigger: you gave a rare item to a stranger earlier. Scene: they come back wearing it to a fight. Outcomes: battle them (they use it, win = reclaim the item and a bonus), let them keep it (Bond +1), trade for something else. Reward/Cost: item return. Variations: the item evolved the NPC's Pokémon.

**RE-B08 The One You Left Behind** · R · L
Trigger: you released or abandoned a Pokémon this run. Scene: it reappears wild and wary. Outcomes: coax it back (may rejoin, level kept), battle it (catch like wild), leave it (becomes a wild guard later). Reward/Cost: recruit return. Variations: grudge level depends on how you left it.

**RE-B09 Interest on Your Mercy** · U · S
Trigger: you spared a Nemesis. Scene: a note arrives, "Thank you." Outcomes: read it (a hint where it hides), burn it, send a reply (it recruits itself at the Reckoning). Reward/Cost: advantage. Variations: Reckoning gets milder.

**RE-B10 Stolen Goods Come Home** · U · M
Trigger: you stole or kept something that wasn't yours. Scene: a Jenny-like officer knocks. Outcomes: return it (Bond ok), lie (50% caught: fined), flee (battle). Reward/Cost: fine. Variations: consequence scale by item value.

**RE-B11 Your Prank Backfires** · C · S
Trigger: you chose a "prank" option earlier. Scene: it comes around. Outcomes: laugh (neutral), pay (₽), exploit (reward, but the party disapproves). Reward/Cost: small. Variations: flavored by species.

**RE-B12 The Ones Who Watched You Win** · U · S
Trigger: you won a close battle (HP < 10%). Scene: a fan club lines up. Outcomes: sign autographs (₽ tips), ask for supplies (items), nap (heal). Reward/Cost: small. Variations: bigger for boss wins.

**RE-B13 Guilt at the Graveside** · U · M
Trigger: a Pokémon fainted permanently (hard mode) or a memorial exists. Scene: a quiet clearing, small stones. Outcomes: leave a tribute (Bond +1 party, flag), say nothing, dig (unearth a hidden relic: Bond -1). Reward/Cost: Bond. Variations: memorial species flower.

**RE-B14 Cashing In Your Reputation** · U · S
Trigger: reputation tag active. Scene: an NPC recognises you. Outcomes: ask a favour (free shop item), ask for a battle (stronger rewards), stay anonymous. Reward/Cost: depends on tag. Variations: tags: kind, ruthless, famous, infamous.

**RE-B15 A Promise Kept** · R · L
Trigger: you made a promise in an earlier event (e.g., return, deliver, protect) and the condition is met. Scene: the other party appears with trust. Outcomes: collect (big reward), waive it (Bond +2, their loyalty permanent), regret. Reward/Cost: reward. Variations: chains of three promises across a run.

**RE-B16 A Promise Broken** · U · M
Trigger: you broke a promise (didn't deliver). Scene: a sad figure on the road. Outcomes: apologise and repay (cost), explain (50/50), ignore (flag: -trust, shops hold items). Reward/Cost: trust. Variations: scales with the promise's size.

**RE-B17 The Shopkeeper Remembers** · C · S
Trigger: you bought a lot from one stall type. Scene: they offer a loyalty card. Outcomes: accept (10% off future there), refuse, haggle (better, but risk). Reward/Cost: discounts. Variations: card collectors.

**RE-B18 Choice Reversal Window** · R · M
Trigger: you made a regrettable irreversible choice. Scene: a Celebi-like glimmer offers a "second glance". Outcomes: accept (replay that event's choice screen once; result sticks), decline, trade something for it. Reward/Cost: re-do cost. Variations: once per save.

**RE-B19 The Rival Saw What You Did** · U · M
Trigger: you did a morally loaded action in front of the rival. Scene: they bring it up. Outcomes: explain (relationship shifts), shrug (rival cooler), apologise (warmer). Reward/Cost: relationship. Variations: rival personality sets the reaction.

**RE-B20 News of Your Win** · C · S
Trigger: win vs a boss. Scene: a newspaper vendor hawks your story. Outcomes: buy (keepsake clipping), correct them, ignore. Reward/Cost: ₽. Variations: headlines vary by approach.

**RE-B21 Feast of the Spared** · U · M
Trigger: you shared food with wild Pokémon earlier. Scene: they host a feast. Outcomes: join (heal + stat tilt), bring more berries (Bond +3), leave. Reward/Cost: berries. Variations: dishes by habitat.

**RE-B22 The Trap You Triggered Earlier** · C · S
Trigger: you ignored a warning sign. Scene: the delayed consequence hits (a snare, a hex). Outcomes: take it (minor damage), dodge with a stat check, use an item. Reward/Cost: small. Variations: matched to the warning.

**RE-B23 Credit Where It's Due** · U · S
Trigger: a team member carried a hard fight. Scene: someone praises it. Outcomes: accept for it (Bond +2), pass credit to the party (all +1), brag (rival jealous). Reward/Cost: Bond. Variations: if the carrier was a lowly species, bigger.

**RE-B24 Your Opponents Study You** · R · M
Trigger: you used the same strategy 5+ times. Scene: trainers counter your habit. Outcomes: adapt (switch tactics, bonus XP), double down (hard fight, bigger reward), study them back. Reward/Cost: XP. Variations: counters match the dominant move type.

**RE-B25 The Orphaned Egg's Parent** · R · L
Trigger: you took an abandoned egg earlier. Scene: a heartbroken figure appears. Outcomes: return it (large reward), keep it (a tough duel to keep it), share custody. Reward/Cost: egg fate. Variations: the egg already hatched? the owner meets the hatchling.

**RE-B26 Shortcuts Have Costs** · C · S
Trigger: you took a "short route" node earlier. Scene: the shortcut's toll arrives. Outcomes: pay, fight, flee. Reward/Cost: ₽. Variations: toll by region.

**RE-B27 The Tip That Paid Off** · U · S
Trigger: you tipped or bribed someone earlier. Scene: they pay it back with info. Outcomes: use the info (skip a node, see an upcoming event), trade it, ignore. Reward/Cost: preview. Variations: info quality varies.

**RE-B28 Friendly Fire Aftermath** · U · M
Trigger: an ally Pokémon was hit by your own move (in doubles). Scene: a flustered apology. Outcomes: shrug (Bond ok), apologise (Bond +1), blame (Bond -1). Reward/Cost: Bond. Variations: rare combos.

**RE-B29 Wounds That Taught You** · U · S
Trigger: party member survived at 1 HP twice. Scene: it develops a scar story. Outcomes: honour (Memory "Scarred but Standing"), hide, heal. Reward/Cost: Memory. Variations: scar cosmetic.

**RE-B30 The Boss Sends a Note** · U · M
Trigger: you beat a boss in a style (no items, speed, no losses). Scene: a messenger delivers a note. Outcomes: read it (boss hints about next boss), reply (rival tension), keep the note as a keepsake. Reward/Cost: hint. Variations: style flavours.

**RE-B31 Sunk Cost** · C · S
Trigger: you spent lots on an item you never used. Scene: a seller offers to buy it back. Outcomes: sell (half), use it now, keep. Reward/Cost: ₽ or use. Variations: item-specific.

**RE-B32 The Locked Door You Left** · U · M
Trigger: you skipped a key-locked event. Scene: someone offers the key. Outcomes: accept (return to the node? triggers a bonus node), decline, trade. Reward/Cost: key. Variations: only if the key exists.

**RE-B33 Whispers of the Fallen Party Member** · R · M
Trigger: a member lost earlier in this run (not revived). Scene: its ball glows at night. Outcomes: hold it (Bond +1; it can be revived at half cost), ignore, ask a priest (Revive for a price). Reward/Cost: revive discount. Variations: Ghost types respond.

**RE-B34 Unfinished Business** · U · M
Trigger: you left a node unresolved (ran away). Scene: they follow you. Outcomes: face it (fight + reward), bribe, bypass. Reward/Cost: XP. Variations: strength rises each time.

**RE-B35 The Watcher's Verdict** · R · L
Trigger: end of a region with strong tags. Scene: a Watcher weighs your path. Outcomes: accept the verdict (a title for the run, small passive effect), contest, ignore. Reward/Cost: a title. Variations: titles like "The Merciful", "The Swift".

**RE-B36 Reunion With the Merchant You Cheated** · U · M
Trigger: you stole from a merchant. Scene: they return with guards. Outcomes: pay back, fight guards, vanish. Reward/Cost: ₽. Variations: they sell nothing to you for the rest of the stage.

**RE-B37 Your Biggest Win's Anniversary** · C · S
Trigger: after 3 stages since the run's best fight. Scene: the party recalls it. Outcomes: toast (Bond +1), re-enact (small XP), skip. Reward/Cost: Bond. Variations: references the exact opponent.

**RE-B38 Chain Reaction** · R · M
Trigger: 3 related choices made across the run (e.g., 3 acts of kindness). Scene: the world nudges. Outcomes: a "kindness cascade" event (NPC hosts a feast), an "alliance" (permanent ally), a "legend" (a trainer's story about you). Reward/Cost: ally. Variations: cascades for cruelty, curiosity, honour.

**RE-B39 Leftover Curse** · U · M
Trigger: you touched a cursed idol earlier. Scene: bad luck echoes. Outcomes: purify (cost), endure (minor debuffs), pass it on (a risk). Reward/Cost: debuff. Variations: lifts after two nodes.

**RE-B40 Roadside Memorial to You** · M · M
Trigger: you wiped in a previous run at this node type. Scene: a small shrine bears your trainer name. Outcomes: pray (Bond +1), take the offering (loot, curses), add to it (Legacy mark). Reward/Cost: Legacy. Variations: other runs' name appears.

**RE-B41 The Gambler's Ledger** · U · S
Trigger: you gambled 3+ times this run. Scene: the house keeps score. Outcomes: cash out (net winnings), press on (double or lose), quit (bonus for self-control). Reward/Cost: ₽. Variations: skews with luck.

**RE-B42 Kind Words Spoken Long Ago** · U · S
Trigger: you spoke kindly in dialogue choices. Scene: a stranger repeats your phrase. Outcomes: accept (Bond +1), ask who told them (a branching chain), leave. Reward/Cost: Bond. Variations: spreads.

**RE-B43 The Trial of the Third Choice** · R · L
Trigger: you consistently picked the "middle" option. Scene: a guardian tests your moderation. Outcomes: pass (special reward), fail (nothing), push to extremes. Reward/Cost: reward. Variations: for extreme players, a counter test.

**RE-B44 Locked in By Your Own Rules** · U · M
Trigger: challenge rule on (e.g., no healing items). Scene: a tempting offer breaks the rule. Outcomes: accept (rule broken, flagged), decline (bonus achievement progress), ask. Reward/Cost: rule pride. Variations: per rule.

**RE-B45 Blood-Debt Cleared** · VR · L
Trigger: a nemesis's debt flag after 3 victories. Scene: it lays down arms. Outcomes: forgive (becomes ally), refuse (it flees), duel one last time. Reward/Cost: ally. Variations: Legacy mention.

**RE-B46 Shadow of Past Dealings** · U · M
Trigger: you traded with a villain earlier. Scene: the boss sees you. Outcomes: lie (50% fail), confess (battle), bribe (₽). Reward/Cost: ₽. Variations: villain team specific.

**RE-B47 Harvest of What You Planted** · U · M
Trigger: you planted a berry or a seed earlier. Scene: it's grown. Outcomes: harvest (items), leave it for wild Pokémon (Bond), study it (Memory). Reward/Cost: items. Variations: tree type by berry.

**RE-B48 Tabs Open** · C · S
Trigger: you left a bill at a restaurant. Scene: the owner finds you. Outcomes: pay, work it off (mini-game), run. Reward/Cost: ₽. Variations: flavour.

**RE-B49 Consequences of the Easy Way** · U · M
Trigger: you took the easiest route 4 times. Scene: a mentor says "this won't hold". Outcomes: accept the hard path (bonus stat later), mock them, ignore. Reward/Cost: stat. Variations: tied to the Mastery tracker.

**RE-B50 The Whistleblower** · U · M
Trigger: you exposed a shady dealer earlier. Scene: a reward ceremony or threats. Outcomes: accept the reward, hide, take protection. Reward/Cost: item or fight. Variations: both.

**RE-B51 Public Opinion Poll** · C · S
Trigger: after 2 stages. Scene: a pollster asks the town to vote on your actions. Outcomes: cheer, boo, leave. Reward/Cost: reputation. Variations: poll mirrors actual choices.

**RE-B52 Salvage From the Disaster** · U · S
Trigger: you wiped a party member in a disaster event. Scene: a scavenger offers a deal. Outcomes: buy their wares, give them to charity, haggle. Reward/Cost: items. Variations: small.

**RE-B53 Your Name on the Wall** · R · M
Trigger: you completed three achievements in one run. Scene: a hall records your name. Outcomes: sign, leave a message (appears for future runs), vandalise. Reward/Cost: Legacy message. Variations: other players' messages appear.

**RE-B54 The Cost of the Second Chance** · U · M
Trigger: you used a Revive Seed or an "undo" this run. Scene: the world feels thin. Outcomes: accept the price (lose a turn), pay in items, deny. Reward/Cost: small. Variations: stacking.

**RE-B55 The Tutor Remembers** · U · S
Trigger: you taught a move earlier. Scene: the tutor invites an advanced lesson. Outcomes: pay for advanced (a higher move), decline, ask for a rebate. Reward/Cost: ₽. Variations: per move tutor.

**RE-B56 The Gym Rat's Debut** · C · S
Trigger: you trained a lot at gyms. Scene: new trainers challenge you. Outcomes: accept (XP), decline, coach. Reward/Cost: XP. Variations: scale.

**RE-B57 Double Dipping** · U · S
Trigger: you claimed rewards twice from a similar event. Scene: someone notices. Outcomes: confess (keep), deny (lose one), shift blame. Reward/Cost: small. Variations: flavour.

**RE-B58 What The Party Learned** · C · M
Trigger: end of a stage. Scene: a quiet summary of Lessons. Outcomes: pick a lesson (small stat tilt matching your approach), skip, share. Reward/Cost: tilt. Variations: lesson text reflects the stage.

**RE-B59 The Guilty Conscience** · U · M
Trigger: you harmed a wild Pokémon unnecessarily. Scene: something follows at night. Outcomes: make amends (nature spot, item), ignore (sleep disturbed), confess to the party. Reward/Cost: rest quality. Variations: matches the species.

**RE-B60 Debt of Honour** · R · L
Trigger: a rival or trainer spared you in a duel earlier. Scene: they ask you to repay it. Outcomes: honour it (a special request), refuse, repay in double. Reward/Cost: favour. Variations: depends on their personality.

**RE-B61 The Rumour Mill's Verdict** · U · S
Trigger: tag combos. Scene: a street kid reports "what people say about you". Outcomes: laugh, correct, pay to change it. Reward/Cost: ₽. Variations: funny titles.

**RE-B62 A Cascade of Thank-Yous** · VR · M
Trigger: 5+ helped NPCs this run. Scene: all of them show up at the same node. Outcomes: celebrate (full-party heal, stat tilt), ask each for a gift (a pile of items), step aside. Reward/Cost: large. Variations: uses every NPC you met.

**RE-B63 Old Maps, New Roads** · U · M
Trigger: you bought a map earlier. Scene: it reveals a discrepancy. Outcomes: follow (a bonus node), trust the road, compare. Reward/Cost: bonus node. Variations: hidden node.

**RE-B64 Your Side Hustle Pays** · C · S
Trigger: part-time event done earlier. Scene: a client returns. Outcomes: take the job (₽), refer a friend, decline. Reward/Cost: ₽. Variations: vary the job.

**RE-B65 The Town That Changed Because of You** · VR · L
Trigger: a town you helped saved/fixed earlier (3+ stages ago). Scene: you return to a new town. Outcomes: tour (free perks), inaugurate a statue (Legacy flag), leave. Reward/Cost: perks. Variations: lasts rest of the run.

**RE-B66 Hindsight** · U · S
Trigger: a loss. Scene: the party reviews a replay. Outcomes: analyse (reveals next opponent's weakness), shrug, argue. Reward/Cost: info. Variations: one-off.
