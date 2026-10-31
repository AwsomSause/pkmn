# Whole-Game Events A: Permanent World Changes (GWE-A01 to A36)

Part of the Whole-Game Events library (initiative 3). Index and priorities: `game-events-00-index.md`.
These expand `ideas/game-events.md` (which holds ~234 short weekly/seasonal one-liners). Nothing here repeats those or the 21 built events; these are the **big, persistent** kind: they change the world across many runs. Design only, nothing is approved.

Legend. **Scope**: how long it lasts. **Rar**: C common, U uncommon, R rare, XR extremely rare. **Cx**: S/M/L/XL build size. Everything stays seeded and deterministic: world state lives in a new profile record (`world`, versioned, Zod-validated) and is derived from profile history plus the date seed, never from animation or gameplay RNG.

---

## A1. Landscape and Map Changes

**GWE-A01 The Rebuilt Bridge.** *Trigger:* clear the same bridge-blocked region 5 times. *Scope:* permanent. A construction crew appears in the Hub letters; after a few runs the bridge opens a new shortcut stop on that region's map. *Experience:* a slow visible build, one plank more per run, then a ribbon-cutting with the crew's foreman Pokémon. *Pay:* a new map branch (skip one stop, lose one shop). *Rar/Cx:* U/M. *Ties:* map generator, Hub letters. *Watch:* shortcut must not skip bosses.

**GWE-A02 The Great Thaw.** *Trigger:* 50 Fire-type wins across all runs. *Scope:* permanent, one-way. Ice routes in two regions melt into marshes; Ice wild pools shrink, Water/Bug pools grow. *Experience:* the map art swaps, a "Thaw" entry joins the Chronicle. *Pay:* new Marsh biome. *Rar/Cx:* R/L. *Ties:* encounter tables, biome art. *Watch:* never delete an old Ice-only unlock; keep a frozen "Glacier Archive" stop.

**GWE-A03 Flooded Valley.** *Trigger:* a Kyogre/Water raid is beaten at least twice. *Scope:* 12 runs, then recedes. A valley becomes a lake; stops turn into boat stops where Water types lead and walkers lose a move of speed. *Pay:* Water-only rare spawns; Lapras ferry cameo. *Rar/Cx:* R/M. *Ties:* raids, weather.

**GWE-A04 Tunnel Under the Mountain.** *Trigger:* 25 Ground/Rock/Steel Pokémon in Hall of Fame teams. *Scope:* permanent. Miners dig a tunnel that links two regions' route graphs, giving a rare cross-region run option. *Pay:* a run may start "between" regions with mixed pools. *Rar/Cx:* R/L. *Ties:* region order, levels-and-regions plan.

**GWE-A05 The Lighthouse Relit.** *Trigger:* complete three Rescue-at-sea events across runs. *Scope:* permanent. A lighthouse on the Hub shoreline lights; at night a Water-region route reveals one hidden stop. *Pay:* free Reveal once per run. *Rar/Cx:* U/S. *Ties:* hidden stops, Hub scene.

**GWE-A06 Desert Sinks / Desert Blooms.** *Trigger:* a global tally of Grass vs Ground wins decides the winner of a "monthly" tug. *Scope:* 30 days, repeating. The desert region shows either quicksand mazes or flower fields until the next tally. *Pay:* matching rare spawn set. *Rar/Cx:* C/M. *Ties:* date seed, type tallies. *Watch:* use the player's own tallies so it stays offline.

**GWE-A07 Overgrown Ruins.** *Trigger:* 100 days since you last visited a ruin stop (calendar time). *Scope:* until revisited. Vines swallow the ruin; returning lets you cut your way in, unlocking an old reward cache that has been "growing". *Pay:* cache scales with days away (capped). *Rar/Cx:* U/S. *Ties:* ruins events.

**GWE-A08 Ghost Town Reopens.** *Trigger:* Ghost-type story chain stage 3 (see B-series). *Scope:* permanent. A ghost town becomes a stop type that appears in any region. *Pay:* Ghost-only shop, séance event. *Rar/Cx:* R/M.

