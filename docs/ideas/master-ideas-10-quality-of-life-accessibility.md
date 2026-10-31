# Master Idea Library 10: Quality of Life & Accessibility (QL-001 to QL-080)

Legend and fields as in file 01. Design only. Most of these are small; several are strong foundations.

## A. Information and clarity

**QL-001 Damage Range Preview** — Hovering a move shows min/max damage range as a bar over the foe HP without using gameplay RNG. *Trigger:* hover. *Feel:* informed decisions. *Rarity:* Always. *Cx:* M. *Deps:* engine calc. *Balance:* setting to hide for purists.

**QL-002 Turn Order Ribbon** — A ribbon at the top shows the exact upcoming order with speed ties flagged. *Trigger:* always. *Feel:* clarity. *Rarity:* Always. *Cx:* M. *Deps:* engine. *Balance:* none.

**QL-003 Type Matchup Tooltips** — Every foe shows effectiveness chips for each of your moves. *Trigger:* battle. *Feel:* learning aid. *Rarity:* Always. *Cx:* S. *Deps:* type chart. *Balance:* toggle.

**QL-004 Status Explainers** — Tap any status icon for a plain-language explainer and remaining turns. *Trigger:* tap. *Feel:* newcomers friendly. *Rarity:* Always. *Cx:* S. *Deps:* statuses. *Balance:* none.

**QL-005 Event Odds Peek** — Optional peek at rough odds of event outcomes ("likely good"). *Trigger:* event. *Feel:* trust. *Rarity:* Setting. *Cx:* M. *Deps:* events. *Balance:* hide for spice.

**QL-006 Why Did That Happen Log** — A battle log explains modifiers behind any number ("+20% from rain, -10% from burn"). *Trigger:* tap number. *Feel:* learning. *Rarity:* Always. *Cx:* M. *Deps:* engine breakdown. *Balance:* none.

**QL-007 Item Compare Panel** — Compare two held items side by side. *Trigger:* item screen. *Feel:* decisions. *Rarity:* Always. *Cx:* S. *Deps:* items. *Balance:* none.

**QL-008 Party Overview Heatmap** — A grid showing type coverage gaps and shared weaknesses. *Trigger:* party menu. *Feel:* planning. *Rarity:* Always. *Cx:* M. *Deps:* party UI. *Balance:* none.

**QL-009 Map Node Legend** — Hold to see what each node icon means and likelihood. *Trigger:* map. *Feel:* clarity. *Rarity:* Always. *Cx:* S. *Deps:* map. *Balance:* none.

**QL-010 Forecast Panel** — Weather and time-of-day forecast for the next three nodes. *Trigger:* map. *Feel:* planning. *Rarity:* Always. *Cx:* S. *Deps:* weather. *Balance:* accuracy tuned.

## B. Controls and flow

**QL-011 One-Tap Repeat** — Repeat last action for all turns of a trivial wild battle with an auto setting. *Trigger:* wild battle. *Feel:* fast. *Rarity:* Setting. *Cx:* M. *Deps:* engine. *Balance:* disabled vs bosses.

**QL-012 Fast Forward Toggles** — 2x/4x animation speed with sensible text pacing. *Trigger:* setting. *Feel:* respect for time. *Rarity:* Always. *Cx:* M. *Deps:* animations. *Balance:* none.

**QL-013 Undo Last Menu Action** — Undo a misclick in menus (not in battle outcomes). *Trigger:* menu. *Feel:* forgiving. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**QL-014 Rebindable Everything** — Full keyboard, gamepad and touch rebinds with presets. *Trigger:* settings. *Feel:* inclusive. *Rarity:* Always. *Cx:* M. *Deps:* input. *Balance:* none.

**QL-015 Radial Move Menu** — Radial menu option for gamepads. *Trigger:* setting. *Feel:* ergonomics. *Rarity:* Setting. *Cx:* M. *Deps:* UI. *Balance:* none.

**QL-016 Hold-To-Confirm Risky Actions** — Hold to confirm releasing a Pokémon. *Trigger:* risky action. *Feel:* safe. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-017 Quick Swap Hotkeys** — Number keys swap to party slots. *Trigger:* battle. *Feel:* pro. *Rarity:* Always. *Cx:* S. *Deps:* input. *Balance:* none.

