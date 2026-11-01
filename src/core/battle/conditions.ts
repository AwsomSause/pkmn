// What is going on in a battle, as short lines for the battle Info panel (spec §23): field, your Pokémon, the foe.
// Pure and RNG-free; only things the player can already see.

import { catchProbability } from '../capture';
import { shinyMeterText } from '../wildLuck';
import type { Content } from '../contentSchema';
import { calcStats, getSpecies } from '../pokemon';
import { currentEnemy, type PokemonInstance, type RunState, type SideEffects, type Stages } from '../state';
import { emotionOf } from '../story/emotions';
import { STANCE_INFO, autoProfile, stanceOf } from './autoBattle';

export interface Conditions {
  field: string[];
  yours: string[];
  foe: string[];
}

const STAT: Record<string, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', acc: 'Acc', eva: 'Eva' };
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function stageLine(stages: Stages): string | null {
  const parts = Object.entries(stages).filter(([, n]) => n !== 0).map(([k, n]) => `${STAT[k] ?? k} ${n > 0 ? '+' : ''}${n}`);
  return parts.length ? `Stats: ${parts.join(' · ')}` : null;
}

function sideLine(side: SideEffects, who: string): string | null {
  const parts: string[] = [];
  if (side.reflect) parts.push(`Reflect ${side.reflect}`);
  if (side.lightScreen) parts.push(`Light Screen ${side.lightScreen}`);
  if (side.auroraVeil) parts.push(`Aurora Veil ${side.auroraVeil}`);
  if (side.tailwind) parts.push(`Tailwind ${side.tailwind}`);
  if (side.safeguard) parts.push(`Safeguard ${side.safeguard}`);
  if (side.mist) parts.push(`Mist ${side.mist}`);
  if (side.spikes) parts.push(`Spikes ×${side.spikes}`);
  if (side.toxicSpikes) parts.push(`Toxic Spikes ×${side.toxicSpikes}`);
  if (side.stealthRock) parts.push('Stealth Rock');
  if (side.stickyWeb) parts.push('Sticky Web');
  return parts.length ? `${who}: ${parts.join(', ')}` : null;
}

const statusWord = (m: PokemonInstance) => (m.status ? ({ brn: 'Burned', psn: 'Poisoned', par: 'Paralyzed', slp: 'Asleep', frz: 'Frozen' } as Record<string, string>)[m.status.id] ?? m.status.id : null);

