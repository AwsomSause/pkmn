# Hub sprite size fix

- Bug: the Hub stage Pokémon (and trainer pair) drew huge/blurry. The Pokémon art loads late, so a placeholder was fitted to the canon height, then the real sprite (scale 3) was added inside that scaled container and the two scales multiplied.
- Fix: `sizeToHeight` (src/ui/showcase.ts) resets a placeholder to scale 1 and refits when the art arrives (`art-ready` event from `pokemonVisual`).
- The Town tile used a missing icon (`item.sitrus_berry`); it now uses `item.map`.
- Checked in the browser: Machop and Wailord at 1280x720 (Machop 0.8 m beside Red 1.55 m; Wailord towers over Red by canon). Limit: Wailord/other giants are capped at 250 px, so the trainer gets very small.
