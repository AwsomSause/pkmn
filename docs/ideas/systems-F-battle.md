# Systems F: Battle mechanics, presentation and battle AI structure (SYS-F01 to SYS-F70)

Legend as in file A. Existing code touched: `core/battle/*`, `core/drama`, `core/presentation`, `ui/battleFx`, `scenes/BattleScene.ts`, `core/raid`, `core/totem`, `core/bossBands.ts`, `core/threat.ts`, `docs/status/battle-drama-spectacle.md`, `anim-registry.md`. Rule from CLAUDE.md: outcomes never depend on animation; presentation cues only.

## F1. Core battle structure changes

**SYS-F01 Battle Phases (Opening, Midgame, Endgame) ★F** · N · C:L · P:High
Battles are tracked in named phases triggered by HP totals and turn counts; phases change music layers, AI aggression, and unlock phase-specific moves/relics. Deps: drama engine, music layers. Impact: pacing, a shared hook for presentation. Balance: phase effects tiny (+1 Speed tier at Endgame).

**SYS-F02 Initiative Ribbon** · O · C:L · P:Med
Replace turn order text with a visible ribbon of upcoming actors that updates with speed changes and priority. Deps: battle UI. Impact: legibility, strategic planning. Balance: none.

**SYS-F03 Momentum Chains** · N · C:M · P:Med
Consecutive KOs or crits build a Momentum chain that grants one "Surge" action (free switch, extra priority) and ends if the chain is broken. Deps: F01. Impact: swingy comeback. Balance: Surge once per battle.

**SYS-F04 Battlefield Zones** · N · C:L · P:Med
A 3-zone field (front, mid, back) for doubles/triples; positions matter for spread moves and assists. Deps: doubles. Impact: positional play. Balance: auto-positioned by default.

**SYS-F05 Commit and Reveal Turns** · X · C:L · P:Exp
Optional mode where both sides lock actions simultaneously and reveal with a flourish; AI bluffing meets player prediction. Deps: C29. Impact: mind games. Balance: mode only.