export function battleConditions(content: Content, run: RunState): Conditions {
  const battle = run.battle;
  const out: Conditions = { field: [], yours: [], foe: [] };
  if (!battle) return out;
  const f = out.field;
  if (battle.weather) f.push(`Weather: ${cap(battle.weather.id)}${battle.weather.turns ? ` (${battle.weather.turns} turns)` : ''}`);
  if (battle.terrain) f.push(`Terrain: ${cap(battle.terrain.id)} (${battle.terrain.turns} turns)`);
  if (battle.field.gravity) f.push(`Gravity (${battle.field.gravity})`);
  if (battle.field.trickRoom) f.push(`Trick Room (${battle.field.trickRoom})`);
  const mine = sideLine(battle.sideEffects.player, 'Your side');
  const theirs = sideLine(battle.sideEffects.enemy, 'Foe side');
  if (mine) f.push(mine);
  if (theirs) f.push(theirs);
  const sp = battle.spectacle;
  if (sp) f.push(`Momentum ${sp.momentum}${sp.streak ? ` · streak ${sp.streak}` : ''}`);
  if (battle.kind === 'wild' && run.itemCounters?.['shiny-meter'] !== undefined) f.push(shinyMeterText(content, run, currentEnemy(battle).speciesId));
  if (battle.raid) f.push(`Raid: ${battle.raid.cheersLeft} cheers left`);
  if (battle.rivalId) f.push(battle.rivalNote ? `Rival: ${battle.rivalNote}` : 'A rival is watching');
  if (battle.nemesisNote) f.push(battle.nemesisNote);
  if (battle.memoryNote) f.push(battle.memoryNote);
  if (f.length === 0) f.push('Nothing special on the field.');

  const mon = run.party[battle.activeIndex];
  if (mon) {
    const species = getSpecies(content, mon.speciesId);
    const emotion = emotionOf(content, run, mon.uid);
    const { stance, taught } = stanceOf(run, mon.uid);
    const profile = autoProfile(content, run, mon);
    out.yours.push(`${species.name} Lv.${mon.level}${mon.nature ? ` · ${cap(mon.nature)}` : ''}`);
    out.yours.push(`Mood: ${emotion ? emotion.name : 'steady'} · ${profile.style}`);
    out.yours.push(`Stance: ${STANCE_INFO[stance].name}${taught ? ' (taught)' : ''}`);
    const status = statusWord(mon);
    if (status) out.yours.push(status);
    const stages = stageLine(battle.playerStages);
    if (stages) out.yours.push(stages);
    const held = Object.entries(mon.held ?? {}).map(([id, n]) => `${content.items.get(id)?.name ?? id}${n > 1 ? ` ×${n}` : ''}`);
    if (held.length) out.yours.push(`Holding: ${held.join(', ')}`);
    const s = calcStats(content, mon);
    out.yours.push(`HP ${mon.hp}/${s.hp}`);
    const hyper = battle.hyper;
    const bond = run.story.histories[mon.uid]?.bond;
    if (bond && bond.hyperReadiness >= 40) out.yours.push(`Hyper readiness ${Math.round(bond.hyperReadiness)}%${bond.hyperReadiness >= 60 ? ' (Overdrive is near)' : ''}`);
    if (hyper?.guard[mon.uid]) out.yours.push(`Guarded by teammates for ${hyper.guard[mon.uid]} more turn(s)`);
    if (hyper?.outdo.includes(mon.uid)) out.yours.push('Out to outdo a teammate rival (hits harder)');
    const rival = Object.entries(hyper?.rivals ?? {}).find(([key]) => key.startsWith(`${mon.uid}|`));
    if (rival) out.yours.push(`Rival of the foe's kind: ${rival[1] === 'reckless' ? 'turning reckless' : 'calm'}`);
  }
  if (battle.playerVolatile?.bleed) out.yours.push(`Bleeding x${battle.playerVolatile.bleed}`);
  if (battle.playerVolatile?.curseTag) out.yours.push('Curse-tagged: Ghost and Dark moves hit harder');
  const foe = currentEnemy(battle);
  const foeSpecies = getSpecies(content, foe.speciesId);
  out.foe.push(`${foeSpecies.name} Lv.${foe.level}`);
  out.foe.push(`Type: ${foeSpecies.types.map(cap).join(' / ')}`);
  if (battle.kind === 'wild') {
    // Weakened capture bonus: show the numbers (a plain ball; HP and status both raise the odds).
    const maxHp = calcStats(content, foe).hp;
    const base = { maxHp, catchRate: foeSpecies.catchRate, ballMultiplier: 1, finalMultiplier: 1 };
    const full = catchProbability({ ...base, hp: maxHp, statusMultiplier: 1 });
    const now = catchProbability({ ...base, hp: foe.hp, statusMultiplier: foe.status ? content.ruleset.catchStatusMultipliers[foe.status.id] ?? 1 : 1 });
    out.foe.push(`Catch odds (plain ball): ${Math.round(now * 100)}% now, ${Math.round(full * 100)}% at full health${foe.status ? ' (status helps)' : ''}`);
  }
  if (battle.alpha) out.foe.push('ALPHA: oversized and stronger, with a bigger prize');
  const foeStatus = statusWord(foe);
  if (foeStatus) out.foe.push(foeStatus);
  const foeStages = stageLine(battle.enemyStages);
  if (foeStages) out.foe.push(foeStages);
  const rage = battle.hyper?.rage[foe.uid];
  if (rage?.state === 'warned') out.foe.push('Riled up: about to unleash its rage (Brace to calm it)');
  else if (rage && rage.hits > 0 && rage.state === 'calm') out.foe.push(`Getting riled up (${rage.hits} hit${rage.hits > 1 ? 's' : ''} taken)`);
  if (battle.enemyVolatile?.bleed) out.foe.push(`Bleeding x${battle.enemyVolatile.bleed}`);
  if (battle.enemyVolatile?.curseTag) out.foe.push('Curse-tagged: Ghost and Dark moves hit harder');
  if (battle.autoUsed) out.foe.push('Auto-Battle was used: EXP and prize money at 35%');
  return out;
}
