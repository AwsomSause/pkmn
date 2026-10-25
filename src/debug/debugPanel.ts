// Developer tools (shown in dev mode, or with ?debug=1 in the address).
// Press F2 or ` (backtick) to show/hide.

import type Phaser from 'phaser';
import { calcStats } from '../core/pokemon';
import { currentEnemy } from '../core/state';
import type { GameSession } from '../game/GameSession';
import { services } from '../game/services';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c);
  return node;
}

export function installDebugPanel(game: Phaser.Game, session: GameSession): void {
  const panel = el('div', { id: 'debug-panel' });
  panel.hidden = true;
  document.body.append(panel);

  const activeScene = () => game.scene.getScenes(true)[0] ?? null;
  const goTo = (key: string) => {
    const current = activeScene();
    if (current) current.scene.start(key);
  };

  const render = () => {
    if (panel.hidden) return;
    panel.replaceChildren();
    const run = session.run;
    const content = session.content;
    panel.append(el('h3', { textContent: 'DEBUG (F2 to hide)' }));
    panel.append(el('pre', { textContent: `scene: ${activeScene()?.scene.key ?? '-'}\nstorage: ${session.saves.storageName}\nlast save error: ${session.lastSaveError ?? 'none'}` }));

    // --- run summary
    panel.append(el('h3', { textContent: 'Run' }));
    if (run) {
      const bag = Object.entries(run.inventory).map(([id, n]) => `${id}×${n}`).join(', ') || '(empty)';
      const lines = [`seed: ${run.seed}`, `trainer: ${run.archetypeId}`, `phase: ${run.phase}`, `encounters done: ${run.encountersCompleted}`, `money: ₽${run.money}  candies: ${run.candies}`, `bag: ${bag}`];
      for (const mon of run.party) {
        const s = calcStats(content, mon);
        lines.push(`${mon.speciesId} Lv${mon.level} HP ${mon.hp}/${s.hp} XP ${mon.xp} status ${mon.status?.id ?? '-'}`);
        lines.push(`  atk ${s.atk} def ${s.def} spa ${s.spa} spd ${s.spd} spe ${s.spe}`);
      }
      if (run.battle) {
        const enemy = currentEnemy(run.battle);
        const who = run.battle.trainer ? `${run.battle.trainer.name}'s ` : 'wild ';
        lines.push(`enemy: ${who}${enemy.speciesId}${enemy.shiny ? ' (shiny)' : ''} Lv${enemy.level} HP ${enemy.hp} (${run.battle.enemyIndex + 1}/${run.battle.enemyTeam.length}, turn ${run.battle.turn})`);
      }
      if (run.pending.length) lines.push(`pending: ${run.pending.map((d) => d.kind).join(', ')}`);
      if (run.draft) lines.push(`draft: ${run.draft.join(', ')}`);
      panel.append(el('pre', { textContent: lines.join('\n') }));

      const heal = el('button', { textContent: 'Heal party', onclick: () => { session.debugHeal(); if (run.phase === 'battle') goTo('Battle'); render(); } });
      panel.append(heal);

      const addSpecies = el('select', {}, [...content.species.values()].map((s) => el('option', { value: s.id, textContent: s.name })));
      const addLevel = el('input', { type: 'number', value: '10', min: '1', max: '100' });
      addLevel.style.width = '50px';
      panel.append(el('h3', { textContent: 'Add Pokémon to party' }), addSpecies, addLevel,
        el('button', { textContent: 'Add', onclick: () => { try { session.debugAddToParty(addSpecies.value, Number(addLevel.value) || 10); } catch (err) { alert(String(err)); } render(); } }));

      const itemSelect = el('select', {}, [...content.items.values()].map((i) => el('option', { value: i.id, textContent: i.name })));
      panel.append(el('h3', { textContent: 'Give item' }), itemSelect,
        el('button', { textContent: 'Give 5', onclick: () => { session.debugGiveItem(itemSelect.value, 5); render(); } }));

      if (run.phase === 'battle') {
        const speciesSelect = el('select', {}, [...content.species.values()].map((s) => el('option', { value: s.id, textContent: s.name })));
        const levelInput = el('input', { type: 'number', value: '5', min: '1', max: '100' });
        levelInput.style.width = '50px';
        panel.append(el('h3', { textContent: 'Replace wild Pokémon' }), speciesSelect, levelInput,
          el('button', { textContent: 'Replace', onclick: () => { session.debugReplaceEnemy(speciesSelect.value, Number(levelInput.value) || 5); goTo('Battle'); } }));
      }
    } else {
      panel.append(el('pre', { textContent: 'No active run.' }));
    }

    // --- new run with a seed
    panel.append(el('h3', { textContent: 'New run with seed' }));
    const seedInput = el('input', { placeholder: 'seed (blank = random)' });
    const archetypeSelect = el('select', {}, [...content.archetypes.values()].map((a) => el('option', { value: a.id, textContent: a.name })));
    panel.append(seedInput, archetypeSelect, el('button', {
      textContent: 'Start',
      onclick: () => { session.newRun(archetypeSelect.value, seedInput.value.trim() || undefined); goTo('StarterSelect'); render(); },
    }));

    // --- assets
    const { assets } = services();
    panel.append(el('h3', { textContent: `Assets: ${assets.entries().length} loaded, ${assets.missing.length} missing, ${assets.failed.length} failed` }));
    const problems = [...assets.missing.map((m) => `missing ${m.id}: ${m.files.join(', ')}`), ...assets.failed.map((f) => `failed ${f}`)];
    if (problems.length) panel.append(el('pre', { textContent: problems.join('\n') }));
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2' || e.key === '`') {
      panel.hidden = !panel.hidden;
      render();
      e.preventDefault();
    }
  });
  session.onChange(render);
}
