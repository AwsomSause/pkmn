import { describe, expect, it } from 'vitest';
import { freshProfileStory, ProfileStorySchema } from '../../src/core/story2/schema';
import { normalizeLook, previewSentence, pronounForms, renderTokens, resolveLook, setLook, validateCustomPronouns, validateName, vanceTone } from '../../src/core/story2/identity';
import { BEATS, beatsFor, builtBeatsFor, canSkipPrologue, chooseMode, finishPrologue, markBeat, quickStartOffered, requiredObjects, setIdentity, setTone, shortIntake } from '../../src/core/story2/prologue';

describe('S2 name rules', () => {
  it('accepts normal names and trims', () => {
    expect(validateName("  Jo-An O'Neil ")).toEqual({ ok: true, name: "Jo-An O'Neil" });
  });
  it('gives the design-doc errors', () => {
    expect(validateName('   ')).toEqual({ ok: false, error: 'Please enter a name.' });
    expect(validateName('a'.repeat(13))).toEqual({ ok: false, error: 'That is too long. 12 letters is the limit.' });
    expect(validateName('a'.repeat(12)).ok).toBe(true);
    for (const bad of ['<b>x</b>', 'a{b}', 'a%b', 'a.b', 'a‮b', 'a​b']) expect(validateName(bad)).toEqual({ ok: false, error: 'Letters, numbers, spaces, hyphens and apostrophes only.' });
    expect(validateName('Hitler')).toEqual({ ok: false, error: 'Let us pick a different name.' });
  });
  it('counts graphemes, not code units', () => {
    expect(validateName('é'.repeat(12)).ok).toBe(true);
    expect(validateName('é'.repeat(13)).ok).toBe(false);
  });
});

describe('S2 pronoun tokens', () => {
  const sets = [['she', 'she is', 'her', 'hers', 'herself'], ['he', 'he is', 'him', 'his', 'himself'], ['they', 'they are', 'them', 'theirs', 'themself']] as const;
  it.each(sets)('renders every token for %s', (key, beForm, them, theirs, self) => {
    const f = pronounForms(key);
    expect(f.they_are).toBe(beForm);
    expect(f.them).toBe(them);
    expect(f.theirs).toBe(theirs);
    expect(f.themself).toBe(self);
  });
  it('renders capitals, the name, and leaves unknown tokens alone', () => {
    expect(renderTokens('{They_are} {player}. {Their} {unknown}. {They_were}.', { name: 'Ash', pronouns: 'he' })).toBe('He is Ash. His {unknown}. He was.');
    expect(previewSentence({ name: 'Kay', pronouns: 'they' })).toBe('Kay arrived late. They are not nervous. Their first question was good.');
  });
  it('uses you before a name exists, and they/them for a bad stored value', () => {
    expect(renderTokens('Hello {player}', {})).toBe('Hello you');
    expect(renderTokens('{They}', { pronouns: 'bogus' })).toBe('They');
  });
  it('validates custom sets', () => {
    expect(validateCustomPronouns({ subj: 'xe', obj: 'xem', poss: 'xyr', reflexive: 'xemself' }).ok).toBe(true);
    expect(validateCustomPronouns({ subj: 'x', obj: 'xem', poss: 'xyr', reflexive: 'xemself' })).toEqual({ ok: false, error: 'Each word needs 2 to 12 letters.' });
    expect(validateCustomPronouns({ subj: 'x3', obj: 'xem', poss: 'xyr', reflexive: 'xemself' })).toEqual({ ok: false, error: 'Use letters only.' });
    expect(renderTokens('{They_are} here, {theirs}', { pronouns: { subj: 'xe', obj: 'xem', poss: 'xyr', reflexive: 'xemself' } })).toBe('Xe is here, xyrs');
  });
});

describe('S2 Look lock', () => {
  it('rejects Look B and keeps the request', () => {
    const r = setLook(freshProfileStory(), 'look_b');
    expect(r.result).toBe('look_locked');
    expect(r.story.protagonist.look).toBe('look_a');
    expect(r.story.protagonist.lookRequested).toBe('look_b');
    expect(setLook(freshProfileStory(), 'look_a').result).toBe('ok');
  });
  it('downgrades a loaded Look B and survives a save round trip', () => {
    const loaded = ProfileStorySchema.parse({ protagonist: { look: 'look_b' } });
    const n = normalizeLook(loaded);
    expect(n.downgraded).toBe(true);
    expect(n.story.protagonist).toMatchObject({ look: 'look_a', lookRequested: 'look_b' });
    expect(ProfileStorySchema.parse(JSON.parse(JSON.stringify(n.story))).protagonist.lookRequested).toBe('look_b');
    expect(resolveLook('look_a').downgraded).toBe(false);
  });
});