**QL-018 Smart Defaults** — Menus remember last choice per context. *Trigger:* menus. *Feel:* speed. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-019 Batch Item Use** — Use multiple identical items in one action. *Trigger:* items. *Feel:* convenience. *Rarity:* Always. *Cx:* S. *Deps:* items. *Balance:* none.

**QL-020 Search Everywhere** — Global search for Pokémon, items, moves with filters. *Trigger:* hotkey. *Feel:* power. *Rarity:* Always. *Cx:* M. *Deps:* data. *Balance:* none.

## C. Accessibility

**QL-021 Colourblind Type Icons** — Type colors always accompanied by shapes and letters. *Trigger:* always. *Feel:* inclusive. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**QL-022 Dyslexia-Friendly Font** — Option for a dyslexia-friendly font and extra spacing. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* S. *Deps:* fonts. *Balance:* none.

**QL-023 Full Screen Reader Support** — Menus labelled for screen readers with announced battle events. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* L. *Deps:* DOM overlay. *Balance:* none.

**QL-024 Photosensitivity Safe Mode** — Strips flashes, shakes and rapid strobes. *Trigger:* setting. *Feel:* safe. *Rarity:* Setting. *Cx:* M. *Deps:* animation registry. *Balance:* none.

**QL-025 Text Size And Contrast** — Scalable text, high-contrast themes. *Trigger:* setting. *Feel:* readable. *Rarity:* Setting. *Cx:* M. *Deps:* UI. *Balance:* none.

**QL-026 One-Handed Mode** — Layout for single-hand play. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* input. *Balance:* none.

**QL-027 Audio Cues For Everything** — Sound cues for status, low HP, super-effective. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* audio. *Balance:* none.

**QL-028 Captions For Cries And Sounds** — Visual captions for audio events. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* audio. *Balance:* none.

**QL-029 Reduced Motion Modes** — Per-effect motion levels (camera, shakes, particles). *Trigger:* setting. *Feel:* comfort. *Rarity:* Setting. *Cx:* M. *Deps:* animation registry. *Balance:* none.

**QL-030 Timing Assist** — Slowed or untimed minigames. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* minigames. *Balance:* none.

## D. Management and organisation

**QL-031 Team Presets** — Save and load party formations. *Trigger:* Hub. *Feel:* convenient. *Rarity:* Always. *Cx:* M. *Deps:* party. *Balance:* none.

**QL-032 Tags And Notes** — Tag Pokémon and items with notes. *Trigger:* UI. *Feel:* organisation. *Rarity:* Always. *Cx:* S. *Deps:* save. *Balance:* none.

**QL-033 Smart Sort** — Sort by role, type, mastery, bond. *Trigger:* UI. *Feel:* helpful. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-034 Favourites** — Mark favourites protected from release. *Trigger:* UI. *Feel:* safe. *Rarity:* Always. *Cx:* S. *Deps:* party. *Balance:* none.

**QL-035 Auto-Equip Suggestions** — Suggest best held items per member. *Trigger:* UI. *Feel:* helpful. *Rarity:* Setting. *Cx:* M. *Deps:* items. *Balance:* hidden by default.

**QL-036 Bag Auto-Sort** — Bag sorts itself by use. *Trigger:* bag. *Feel:* tidy. *Rarity:* Always. *Cx:* S. *Deps:* items. *Balance:* none.

**QL-037 Compare To Team** — See how a caught Pokémon fits your team. *Trigger:* catch. *Feel:* decisions. *Rarity:* Always. *Cx:* M. *Deps:* party. *Balance:* none.

**QL-038 Release Confirmation With Memories** — Release prompt shows the Pokémon's history to confirm. *Trigger:* release. *Feel:* meaningful. *Rarity:* Always. *Cx:* S. *Deps:* history. *Balance:* none.

**QL-039 Box Wallpapers And Themes** — Customise storage. *Trigger:* Hub. *Feel:* personal. *Rarity:* Common. *Cx:* S. *Deps:* assets. *Balance:* none.

**QL-040 Drag-And-Drop Everything** — Drag to reorder, equip, sell. *Trigger:* UI. *Feel:* tactile. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

