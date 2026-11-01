# UI text fit, run-screen layout, node text (major update spec §2, §3, §12)

**Node text (§2).** Map nodes no longer show Pokémon levels: the wild preview beside a node has no "Lv", the info line has no "Lv" in the Devon Scope / Town Map preview and no "+N–M enemy levels" in the risk note ("Risk: high (better rewards)"). Levels stay in the party strip, the Items menu (Fame Checker / gym preview), battles, summaries and raid/Totem boxes.

**Run screen layout (§3).** The map's bottom panel has two zones: row one holds the party and eggs (left, spacing shrinks past 9) and the buttons in the width that is left (one tall row, or two short rows when crowded); row two holds the info line (3 lines) and the notice. Nothing is placed over anything else.

**Shared text fit (§12).** `src/ui/fitText.ts`: `fitLine` (smaller crisp size, then "..."), `fitBlock` (wrap, cut by height), `clampTexts` (keeps every text in a box inside it and clear of the text to its right; turns hard `fixedWidth` cuts into "..."). Used by the Picker (all Hub pages, Party, Bag, Bonds, Pokémon screen: title vs key hint, footer, rows, ▲/▼ scroll marks), the `Menu` widget (battle move menu, Settings...), battle name boxes, Hub tiles, map buttons.

**Other fixes.** Settings title no longer prints over the Options art; Hub "New Run" label sits inside its tile; Bag badge no longer covers the key hint.

**Test.** `tests/e2e/textClipping.spec.ts` (no level text on nodes, map panel in bounds with 6 Pokémon + 4 eggs, long names on Shop/Party/Bag/Summary/Bonds).

**Follow-up (Reward, Event).** Reward cards stack the notes from the bottom edge and cut the name/description with "..."; the Event title, choices, intro, odds, risk and cost are fitted. Swept with long names, no overlap: Plaza, Save Slots, Run Prep (5 pages), Hub rooms, battle pages and move menu. Mentors (Hub page, Run Prep row) and Plaza districts were swept too; the Plaza menu now draws above the crowd (Picker `depth`). Camp is an Event screen.

**Known limits.** Raid/Totem boxes were checked with normal names only. The Bag shows two stray frame rectangles near the bottom right (not from this change; Bag thread). Saves unchanged.