describe('S2 Vance Tone', () => {
  it('highest wins, ties go to Question 1', () => {
    expect(vanceTone(['warm', 'warm', 'formal'])).toBe('warm');
    expect(vanceTone(['formal', 'warm', 'playful'])).toBe('formal');
    expect(vanceTone(['playful', 'warm', 'warm'])).toBe('warm');
    expect(vanceTone(['playful', 'warm'])).toBe('playful');
    expect(vanceTone([])).toBe('warm');
    expect(vanceTone(['formal'])).toBe('formal');
  });
});

describe('S2 prologue shell', () => {
  it('Quick Start drops the montage and needs two objects; full needs five', () => {
    expect(beatsFor('full')).toHaveLength(BEATS.length);
    expect(beatsFor('quick')).not.toContain('cold_open');
    expect(requiredObjects('quick')).toBe(2);
    expect(requiredObjects('full')).toBe(5);
    expect(builtBeatsFor('full')).toEqual(['look', 'cold_open', 'station', 'professor', 'identity', 'quiz', 'reveal', 'backstory', 'starter', 'briefing']);
    expect(builtBeatsFor('skipped')).toEqual(['look', 'identity', 'backstory', 'starter', 'briefing']);
  });
  it('Skip is hidden on the first save, Quick Start only before the mode is chosen', () => {
    expect(canSkipPrologue(1)).toBe(false);
    expect(canSkipPrologue(2)).toBe(true);
    const s = freshProfileStory();
    expect(quickStartOffered(s)).toBe(true);
    expect(quickStartOffered(chooseMode(s, 'quick'))).toBe(false);
  });
  it('stores identity only when valid and a pronoun is picked', () => {
    const s = freshProfileStory();
    expect(setIdentity(s, 'Kay', null)).toEqual({ ok: false, error: 'Pick one.' });
    expect(setIdentity(s, '', 'she').ok).toBe(false);
    const r = setIdentity(s, 'Kay', { subj: 'xe', obj: 'xem', poss: 'xyr', reflexive: 'xemself' });
    expect(r.ok && r.story.protagonist).toMatchObject({ name: 'Kay', nameSet: true, pronouns: { subj: 'xe' } });
    expect(setIdentity(s, 'Kay', { subj: 'x', obj: 'xem', poss: 'xyr', reflexive: 'xemself' }).ok).toBe(false);
  });
  it('survives a profile round trip at every checkpoint', () => {
    let s = chooseMode(freshProfileStory(), 'quick');
    s = markBeat(s, 'look');
    s = markBeat(markBeat(s, 'station'), 'station');
    s = setTone(s, 'playful', true);
    const r = setIdentity(s, 'Kay', 'they');
    if (!r.ok) throw new Error('identity');
    s = finishPrologue(r.story);
    const again = ProfileStorySchema.parse(JSON.parse(JSON.stringify(s)));
    expect(again).toEqual(s);
    expect(again.prologue).toMatchObject({ done: true, mode: 'quick', vanceTone: 'playful', vanceGettingToIt: true, beatsSeen: ['look', 'station'] });
  });
  it('Short Intake greets by Tone; a skipped prologue gets warm plus one extra line', () => {
    expect(shortIntake(freshProfileStory())).toBeNull();
    const skipped = finishPrologue(chooseMode(freshProfileStory(), 'skipped'));
    expect(skipped.prologue.vanceTone).toBe('warm');
    expect(shortIntake(skipped)?.extraLine).toMatch(/I do not know you yet/);
    expect(shortIntake(markBeat(skipped, 'intake'))?.extraLine).toBeNull();
    const formal = finishPrologue(setTone(chooseMode(freshProfileStory(), 'full'), 'formal'));
    expect(shortIntake(formal)?.greeting).toMatch(/Good morning/);
  });
  it('an old profile without the new fields loads with defaults', () => {
    const old = ProfileStorySchema.parse({ prologue: { done: true, mode: 'full', beatsSeen: [] } });
    expect(old.prologue).toMatchObject({ modeChosen: false, vanceGettingToIt: false });
  });
});
