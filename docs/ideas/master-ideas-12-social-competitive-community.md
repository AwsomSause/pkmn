# Master Idea Library 12: Social, Competitive & Community (SC-001 to SC-080)

Legend and fields as in file 01. Design only. The game is a static browser build with no backend, so most ideas have an "offline-first" form (share codes, files, links) and an optional online form. Backend-dependent ideas are marked XL.

## A. Sharing without servers

**SC-001 Run Codes** — Every run exports a compact code others can replay or inspect. *Trigger:* run end. *Feel:* easy sharing. *Rarity:* Always. *Cx:* M. *Deps:* seeds, determinism. *Balance:* none.

**SC-002 Team Share Strings** — Copy a team as text for friends to import as a challenge. *Trigger:* menu. *Feel:* community. *Rarity:* Always. *Cx:* S. *Deps:* save. *Balance:* import validated.

**SC-003 Replay Files** — Export deterministic replays viewable by anyone. *Trigger:* run end. *Feel:* showcase. *Rarity:* Always. *Cx:* L. *Deps:* determinism. *Balance:* none.

**SC-004 Ghost Teams** — Import a friend's team as a ghost opponent. *Trigger:* menu. *Feel:* friendly rivalry. *Rarity:* Always. *Cx:* M. *Deps:* team share. *Balance:* tuned.

**SC-005 Postcard Exchange** — Send in-game postcards via links that unlock cosmetics. *Trigger:* menu. *Feel:* delight. *Rarity:* Always. *Cx:* M. *Deps:* links. *Balance:* none.

**SC-006 Seed Of The Day Boards** — Shared seed with local score boards via QR. *Trigger:* date. *Feel:* friendly compete. *Rarity:* Daily. *Cx:* M. *Deps:* seeds. *Balance:* none.

**SC-007 Mod Pack Support** — Load data packs (trainers, species) with validation. *Trigger:* menu. *Feel:* community content. *Rarity:* Always. *Cx:* XL. *Deps:* Zod data. *Balance:* flagged.

**SC-008 Event Pack Sharing** — Share custom events as JSON. *Trigger:* menu. *Feel:* creative. *Rarity:* Always. *Cx:* L. *Deps:* event schema. *Balance:* sandboxed.

**SC-009 Trainer Card Links** — Link that renders your trainer card. *Trigger:* menu. *Feel:* identity. *Rarity:* Always. *Cx:* M. *Deps:* trainer card. *Balance:* none.

**SC-010 Print-And-Play Export** — Printable boss cards. *Trigger:* menu. *Feel:* offline fun. *Rarity:* Always. *Cx:* M. *Deps:* assets. *Balance:* none.

## B. Competitive formats

**SC-011 Draft Duels** — Two players draft from a shared pool and play. *Trigger:* mode. *Feel:* fair skill. *Rarity:* Mode. *Cx:* L. *Deps:* draft. *Balance:* tuned.

**SC-012 Async Duels** — Send a challenge, opponent responds later with their pre-set team. *Trigger:* mode. *Feel:* convenient. *Rarity:* Mode. *Cx:* L. *Deps:* team share. *Balance:* tuned.

**SC-013 Roguelike Race** — Same seed raced by friends with live progress via copy-paste. *Trigger:* mode. *Feel:* tension. *Rarity:* Mode. *Cx:* M. *Deps:* seeds. *Balance:* none.

**SC-014 Scoring Rulesets** — Alternate scoring (style points, speed, purity). *Trigger:* mode. *Feel:* variety. *Rarity:* Mode. *Cx:* M. *Deps:* stats. *Balance:* tuned.

**SC-015 Tournament Bracket Generator** — Local bracket manager for friends. *Trigger:* menu. *Feel:* community. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**SC-016 Banned Pick Votes** — Vote on bans before a duel. *Trigger:* mode. *Feel:* metagame. *Rarity:* Mode. *Cx:* M. *Deps:* draft. *Balance:* none.

**SC-017 Spectator View** — Spectator mode for shared replays with commentary. *Trigger:* menu. *Feel:* esports. *Rarity:* Always. *Cx:* L. *Deps:* replays. *Balance:* none.

**SC-018 Seasonal Ladders** — Offline-validated ladders via signed result strings. *Trigger:* season. *Feel:* chase. *Rarity:* Seasonal. *Cx:* XL. *Deps:* backend. *Balance:* anti-cheat.

