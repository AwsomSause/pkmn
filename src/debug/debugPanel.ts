// Developer tools (shown in dev mode, or with ?debug=1 in the address).
// Press F2 or ` (backtick) to show/hide.

import type Phaser from 'phaser';
import { calcStats } from '../core/pokemon';
import { currentColumn, findNode } from '../core/map';
import { runLevelCap } from '../core/regions';
import { currentEnemy, type RunState } from '../core/state';
import { topMoments } from '../core/story/record';
import { getTheme, themePool } from '../core/themes';
import type { GameSession } from '../game/GameSession';
import { services } from '../game/services';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c);
  return node;
}

/** The story layer, live: newest events first, then the chronicle's top moments and each Pokémon's history. */
function storyLog(run: RunState): string {
  const story = run.story;
  const where = (w: RunState['story']['events'][number]['where']) =>
    `R${w.region + 1}${w.stage !== null ? ` S${w.stage + 1}` : ''}${w.level !== null ? ` L${w.level}` : ''}${w.battle !== null ? ` B${w.battle}` : ''}${w.turn !== null ? ` T${w.turn}` : ''}`;
  const lines = story.events
    .slice(-40)
    .reverse()
    .map((e) => `#${e.seq} ${e.type} [${e.actors.join(',')}] ${where(e.where)} ${Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  lines.push('', 'top moments:', ...topMoments(story).map((m) => `  (${m.importance}) ${m.text}`));
  lines.push('', 'histories:');
  for (const h of Object.values(story.histories)) {
    lines.push(`  ${h.uid} ${h.speciesId}: ${h.battles} battles, KOs ${h.knockoutsDealt}/${h.knockoutsTaken}, close calls ${h.closeCalls}, survived ${h.survivedFatal}, bosses ${h.bossesBeaten}, low-HP stand ${h.longestLowHpStand}, ${h.memories.length} memories`);
  }
  if (run.battle?.storyEffects.length) lines.push('', `battle ledger: ${run.battle.storyEffects.join(', ')}`);
  lines.push(`run ledger: ${story.appliedEffects.length} effect ids  ·  major moments this battle: ${story.majorCuesThisBattle}`);
  return lines.join('\n');
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
      if (run.battle?.levelInfo.length) {
        lines.push('enemy levels (base + progress + variance + archetype + bonus = level):');
        run.battle.levelInfo.forEach((b, i) => {
          const f = (n: number) => (Math.round(n * 100) / 100).toString();
          const clamp = b.unclamped !== b.level ? ` (clamped from ${f(b.unclamped)})` : '';
          lines.push(`  #${i + 1}: ${f(b.base)} + ${f(b.progress)} + ${f(b.variance)} + ${f(b.archetypeOffset)} + ${f(b.bonus)} = Lv${b.level}${clamp}`);
        });
      }
      if (run.pending.length) lines.push(`pending: ${run.pending.map((d) => d.kind).join(', ')}`);
      if (run.draft) lines.push(`draft: ${run.draft.join(', ')}`);
      panel.append(el('pre', { textContent: lines.join('\n') }));

      const regionLines = [
        `campaign: ${run.campaignId}  ·  region ${run.regionIndex + 1}/${run.regionOrder.length}: ${run.regionOrder[run.regionIndex] ?? '-'}  ·  level cap ${runLevelCap(content, run)}`,
        `region order: ${run.regionOrder.join(' → ') || '(not set yet)'}`,
        `regions cleared: ${run.regionsCleared.join(', ') || '-'}${run.victory ? '  ·  VICTORY' : ''}`,
      ];
      panel.append(el('h3', { textContent: 'Region' }), el('pre', { textContent: regionLines.join('\n') }));
      if (run.phase === 'map' && run.stage?.kind === 'stage') {
        panel.append(el('button', { textContent: 'Jump to the Pokémon League', onclick: () => { try { session.debugJumpToLeague(); goTo('Map'); } catch (err) { alert(String(err)); } render(); } }));
      }

      if (run.stage) {
        const stage = run.stage;
        const theme = getTheme(content, stage.themeId);
        const node = stage.current ? findNode(stage.map, stage.current) : null;
        const pool = themePool(content, theme).map((p) => `${p.speciesId}${p.weight > 1 ? `×${p.weight}` : ''}`).join(', ');
        const stageLines = [
          stage.kind === 'league' ? `Pokémon League (champion's last theme: ${theme.name})` : `stage ${stage.index + 1}: ${theme.name} (${theme.types.join('/')})`,
          stage.kind === 'league' ? `elite four: ${stage.eliteFour.join(', ')}  ·  champion: ${stage.leaderId}` : `gym leader: ${stage.leaderId}  ·  badges: ${run.badges.join(', ') || '-'}`,
          `level ${currentColumn(stage)}/${stage.map.columns}  ·  trainer columns: ${stage.map.trainerColumns.join(', ')}`,
          `node: ${node ? `${node.id} — ${node.note}` : '(start)'}`,
          `wild pool: ${pool}`,
          `used themes: ${run.usedThemes.length}  ·  used leaders: ${run.usedLeaders.join(', ')}`,
        ];
        panel.append(el('h3', { textContent: 'Stage' }), el('pre', { textContent: stageLines.join('\n') }));
        if (run.phase === 'map') {
          const colInput = el('input', { type: 'number', value: String(stage.map.columns), min: '1', max: String(stage.map.columns) });
          colInput.style.width = '50px';
          panel.append(el('span', { textContent: 'Jump so the next column is ' }), colInput,
            el('button', { textContent: 'Jump', onclick: () => { try { session.debugJumpToColumn(Number(colInput.value) || 0); goTo('Map'); } catch (err) { alert(String(err)); } render(); } }));
        }
      }

      panel.append(el('h3', { textContent: `Story Log (${run.story.seq} events, ${run.story.chronicle.length} in the chronicle)` }), el('pre', { textContent: storyLog(run) }));

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
    const campaignSelect = el('select', {}, [...content.campaigns.values()].map((c) => el('option', { value: c.id, textContent: c.name })));
    panel.append(seedInput, archetypeSelect, campaignSelect, el('button', {
      textContent: 'Start',
      onclick: () => { session.newRun(archetypeSelect.value, seedInput.value.trim() || undefined, campaignSelect.value); goTo('StarterSelect'); render(); },
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
