// M8.9 Phase 1, slice 6: the Seven Emotions as memory tags. Each memory
// carries emotion tags (from its story moment, or story.json's byEvent); a
// Pokémon's current emotion is the most common tag in its last 10 tagged
// memories, the newer one winning a tie.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { currentEmotion, emotionOf } from '../../src/core/story/emotions';
import { emit } from '../../src/core/story/record';
import type { Emotion, Memory, PokemonHistory } from '../../src/core/story/schema';
import { content, toBattle } from './helpers';

function freshRun(seed = 'emo'): RunState {
  return structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
}

const where = { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: 1 };
const memory = (seq: number, emotions: Emotion[]): Memory => ({ eventId: `e${seq}`, seq, type: 'storyMoment', importance: 50, text: 'x', where, emotions });
const history = (memories: Memory[]) => ({ memories }) as PokemonHistory;

describe('the current emotion', () => {
  it('is the most common tag in the latest tagged memories; the newer wins a tie', () => {
    expect(currentEmotion(undefined, 10)).toBeNull();
    expect(currentEmotion(history([memory(1, [])]), 10)).toBeNull();
    expect(currentEmotion(history([memory(1, ['bravery']), memory(2, ['kindness']), memory(3, ['bravery'])]), 10)).toBe('bravery');
    expect(currentEmotion(history([memory(1, ['bravery']), memory(2, ['kindness'])]), 10)).toBe('kindness');
    // Only the window counts: two old Bravery memories fall out of a window of 2.
    expect(currentEmotion(history([memory(1, ['bravery']), memory(2, ['bravery']), memory(3, ['patience']), memory(4, [])]), 1)).toBe('patience');
  });

  it('comes with its name and heart colour from story.json', () => {
    const run = freshRun();
    const uid = run.party[0]!.uid;
    expect(emotionOf(content, run, uid)).toBeNull();
    emit(content, run, 'survivedFatal', { actors: [uid], text: 'Survived' });
    expect(emotionOf(content, run, uid)).toEqual({ id: 'determination', name: 'Determination', color: content.story.emotions.colors.determination });
  });
});

describe('memories carry emotion tags', () => {
  it("from story.json's byEvent, or the emitter's own tags", () => {
    const run = freshRun();
    const uid = run.party[0]!.uid;
    emit(content, run, 'bossBeaten', { actors: [uid], text: 'Beat a boss' });
    emit(content, run, 'caught', { actors: [uid], text: 'Caught' });
    emit(content, run, 'storyMoment', { actors: [uid], text: 'Felt a bond', importance: 60, emotions: ['kindness'] });
    const tags = run.story.histories[uid]!.memories.map((m) => [m.text, m.emotions]);
    expect(tags).toContainEqual(['Beat a boss', ['bravery']]);
    expect(tags).toContainEqual(['Caught', []]);
    expect(tags).toContainEqual(['Felt a bond', ['kindness']]);
  });

  it('every Hyper moment that changes your side has at least one emotion', () => {
    for (const def of content.story.definitions) {
      if (def.category === 'enemy' && def.triggerConditions.trigger === 'enemyRiledUp') continue;
      expect(def.emotions.length, def.id).toBeGreaterThan(0);
    }
  });

  it('Justice: knocking out the foe that knocked out a teammate', () => {
    const run = toBattle(freshRun('justice'));
    const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
    lead.moves = [{ id: 'tackle', pp: 35 }];
    run.party[0] = lead;
    const foe = createPokemon(content, 'rattata', 5, 'e1');
    foe.hp = 1;
    run.battle = createBattle('wild', [foe], 0, lead.uid);
    emit(content, run, 'knockout', { actors: ['fallen', 'e1'], data: { side: 'player' } });
    const after = takeTurn(content, run, { kind: 'move', index: 0 }).run;
    const avenged = after.story.histories[lead.uid]!.memories.find((m) => m.text.startsWith('Avenged'));
    expect(avenged?.emotions).toEqual(['justice']);
  });
});