**SC-019 Co-op Run** — Two players share a run via turn handoffs. *Trigger:* mode. *Feel:* friends. *Rarity:* Mode. *Cx:* XL. *Deps:* netcode. *Balance:* tuned.

**SC-020 Boss Rush Leaderboards** — Local boss rush with records. *Trigger:* mode. *Feel:* chase. *Rarity:* Mode. *Cx:* M. *Deps:* bosses. *Balance:* tuned.

## C. Community creation

**SC-021 Community Challenge Editor** — Build challenge rule sets and share them. *Trigger:* menu. *Feel:* creative. *Rarity:* Always. *Cx:* L. *Deps:* mutators. *Balance:* validated.

**SC-022 Name A Trainer Contest** — Community-named NPCs enter the game via a curated pack. *Trigger:* event. *Feel:* inclusion. *Rarity:* Seasonal. *Cx:* M. *Deps:* trainers. *Balance:* moderated.

**SC-023 Community Rival Pack** — Rivals authored by players with review. *Trigger:* menu. *Feel:* creative. *Rarity:* Always. *Cx:* L. *Deps:* rival schema. *Balance:* review.

**SC-024 Fan Art Wall** — In-game gallery of submitted art (opt-in, moderated). *Trigger:* menu. *Feel:* community. *Rarity:* Always. *Cx:* L. *Deps:* backend. *Balance:* moderated.

**SC-025 Dialogue Contribution Tool** — Writers submit lines with tags. *Trigger:* menu. *Feel:* participation. *Rarity:* Always. *Cx:* L. *Deps:* dialogue schema. *Balance:* review.

**SC-026 Level Pack Jam** — Seasonal jam themes. *Trigger:* season. *Feel:* fun. *Rarity:* Seasonal. *Cx:* M. *Deps:* mod packs. *Balance:* none.

**SC-027 Translation Credits** — Contributor credits visible. *Trigger:* menu. *Feel:* thanks. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**SC-028 Playtest Report Format** — Standard playtest report export. *Trigger:* menu. *Feel:* helpful. *Rarity:* Always. *Cx:* S. *Deps:* logging. *Balance:* none.

**SC-029 Idea Voting Booth** — Vote on future features from the idea library. *Trigger:* menu. *Feel:* shared direction. *Rarity:* Always. *Cx:* L. *Deps:* backend. *Balance:* none.

**SC-030 Public Changelog With Credits** — Credits for community ideas used. *Trigger:* patch. *Feel:* thanks. *Rarity:* Always. *Cx:* S. *Deps:* docs. *Balance:* none.

## D. Social features in-world

**SC-031 Pen Pal Trainers** — Procedural pen pals write you; replies are simulated from "friends'" data. *Trigger:* time. *Feel:* warm. *Rarity:* Always. *Cx:* M. *Deps:* letters. *Balance:* none.

**SC-032 Message Boards** — Leave notes for other players' worlds via shared codes. *Trigger:* nodes. *Feel:* Dark Souls-like. *Rarity:* Setting. *Cx:* L. *Deps:* sharing. *Balance:* safe phrases.

**SC-033 Friend Hubs** — Visit a friend's Hub via link. *Trigger:* menu. *Feel:* showcase. *Rarity:* Always. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-034 Gift Boxes** — Send gifts that arrive at specific nodes. *Trigger:* menu. *Feel:* delight. *Rarity:* Always. *Cx:* L. *Deps:* backend. *Balance:* tuned.

**SC-035 Emote Wheel** — Emotes in co-op and replays. *Trigger:* input. *Feel:* social. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**SC-036 Shared Pokédex Goals** — Community goal progress tracked on a global dex (opt-in). *Trigger:* menu. *Feel:* togetherness. *Rarity:* Always. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-037 Guilds** — Guilds with shared Hub decorations (cosmetic). *Trigger:* menu. *Feel:* belonging. *Rarity:* Always. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-038 Mentor Matching** — Veteran-newcomer pairing with tips. *Trigger:* menu. *Feel:* kind. *Rarity:* Setting. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-039 Visiting NPC Trainers Based On Community** — NPCs modelled on anonymised community teams. *Trigger:* world. *Feel:* alive. *Rarity:* Always. *Cx:* XL. *Deps:* backend. *Balance:* tuned.