**SYS-F06 Action Economy Rework: Bonus Actions** · O · C:L · P:Exp
Each mon gains a Bonus Action slot (use item, switch ally's position, taunt) fueled by Resolve; main action unchanged. Deps: C03. Impact: more choices per turn. Balance: Resolve gating.

**SYS-F07 Telegraphed Hits** · N · C:M · P:Med
Bosses and some trainers announce a big attack one turn ahead (a "Windup") that can be countered by specific play. Deps: boss director. Impact: puzzle-like fights. Balance: windup damage fair.

**SYS-F08 Interrupt Windows** · N · C:M · P:Med
Priority and quick moves can interrupt Windups and charge moves. Deps: F07. Impact: depth. Balance: visible rule.

**SYS-F09 Terrain Control Meter** · N · C:M · P:Low
Each side contests terrain control; the leader decides which field effects hold. Deps: field effects. Impact: layered strategy. Balance: capped.

**SYS-F10 Formation Presets** · N · C:S · P:Low
Preset positions for lead/anchor/closer influence AI and passives. Deps: partyRoles. Impact: preparation. Balance: small.

**SYS-F11 Reaction Moves** · N · C:L · P:Med
Moves flagged Reaction trigger when hit by matching attacks (Parry, Reflect Light) using Resolve. Deps: C03. Impact: reactive play. Balance: limited.

**SYS-F12 Battle Clock** · X · C:M · P:Exp
Optional soft timer on decisions for speed modes. Deps: modes. Impact: tension. Balance: accessible default off.

**SYS-F13 Stalemate Breakers** · N · C:M · P:Med
Long stalls trigger escalating field effects (Sudden Storm, Ember Rain) so fights resolve. Deps: bot reports. Impact: fixes boring loops. Balance: escalation gentle.

**SYS-F14 Overtime Rule** · N · C:S · P:Low
After turn 30, damage scales gently. Deps: F13. Impact: pacing. Balance: bounded.

**SYS-F15 Sacrifice Plays** · N · C:M · P:Med
Voluntarily fainting a mon (with a trigger) passes buffs/heals to allies ("last gift"). Deps: bond. Impact: dramatic decisions. Balance: tiers.

**SYS-F16 Tag-In Combos** · N · C:M · P:Med
Switching in right after a KO grants a free move if bond high. Deps: B23. Impact: rewarding comebacks. Balance: once per battle.

**SYS-F17 Escape Choreography** · N · C:S · P:Low
Fleeing has outcomes (clean, scuffed, chased), not a binary roll. Deps: flee logic. Impact: drama. Balance: reasonable.

**SYS-F18 Surrender and Negotiate** · N · C:M · P:Low
Some foes accept parley mid-fight on low HP or bond. Deps: C18. Impact: variety. Balance: smaller rewards.

**SYS-F19 Battlefield Hazards as Resources** · N · C:M · P:Low
Spikes-like hazards persist across battles in a gauntlet if not cleared. Deps: gauntlet. Impact: resource. Balance: clear item.

**SYS-F20 Weather Fronts in Battle** · E · C:M · P:Low
A front rolls in mid-battle, changing weather at a known turn. Deps: E46. Impact: tactics. Balance: forecast shown.

## F2. Move, type and ability system expansions

**SYS-F21 Move Tags and Interactions Matrix ★F** · O · C:L · P:High
Moves gain tags (Sound, Blade, Wind, Beam, Contact, Powder, Fang, Ground-bound) and abilities/items/fields interact via tags rather than hardcoded lists. Deps: move data, abilities. Impact: scalable content, new combos. Balance: audited by tag report.

**SYS-F22 Elemental Reactions Lite** · N · C:M · P:Med
Combos between field states and moves (Water + Electric amplifies, Fire + Grass spreads). Deps: F21. Impact: experimentation. Balance: capped multipliers.

**SYS-F23 Move Mutations** · N · C:M · P:Med
Rarely a move "mutates" for a run (Flamethrower: Spread) from mastery. Deps: moveMastery. Impact: individual movesets. Balance: sidegrade.

**SYS-F24 Ability Duality** · E · C:M · P:Med
Abilities have an Active mode triggered with Resolve for a short window. Deps: C03. Impact: depth. Balance: cooldown.

**SYS-F25 Type Chart Variants by Region** · N · C:M · P:Low
Optional regional charts changing a few matchups for challenge. Deps: regions. Impact: replay. Balance: displayed clearly.

**SYS-F26 Stat Stage Rework Options** · X · C:M · P:Exp
Alternate stage systems (additive, capped, decaying). Deps: battle engine. Impact: balance tuning. Balance: opt-in mode.

**SYS-F27 Status Conditions Layered** · E · C:M · P:Med
Statuses have levels (Burn I/II/III) with different effects and cures. Deps: status system. Impact: richness. Balance: slow ramp.

**SYS-F28 Combination Statuses** · N · C:M · P:Low
Two statuses merge into named states (Burn + Poison = Rot). Deps: F27. Impact: emergent. Balance: rare.

**SYS-F29 Signature Move Sets for Mastery** · E · C:M · P:Med
Mastery unlocks signature variants per species (Pikachu's Volt Tackle revision). Deps: mastery. Impact: species identity. Balance: audited.

**SYS-F30 Priority Lanes** · N · C:M · P:Low
Visual lanes for priority brackets; new brackets for specific tag moves. Deps: F02. Impact: clarity. Balance: none.

**SYS-F31 Charge and Release** · N · C:M · P:Med
Some moves can be held and released later with escalating power at a cost. Deps: F07. Impact: timing. Balance: hold risk.

**SYS-F32 Stance Moves** · N · C:M · P:Med
Stance toggles (Aggressive/Defensive) as free actions per turn with trade-offs. Deps: F06. Impact: toggles. Balance: simple.

**SYS-F33 Combo Moves From Assists** · N · C:L · P:Med
Specific pairs (Water + Electric) unlock named combos with cutscenes. Deps: B23. Impact: spectacle. Balance: limited.

**SYS-F34 Environmental Moves** · N · C:M · P:Low
Moves that shape terrain (Dig leaves a hole) with persistent per-battle effect. Deps: F09. Impact: puzzle. Balance: minor.

**SYS-F35 Reversible Moves / Undo** · X · C:M · P:Exp
Limited "rewind" token to undo one turn. Deps: determinism. Impact: accessibility or hard mode relief. Balance: one per run.

## F3. Presentation systems

**SYS-F36 Cinematic Camera Director ★F** · N · C:L · P:High
A camera director consumes presentation cues (crit, KO, phase change) and chooses shots (push-in, dutch angle, pan) with intensity settings. Never alters outcomes. Deps: presentation cues, settings. Impact: spectacle. Balance: motion settings gate.

**SYS-F37 Dynamic Battle Music Mixer** · N · C:M · P:High
Layered stems fade in per phase/HP/status; low HP adds heartbeat; victory stinger resolves tonally. Deps: audio. Impact: emotion. Balance: volume cap.

**SYS-F38 Move Animation Grammar** · O · C:L · P:High
Animations assembled from grammar parts (charge, travel, impact, aftermath) across types for scalable coverage when custom animations are missing. Deps: anim-registry. Impact: complete coverage. Balance: motion settings.

**SYS-F39 Impact Frames and Hit-stop** · N · C:S · P:Med
Hit-stop frames and screen flash scale with damage. Deps: settings. Impact: feel. Balance: reduced-motion option.

**SYS-F40 Commentary Ticker** · N · C:M · P:Low
Optional sidebar commentary lines reacting to the fight with personalities. Deps: C60. Impact: color. Balance: toggle.

**SYS-F41 Kill-cam Replays** · N · C:M · P:Med
After boss KOs, optionally replay the last move in slow motion with camera. Deps: replay. Impact: payoff. Balance: skippable.

**SYS-F42 Trainer Sprite Reactions** · N · C:M · P:Med
Trainer portraits react (gasp, smirk, sweat) driven by drama cues. Deps: portraits. Impact: expression. Balance: none.

**SYS-F43 Environmental Reactions** · N · C:M · P:Low
Backgrounds react (lights flicker, crowd cheers). Deps: arenaStyle. Impact: life. Balance: setting.

**SYS-F44 Battle Intros by History** · L · C:M · P:Med
Intros adapt to the foe's history (rival taunts, nemesis scowl, crowd boos). Deps: D21. Impact: story. Balance: skippable.

**SYS-F45 Result Cards and MVP** · N · C:S · P:Low
Post-battle MVP card with a stat line and mon pose. Deps: recap. Impact: reward. Balance: none.

**SYS-F46 Post-Battle Banter** · N · C:M · P:Med
Short bursts of party banter after fights seeded by events. Deps: dialogue packs. Impact: life. Balance: skippable.

**SYS-F47 Accessibility Presentation Profiles** · E · C:M · P:High
Bundled presentation profiles (Calm, Standard, Spectacle, Screen-reader) in one tap. Deps: settings. Impact: onboarding. Balance: none.

**SYS-F48 Damage Number Styles** · N · C:S · P:Low
Selectable styles (classic, comic, minimal). Deps: UI. Impact: taste. Balance: none.

**SYS-F49 Photo Mode In Battle** · N · C:M · P:Low
Freeze, rotate, pose; export card. Deps: photo mode. Impact: sharing. Balance: none.

**SYS-F50 Battle Log as Story** · O · C:M · P:Med
Log rendered as rich narrative lines (with context) with raw view toggle. Deps: log. Impact: readability. Balance: none.

## F4. Boss, raid and enemy-structure systems

**SYS-F51 Boss Anatomy Zones** · N · C:L · P:Med
Bosses have targetable zones (wing, core) broken by specific moves to alter later phases. Deps: raid. Impact: tactics. Balance: reset between phases.

**SYS-F52 Boss Personalities Alter Phases** · L · C:M · P:Med
A boss's mood (from history) alters phase scripts. Deps: C49. Impact: variation. Balance: bounded.

**SYS-F53 Raid Roles Expanded** · E · C:M · P:Med
Roles: Taunter, Breaker, Healer, Wildcard with passive bonuses. Deps: raid. Impact: team building. Balance: fine.

**SYS-F54 Raid Lobby Bots with Personalities** · E · C:M · P:Low
Allied bots with AI personalities and chatter. Deps: C26. Impact: social. Balance: simple.

**SYS-F55 Boss Shield Variants** · E · C:M · P:Low
Shield types (Type, Status, Move class) forcing variety. Deps: raid. Impact: team diversity. Balance: tracked.

**SYS-F56 Boss Enrage Narratives** · N · C:S · P:Low
Enrage comes from story reasons (injured pride). Deps: drama. Impact: coherence. Balance: same math.

**SYS-F57 Environmental Boss Arenas** · N · C:L · P:Med
Arenas with interactive hazards the player can trigger. Deps: arenaStyle. Impact: spectacle. Balance: telegraph.

**SYS-F58 Minion Waves** · N · C:M · P:Low
Boss summons minions; killing certain ones unlocks weaknesses. Deps: raid. Impact: variety. Balance: bounded.

**SYS-F59 Duel Mode** · N · C:M · P:Low
1v1 formal duels with formal rules for rivals; special rewards. Deps: rivals. Impact: ceremony. Balance: fair.

**SYS-F60 Battle Royale Arena** · X · C:L · P:Exp
Multi-trainer free-for-all node; alliances and betrayals. Deps: AI personalities. Impact: chaos. Balance: reward capped.

## F5. Battle structure experiments

**SYS-F61 Asymmetric Fights** · N · C:M · P:Med
One strong mon vs three weaker ones with objectives. Deps: boss data. Impact: variety. Balance: scored.

**SYS-F62 Objective Battles** · N · C:L · P:High
Fights with goals besides KO (protect NPC, survive 8 turns, steal item). Deps: modeObjectives. Impact: variety. Balance: fail gives partial.

**SYS-F63 Puzzle Battles** · N · C:L · P:Med
Preset scenarios with single solutions in the hub. Deps: sandbox. Impact: tactical training. Balance: optional.

**SYS-F64 Rhythm Battle Layer** · X · C:L · P:Exp
Optional timing minigame boosts move potency. Deps: minigames. Impact: tactile. Balance: off by default.

**SYS-F65 Co-op Control of Ally Bots** · X · C:L · P:Exp
Shared control with a second player (hot-seat). Deps: modes. Impact: social. Balance: normal.

**SYS-F66 Spectator Mode for Replays** · N · C:M · P:Low
Watch any recorded battle with tool overlays. Deps: replay files. Impact: learning. Balance: none.

**SYS-F67 Battle Variants Library** · N · C:M · P:Med
Named variants (Mirror Match, Sudden Death, Trick Room Day) selectable as run modifiers or events. Deps: modifiers. Impact: variety. Balance: audited.

**SYS-F68 Training Simulator** · N · C:L · P:Med
Hub simulator where you build teams and run bot matches with reports. Deps: playtest bot. Impact: theorycrafting. Balance: none.

**SYS-F69 Opponent Style Cards** · N · C:S · P:Low
Short pre-battle cards describing an enemy's style. Deps: C37. Impact: planning. Balance: partial.

**SYS-F70 Live Rule Cards** · N · C:M · P:Med
A card drawn at battle start (one-sided or shared) adds a temporary rule. Deps: F67. Impact: replay. Balance: rarity-tied.