**GWE-A09 The Cursed Bell Rings.** *Trigger:* one specific bell stop visited at midnight local time on the 13th. *Scope:* 24 hours. Every map gains a tolling bell; each bell toll swaps one random wild encounter to a Ghost. *Pay:* "Bell Cursed" cosmetic if survived. *Rar/Cx:* XR/S.

**GWE-A10 A New Region Appears on the Horizon.** *Trigger:* all current regions cleared by the profile. *Scope:* permanent. A foggy silhouette sits on the world map; each run adds fog-clearing progress by 1 until a new region unlocks. *Pay:* region unlock is the long-term carrot. *Rar/Cx:* R/XL. *Ties:* levels-and-regions plan (+50 levels per region).

**GWE-A11 The Hub Gets a Second Floor.** *Trigger:* Hub upgrades fully bought. *Scope:* permanent. A staircase appears; the upstairs holds a trophy loft that displays real run keepsakes in 3D shelves. *Rar/Cx:* U/M. *Ties:* museum, Legacy gallery.

**GWE-A12 Hub Garden Overgrows.** *Trigger:* 30 runs without planting berries. *Scope:* until you tend it. Weeds pull a small friendship-gain penalty from Hub idle Pokémon; weeding is a mini-ritual that rewards seeds. *Rar/Cx:* C/S. *Ties:* Hub, berries.

**GWE-A13 The Moving Gym.** *Trigger:* a gym leader beaten by Speed sweep 3 times. *Scope:* permanent. That gym moves location each run (it is on wheels); the leader's team gets a mobility kit. *Rar/Cx:* U/M. *Ties:* gym order, trainer tiers.

**GWE-A14 Ferry Network.** *Trigger:* 10 coastal region clears. *Scope:* permanent. Ferries link coastal regions: an optional "Ferry Run" travels two regions in one go with a combined boss. *Rar/Cx:* R/L.

**GWE-A15 The Wall of Names.** *Trigger:* first Hall of Fame entry. *Scope:* permanent, grows. A town wall carves each Hall of Fame team's names; walking past reacts to Pokémon you own. *Pay:* a touch-up lets you leave one message to your future self. *Rar/Cx:* C/S. *Ties:* Hall of Fame.

**GWE-A16 Eroded Coastline.** *Trigger:* 200 total Water moves used on one region. *Scope:* permanent. Beaches shrink; two coastal stops merge into a single tide-pool stop. *Rar/Cx:* U/S.

**GWE-A17 Volcano Wakes.** *Trigger:* a Fire legend defeated. *Scope:* 20 runs. Lava lines the border of one region; lava stops deal chip damage but drop fire stones. *Pay:* Fire evolution items. *Rar/Cx:* R/M. *Watch:* chip damage must be opt-in for runs that choose Careful mode.

**GWE-A18 Shifting Seasons Region.** *Trigger:* automatic. *Scope:* permanent. One region runs a four-run seasonal loop independent of the calendar (spring, summer, autumn, winter by run count), so each visit looks different. *Rar/Cx:* U/M. *Ties:* biome art, seasonal forms.

**GWE-A19 The Crater Lake.** *Trigger:* a meteorite event occurs 3 times. *Scope:* permanent. A crater appears; its centre is a rare dig site that rewards space-themed items (Moon Stone, Meteorite chunk). *Rar/Cx:* R/S. *Ties:* meteorite-crash map event.

**GWE-A20 Cable Car Lines.** *Trigger:* 15 Flying/Psychic teams. *Scope:* permanent. Cable cars connect mountain stops, adding a vertical branch; falling is an unlucky roll but never lethal. *Rar/Cx:* U/M.