## E. Onboarding and teaching

**QL-041 Contextual Tutorials** — Short tips appear the first time a mechanic matters. *Trigger:* first use. *Feel:* gentle. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* dismiss.

**QL-042 Practice Dojo** — Hub dojo to test moves and mechanics freely. *Trigger:* Hub. *Feel:* safe sandbox. *Rarity:* Always. *Cx:* L. *Deps:* engine. *Balance:* none.

**QL-043 Glossary Links** — Tap any keyword to open a glossary. *Trigger:* tap. *Feel:* helpful. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-044 Mentor Hints (Optional)** — Optional hint system that nudges without spoiling. *Trigger:* setting. *Feel:* help on demand. *Rarity:* Setting. *Cx:* M. *Deps:* hints. *Balance:* none.

**QL-045 Replayable Cutscenes** — Re-watch any cutscene from a gallery. *Trigger:* Hub. *Feel:* respect. *Rarity:* Always. *Cx:* M. *Deps:* cutscenes. *Balance:* none.

**QL-046 Skip Tutorials For Veterans** — Fast-skip with a single toggle. *Trigger:* setting. *Feel:* respect. *Rarity:* Setting. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-047 What's New Page** — Patch notes in-game explaining changes. *Trigger:* launch. *Feel:* informed. *Rarity:* Always. *Cx:* S. *Deps:* docs. *Balance:* none.

**QL-048 Explain This Run** — Post-run analyst explains why you lost. *Trigger:* defeat. *Feel:* learning. *Rarity:* Always. *Cx:* L. *Deps:* recap. *Balance:* none.

**QL-049 Practice Seeds** — Replay a boss with practice settings. *Trigger:* Hub. *Feel:* mastery. *Rarity:* Always. *Cx:* M. *Deps:* bosses. *Balance:* none.

**QL-050 Difficulty Explainers** — Each difficulty setting explained with examples. *Trigger:* settings. *Feel:* clarity. *Rarity:* Always. *Cx:* S. *Deps:* settings. *Balance:* none.

## F. Save, safety and performance

**QL-051 Autosave Slots With Timestamps** — Multiple rolling autosaves. *Trigger:* auto. *Feel:* safe. *Rarity:* Always. *Cx:* M. *Deps:* save. *Balance:* none.

**QL-052 Export And Import Saves** — Easy backup file. *Trigger:* menu. *Feel:* trust. *Rarity:* Always. *Cx:* M. *Deps:* save. *Balance:* none.

**QL-053 Cloud Save Option** — Optional cloud sync. *Trigger:* setting. *Feel:* convenience. *Rarity:* Setting. *Cx:* XL. *Deps:* backend. *Balance:* none.

**QL-054 Low-End Device Mode** — Reduces effects for older phones. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* renderer. *Balance:* none.

**QL-055 Battery Saver** — Caps FPS and animations. *Trigger:* setting. *Feel:* thoughtful. *Rarity:* Setting. *Cx:* S. *Deps:* renderer. *Balance:* none.

**QL-056 Corruption Recovery Wizard** — Friendly recovery flow for bad saves. *Trigger:* error. *Feel:* reassuring. *Rarity:* Always. *Cx:* M. *Deps:* save. *Balance:* none.

**QL-057 Offline Mode Banner** — Clear offline indication and graceful play. *Trigger:* network. *Feel:* clarity. *Rarity:* Always. *Cx:* S. *Deps:* PWA. *Balance:* none.

**QL-058 Install As App** — PWA install prompts with icons. *Trigger:* browser. *Feel:* app-like. *Rarity:* Always. *Cx:* M. *Deps:* PWA. *Balance:* none.

**QL-059 Fast Load Preload Hints** — Preload next-biome assets quietly. *Trigger:* map. *Feel:* smooth. *Rarity:* Always. *Cx:* M. *Deps:* assets. *Balance:* none.

**QL-060 Diagnostics Export** — One-click diagnostic report for bugs. *Trigger:* menu. *Feel:* helpful. *Rarity:* Always. *Cx:* S. *Deps:* logging. *Balance:* none.

## G. Comfort and polish

