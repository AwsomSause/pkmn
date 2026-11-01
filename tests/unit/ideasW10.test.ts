// Ideas W10: set-piece events and misc touches (events built by tools/events/w10.ts) and the Corner Nook (core/hubNook.ts).
import { describe, expect, it } from 'vitest';
import { W10_EVENTS } from '../../tools/events/w10';
import { chooseEvent } from '../../src/core/events';
import { NOOK, collectWish, cookieReady, crackCookie, deliverNote, donate, donationProblem, fortuneFor, isStarNight, konamiJoke, konamiStep, makeWish, pendingNote, redeemCode, wishProblem, writeNote } from '../../src/core/hubNook';
import { createProfile } from '../../src/core/profile';
import { ProfileSchema } from '../../src/core/state';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

const ids = W10_EVENTS.map((e) => String(e.id));
const newRun = (seed: string) => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0);

describe('W10 map events', () => {
  it('are all in the loaded content, with unique ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(content.events.has(id), id).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(50);
  });
  it('every room an event opens exists, and rooms are never drawn on their own', () => {
    const opened = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        if (r.kind === 'addEvent') opened.add(String(r.eventId));
        Object.values(r).forEach(walk);
      }
    };
    walk(W10_EVENTS);
    for (const id of opened) {
      expect(content.events.has(id), `room ${id}`).toBe(true);
      expect(content.events.get(id)!.room, `${id} must be a room`).toBe(true);
    }
  });
  it('every flag a callback needs is set by some W10 event', () => {
    const set = new Set<string>();
    const need: string[] = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        if (r.kind === 'flag' && typeof r.key === 'string' && 'amount' in r) set.add(r.key);
        Object.values(r).forEach(walk);
      }
    };
    walk(W10_EVENTS);
    for (const e of W10_EVENTS) for (const r of (e.requires as Array<Record<string, unknown>> | undefined) ?? []) if (r.kind === 'flag') need.push(String(r.key));
    expect(need.length).toBeGreaterThan(5);
    for (const k of need) expect(set.has(k), `flag ${k} is never set`).toBe(true);
  });
  it('every event can be played: at least one choice resolves, and prompt choices follow the grade', () => {
    for (const id of ids) {
      const ev = content.events.get(id)!;
      let played = 0;
      ev.choices.forEach((choice, idx) => {
        const run = newRun(`w10-${id}-${idx}`);
        run.money = 9000;
        for (const r of choice.requires) if (r.kind === 'item') run.inventory = { ...run.inventory, [r.id]: 1 };
        const node = run.stage!.map.nodes[0]!;
        run.stage!.current = node.id;
        node.sides = [{ id: 'w10-side', kind: 'event', eventId: id, used: false } as never];
        try {
          const r = chooseEvent(content, run, 'w10-side', idx, undefined, choice.prompt ? 'perfect' : undefined);
          played += 1;
          if (choice.prompt) expect(r.success, `${id}/${idx} perfect grade`).toBe(true);
        } catch (e) {
          // An unmet requirement (type, flag, party size) or a trade with nobody to give is allowed; anything else is a bug.
          expect(String((e as Error).message), `${id}/${idx}`).toMatch(/Needs|needs|Pokémon|party|have|least|flag|type|mood|period|time|day|night|evening|morning/i);
        }
      });
      expect(played, `${id} has no playable choice`).toBeGreaterThan(0);
    }
  });
});

describe('Corner Nook', () => {
  const p0 = () => createProfile(content, 'nook');
  it('a fresh profile and an old profile without the field both have a default nook', () => {
    expect(p0().nook.cookies).toBe(0);
    const raw = JSON.parse(JSON.stringify(p0())) as Record<string, unknown>;
    delete raw.nook;
    const back = ProfileSchema.parse(raw);
    expect(back.nook).toEqual(p0().nook);
  });
  it('the fortune cookie pays once a day and the same fortune stays all day', () => {
    const p = p0();
    expect(cookieReady(p, '2026-11-02')).toBe(true);
    const a = crackCookie(p, '2026-11-02');
    expect(a.fortune).toBe(fortuneFor('nook', '2026-11-02'));
    expect(a.profile.bankCredits).toBe(NOOK.cookie.credits);
    const b = crackCookie(a.profile, '2026-11-02');
    expect(b.fortune).toBeNull();
    expect(b.profile).toBe(a.profile);
    expect(crackCookie(a.profile, '2026-11-03').profile.bankCredits).toBe(NOOK.cookie.credits * 2);
  });
  it('a wish is made at night and its gift appears on a later day, once', () => {
    const p = p0();
    expect(isStarNight(12)).toBe(false);
    expect(wishProblem(p, '2026-11-02', 12)).toMatch(/night/);
    const w = makeWish(p, '2026-11-02', 22);
    expect(wishProblem(w, '2026-11-02', 22)).toMatch(/already/);
    expect(collectWish(w, '2026-11-02').text).toBeNull();
    const got = collectWish(w, '2026-11-03');
    expect(got.text).toBeTruthy();
    expect(got.profile.bankCredits).toBe(NOOK.wish.credits);
    expect(collectWish(got.profile, '2026-11-04').text).toBeNull();
  });
  it('a note is kept until the next run starts and is read once', () => {
    const p = writeNote(p0(), '  Remember   to be brave.  ');
    expect(pendingNote(p)).toBe('Remember to be brave.');
    const read = deliverNote(p);
    expect(pendingNote(read)).toBeNull();
    expect(read.nook.note).toBe('Remember to be brave.');
    expect(() => writeNote(p0(), '   ')).toThrow();
    expect(writeNote(p0(), 'x'.repeat(500)).nook.note!.length).toBe(NOOK.note_rules.maxLength);
  });
  it('poster codes unlock a title once; unknown codes do nothing', () => {
    const c = NOOK.giftCodes[0]!;
    const a = redeemCode(p0(), c.code.toLowerCase());
    expect(a.profile.titles).toContain(c.title);
    expect(redeemCode(a.profile, c.code).text).toMatch(/already/);
    expect(redeemCode(p0(), 'NOPE').profile.titles).toEqual(p0().titles);
  });
  it('the donation drive spends credits, grants a title at each milestone, then closes', () => {
    let p: ReturnType<typeof p0> = { ...p0(), bankCredits: 5000 };
    expect(donationProblem(p0())).toMatch(/Needs/);
    for (const m of NOOK.donation.milestones) {
      while (p.nook.donated < m.total) p = donate(p).profile;
      expect(p.titles).toContain(m.title);
    }
    expect(donationProblem(p)).toMatch(/fully funded/);
    expect(5000 - p.bankCredits).toBe(p.nook.donated);
  });
  it('the Konami sequence completes only in order and the joke cycles', () => {
    let pos = 0;
    let done = false;
    for (const k of NOOK.konami.keys) ({ position: pos, done } = konamiStep(pos, k));
    expect(done).toBe(true);
    expect(konamiStep(0, 'ArrowDown').position).toBe(0);
    const j1 = konamiJoke(p0());
    const j2 = konamiJoke(j1.profile);
    expect(j1.text).not.toBe(j2.text);
    expect(j2.profile.nook.jokes).toBe(2);
  });
});