**GWE-A21 The Library Opens.** *Trigger:* 100 Pokédex entries registered. *Scope:* permanent. A library appears in the Hub; reading unlocks "lore bundles" that grant tiny permanent hints (e.g. a boss' weakness text). *Rar/Cx:* U/M. *Ties:* Moment codex, memories.

**GWE-A22 Cavern Collapse.** *Trigger:* a cave stop hit 40 times. *Scope:* permanent but reversible by event. The cave can collapse mid-run: rescue Rock/Ground teammates dig you out for a bonus; otherwise a detour. *Rar/Cx:* U/S.

**GWE-A23 Fog Never Lifts.** *Trigger:* a forest region fails 3 times in a row. *Scope:* until cleared. Fog thickens each loss, hiding stop names until you win; victory lifts it with a "Clearing" cutscene. *Rar/Cx:* U/S. *Ties:* narrative defeat.

**GWE-A24 Orchard Grows.** *Trigger:* 500 berries eaten. *Scope:* permanent. An orchard stop type appears: pick a berry for a held buff; trees evolve by years of play (real days). *Rar/Cx:* U/S.

**GWE-A25 The Telescope Observatory.** *Trigger:* 20 Stargazing sightings. *Scope:* permanent. Observatory stop allows a one-time peek at the next boss team's *types* per run. *Rar/Cx:* R/S.

**GWE-A26 Rail Line Across Regions.** *Trigger:* hub rail upgrade. *Scope:* permanent. Train stops allow carry-over of one item to the next region (limited slot). *Rar/Cx:* U/M.

**GWE-A27 Haunted Mansion Wing.** *Trigger:* 10 Ghost team wins. *Scope:* permanent. A new mansion wing appears whenever a nemesis fell there; wings hold nemesis trophies. *Rar/Cx:* U/M. *Ties:* nemesis system.

**GWE-A28 Training Arena Expansion.** *Trigger:* Hub training maxed. *Scope:* permanent. Arena adds a "gauntlet room" for pre-run drills that preview a boss's first move. *Rar/Cx:* U/M.

**GWE-A29 Graffiti Wall.** *Trigger:* any rival wins 3 times against you. *Scope:* permanent. Your rival graffities the Hub wall; beating them lets you paint over it with your own symbol. *Experience:* a tiny wall that records rivalry state visually. *Rar/Cx:* U/S. *Ties:* rivalry kinds.

**GWE-A30 Floating Islands.** *Trigger:* Sky Pillar legend completed. *Scope:* permanent. Floating-island stops appear in any region, only reachable by Flying/Levitate members. *Rar/Cx:* R/M.

**GWE-A31 Snowed-In Season.** *Trigger:* winter calendar dates. *Scope:* weeks. Routes close one at a time: a "snowed-in" stop is skipped, forcing different paths. *Rar/Cx:* C/S.

**GWE-A32 Sinkhole City.** *Trigger:* 5 Sinkhole map events. *Scope:* permanent. Sinkhole stops reveal an underground city, a distinct 3-stop mini-map with unique merchants. *Rar/Cx:* R/L.

**GWE-A33 Crop Circles.** *Trigger:* 3 Psychic legend sightings. *Scope:* 1 run window. Crop circles appear at random map stops; stepping inside triggers an alien-abduction rule change for that battle. *Rar/Cx:* XR/S.

**GWE-A34 The Border Wall Falls.** *Trigger:* both factions in a conflict reach peace (see E-series). *Scope:* permanent. Two regions' maps merge border routes. *Rar/Cx:* R/L.

**GWE-A35 Neon Takeover.** *Trigger:* Cyber-Maximalism cosmetic unlocked. *Scope:* permanent toggle. A neon "city mode" reskins one region with Frutiger Aero/Cyber UI aesthetics. *Rar/Cx:* U/M. *Ties:* visual style guide.

**GWE-A36 The Garden of Remembered Pokémon.** *Trigger:* 20 Pokémon retired to the Hall of Fame. *Scope:* permanent. A garden in the Hub grows one flower per retired Pokémon, coloured by their types; wandering Pokémon from past runs visit as ghost sprites. *Rar/Cx:* U/M. *Ties:* Legacy, memories.