**SC-040 Community Events Calendar** — A calendar of community events in the Hub. *Trigger:* Hub. *Feel:* anticipation. *Rarity:* Always. *Cx:* M. *Deps:* weekly events. *Balance:* none.

## E. Content-creator support

**SC-041 Overlay Data** — Export live run data for stream overlays. *Trigger:* setting. *Feel:* creator friendly. *Rarity:* Setting. *Cx:* M. *Deps:* state. *Balance:* none.

**SC-042 Chat Voting Integration** — Streamers let chat vote on event choices. *Trigger:* setting. *Feel:* engaging. *Rarity:* Setting. *Cx:* L. *Deps:* events. *Balance:* none.

**SC-043 Highlight Clips** — Auto-trim clips of big moments. *Trigger:* run. *Feel:* shareable. *Rarity:* Always. *Cx:* L. *Deps:* recap. *Balance:* none.

**SC-044 Safe Music Mode** — Music setting safe for streaming. *Trigger:* setting. *Feel:* thoughtful. *Rarity:* Setting. *Cx:* S. *Deps:* audio. *Balance:* none.

**SC-045 Challenge Of The Streamer** — Streamer-set challenges importable by viewers. *Trigger:* menu. *Feel:* community. *Rarity:* Always. *Cx:* M. *Deps:* challenge packs. *Balance:* none.

**SC-046 Press Kit Page** — Auto-generated press page. *Trigger:* menu. *Feel:* professional. *Rarity:* Always. *Cx:* S. *Deps:* promo. *Balance:* none.

**SC-047 Speedrun Timer** — Built-in splits and rules. *Trigger:* setting. *Feel:* community. *Rarity:* Setting. *Cx:* M. *Deps:* timers. *Balance:* none.

**SC-048 Lore Discord Bot Export** — Export lore digest for community channels. *Trigger:* menu. *Feel:* engaging. *Rarity:* Always. *Cx:* M. *Deps:* docs. *Balance:* none.

**SC-049 Viewer Naming** — Viewer names put on NPCs. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* overlay. *Balance:* filter.

**SC-050 Challenge Bingo Cards** — Share bingo cards for community. *Trigger:* menu. *Feel:* fun. *Rarity:* Always. *Cx:* M. *Deps:* bingo. *Balance:* none.

## F. Cooperative and group fun (local)

**SC-051 Pass-The-Controller Mode** — Hotseat play where players alternate decisions. *Trigger:* mode. *Feel:* party. *Rarity:* Mode. *Cx:* M. *Deps:* UI. *Balance:* none.

**SC-052 Couch Draft** — Hotseat team drafting. *Trigger:* mode. *Feel:* social. *Rarity:* Mode. *Cx:* M. *Deps:* draft. *Balance:* none.

**SC-053 Group Rival Mode** — Multiple humans each play a rival. *Trigger:* mode. *Feel:* chaos. *Rarity:* Mode. *Cx:* L. *Deps:* hotseat. *Balance:* tuned.

**SC-054 Audience Poll Events** — Local audience votes via phones with QR. *Trigger:* mode. *Feel:* party. *Rarity:* Mode. *Cx:* L. *Deps:* web. *Balance:* none.

**SC-055 Party Tournament Presets** — Preset formats for game nights. *Trigger:* menu. *Feel:* easy. *Rarity:* Always. *Cx:* S. *Deps:* brackets. *Balance:* none.

**SC-056 Shared Screen Dex Hunt** — Collective dex hunt race. *Trigger:* mode. *Feel:* fun. *Rarity:* Mode. *Cx:* M. *Deps:* dex. *Balance:* none.

**SC-057 Teach A Friend Mode** — Guided coaching mode for new players. *Trigger:* mode. *Feel:* supportive. *Rarity:* Mode. *Cx:* M. *Deps:* tutorials. *Balance:* none.

**SC-058 Quiz Night** — Trivia events with game lore. *Trigger:* Hub. *Feel:* fun. *Rarity:* Always. *Cx:* M. *Deps:* lore. *Balance:* none.

**SC-059 Photo Contests** — Weekly themes. *Trigger:* week. *Feel:* creative. *Rarity:* Weekly. *Cx:* L. *Deps:* photo mode. *Balance:* moderated.

**SC-060 Story Relay** — Players pass a run narration around. *Trigger:* mode. *Feel:* quirky. *Rarity:* Mode. *Cx:* M. *Deps:* journal. *Balance:* none.