**QL-061 Smart Screen Dimming Of Spoilers** — Hide spoilery dex entries until discovered. *Trigger:* setting. *Feel:* fresh. *Rarity:* Setting. *Cx:* S. *Deps:* Pokédex. *Balance:* none.

**QL-062 Sleep Reminders** — Optional break reminders. *Trigger:* time. *Feel:* caring. *Rarity:* Setting. *Cx:* S. *Deps:* timer. *Balance:* none.

**QL-063 Confirm Before Quitting Mid-Event** — Prevent accidental exits. *Trigger:* exit. *Feel:* safe. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-064 Language Packs** — Community translation framework. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* L. *Deps:* text. *Balance:* none.

**QL-065 Tone Options** — Choose dialogue tone intensity (gentle, standard, edgy). *Trigger:* setting. *Feel:* comfort. *Rarity:* Setting. *Cx:* M. *Deps:* dialogue. *Balance:* none.

**QL-066 Content Filters For Dark Events** — Skip heavy themes. *Trigger:* setting. *Feel:* safe. *Rarity:* Setting. *Cx:* M. *Deps:* events. *Balance:* none.

**QL-067 Streamer Mode** — Hides names and shows overlays. *Trigger:* setting. *Feel:* creator friendly. *Rarity:* Setting. *Cx:* S. *Deps:* UI. *Balance:* none.

**QL-068 Photo Mode** — Free camera, filters, stickers. *Trigger:* menu. *Feel:* creative. *Rarity:* Always. *Cx:* L. *Deps:* camera. *Balance:* none.

**QL-069 Idle Animations Pause** — Idle anims pause when unfocused. *Trigger:* focus. *Feel:* polite. *Rarity:* Always. *Cx:* S. *Deps:* renderer. *Balance:* none.

**QL-070 Gentle Failure Messages** — Defeat screens encourage rather than shame. *Trigger:* defeat. *Feel:* kind. *Rarity:* Always. *Cx:* S. *Deps:* dialogue. *Balance:* none.

## H. Balance-transparency and tuning aids

**QL-071 Balance Changelog In Game** — Shows what changed numerically. *Trigger:* patch. *Feel:* trust. *Rarity:* Always. *Cx:* S. *Deps:* docs. *Balance:* none.

**QL-072 Custom Difficulty Sliders** — Tune enemy level, loot, event chaos independently. *Trigger:* setting. *Feel:* control. *Rarity:* Setting. *Cx:* M. *Deps:* balance.json. *Balance:* flagged runs.

**QL-073 Assist Mode** — Unlock helps (extra HP, skip fights) without shame. *Trigger:* setting. *Feel:* inclusive. *Rarity:* Setting. *Cx:* M. *Deps:* settings. *Balance:* flagged.

**QL-074 Challenge Flags** — Visible tags on runs for settings used. *Trigger:* run. *Feel:* fairness. *Rarity:* Always. *Cx:* S. *Deps:* stats. *Balance:* none.

**QL-075 Test Battle Simulator** — Simulate battles to compare teams without spending a run. *Trigger:* Hub. *Feel:* theorycraft. *Rarity:* Always. *Cx:* L. *Deps:* engine. *Balance:* none.

**QL-076 Odds Calculator** — Catch odds shown on request. *Trigger:* catch. *Feel:* informed. *Rarity:* Setting. *Cx:* S. *Deps:* catch. *Balance:* none.

**QL-077 Bug Report Button** — One click bug report with state. *Trigger:* menu. *Feel:* helpful. *Rarity:* Always. *Cx:* S. *Deps:* logging. *Balance:* none.

**QL-078 Replay Validity Checker** — Verify saves replay determinism. *Trigger:* dev menu. *Feel:* trust. *Rarity:* Dev. *Cx:* M. *Deps:* determinism. *Balance:* none.

**QL-079 Data-Driven Hotfix Channel** — Ship balance changes as data. *Trigger:* launch. *Feel:* responsive. *Rarity:* Always. *Cx:* L. *Deps:* data. *Balance:* none.

**QL-080 Community Tweaks Page** — Players propose and vote on tweaks (offline sample). *Trigger:* menu. *Feel:* involvement. *Rarity:* Setting. *Cx:* L. *Deps:* backend. *Balance:* none.
