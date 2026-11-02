# Screens redesign (Kice, 2026-11-02)

Kice picked looks for 21 screens from the mock-ups in /mnt/project-files/redesign/ (build plan: /mnt/project-files/plans/screens-redesign-build-plan.md).

## Slice 1: shared screen-style system
- `src/core/presentation/screenStyles.ts`: every screen's picked styles, which are built (`SCREEN_STYLES_READY`), and `screenStyleOf`, which returns a pinned style, the original look, or a random built style chosen by a hash of a per-visit salt (never gameplay RNG, so a reload shows the same look).
- Settings v16 `screenStyles` (default {} = Random everywhere), migration and test.
- Settings > Display gets a "<Screen> style" entry (Random, each built look, Original) as soon as a screen has a built style.
- Known limit: no styles are built yet, so every screen still shows its original look.