## G. Trade and economy between players

**SC-061 Trade Codes** — Trade Pokémon with a code. *Trigger:* menu. *Feel:* classic. *Rarity:* Always. *Cx:* M. *Deps:* save validation. *Balance:* tuned.

**SC-062 Heirloom Exchange** — Exchange cosmetic heirlooms. *Trigger:* menu. *Feel:* collecting. *Rarity:* Always. *Cx:* M. *Deps:* heirlooms. *Balance:* none.

**SC-063 Recipe Swap** — Share crafting recipes. *Trigger:* menu. *Feel:* helpful. *Rarity:* Always. *Cx:* S. *Deps:* crafting. *Balance:* none.

**SC-064 Fair Trade Validator** — Validates trade fairness. *Trigger:* trade. *Feel:* safe. *Rarity:* Always. *Cx:* M. *Deps:* trade. *Balance:* none.

**SC-065 Bank Gifts** — Send bank tiers items to friends. *Trigger:* menu. *Feel:* kind. *Rarity:* Always. *Cx:* M. *Deps:* bank. *Balance:* limits.

**SC-066 Collectors' Auction (Cosmetic)** — Cosmetic-only auction between friends. *Trigger:* menu. *Feel:* fun. *Rarity:* Mode. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-067 Barter Boards** — Post wants and offers. *Trigger:* menu. *Feel:* classic. *Rarity:* Always. *Cx:* L. *Deps:* backend. *Balance:* none.

**SC-068 Community Chest** — Shared chest filled by all players with a daily draw. *Trigger:* daily. *Feel:* togetherness. *Rarity:* Daily. *Cx:* XL. *Deps:* backend. *Balance:* tuned.

**SC-069 Lend-A-Pokémon** — Lend a Pokémon to a friend's run for a set time. *Trigger:* menu. *Feel:* trust. *Rarity:* Mode. *Cx:* XL. *Deps:* backend. *Balance:* tuned.

**SC-070 Bounty Exchange** — Post bounties for friends to hunt. *Trigger:* menu. *Feel:* fun. *Rarity:* Always. *Cx:* L. *Deps:* bounties. *Balance:* none.

## H. Meta-community

**SC-071 Anonymous Stats Pulse** — Anonymous aggregate stats ("most picked starter this week"). *Trigger:* Hub. *Feel:* togetherness. *Rarity:* Weekly. *Cx:* XL. *Deps:* backend. *Balance:* privacy.

**SC-072 Global Events Voting** — The community votes on next whole-game event. *Trigger:* Hub. *Feel:* shaped by players. *Rarity:* Seasonal. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-073 Community Milestone Unlocks** — Collective achievements unlock content for all. *Trigger:* milestones. *Feel:* excitement. *Rarity:* Seasonal. *Cx:* XL. *Deps:* backend. *Balance:* none.

**SC-074 Wiki Auto-Generation** — Game data exports to a wiki. *Trigger:* build. *Feel:* helpful. *Rarity:* Always. *Cx:* M. *Deps:* data. *Balance:* none.

**SC-075 Modding Documentation Site** — Authoritative modding docs. *Trigger:* build. *Feel:* inviting. *Rarity:* Always. *Cx:* M. *Deps:* docs. *Balance:* none.

**SC-076 Code Of Conduct And Moderation Tools** — Reporting and filters. *Trigger:* backend. *Feel:* safe. *Rarity:* Always. *Cx:* L. *Deps:* backend. *Balance:* none.

**SC-077 Community Hall Of Fame** — Best community runs honoured. *Trigger:* season. *Feel:* prestige. *Rarity:* Seasonal. *Cx:* L. *Deps:* backend. *Balance:* none.

**SC-078 Local Meetup Kits** — Kits for hosting local events. *Trigger:* menu. *Feel:* community. *Rarity:* Always. *Cx:* S. *Deps:* docs. *Balance:* none.

**SC-079 Easter Egg Hunts Across Community** — Community-solved ARGs. *Trigger:* seasons. *Feel:* epic. *Rarity:* Rare. *Cx:* M. *Deps:* puzzles. *Balance:* none.

**SC-080 Open Design Doc** — Public living design doc with proposals. *Trigger:* web. *Feel:* transparency. *Rarity:* Always. *Cx:* S. *Deps:* docs. *Balance:* none.
