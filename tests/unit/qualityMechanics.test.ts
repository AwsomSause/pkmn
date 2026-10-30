import { describe, expect, it } from 'vitest';
import { dashboardHtml } from '../../src/quality/dashboard';
import { mechanicStatuses, type Mechanic } from '../../src/quality/mechanics';
import mechanicsJson from '../../src/quality/mechanics.json';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentReport } from '../../src/quality/contentReport';

const built: Mechanic = { id: 'a', name: 'A', status: 'supported', code: ['x.ts'], tests: ['x.test.ts'] };

describe('mechanic statuses', () => {
  it('a built mechanic with code and tests on disk is supported; limited keeps its note', () => {
    const [a, b] = mechanicStatuses([built, { ...built, id: 'b', status: 'limited', note: 'half done' }], () => true);
    expect(a).toMatchObject({ kind: 'mechanic', status: 'supported', notes: [] });
    expect(b).toMatchObject({ status: 'limited', notes: ['half done'] });
  });
  it('a missing code or test file makes it invalid and names the file', () => {
    const [s] = mechanicStatuses([built], (p) => p === 'x.ts');
    expect(s).toMatchObject({ status: 'invalid', notes: ['missing file x.test.ts'] });
  });
  it('a built mechanic with no code or no test listed is invalid', () => {
    expect(mechanicStatuses([{ ...built, code: [] }], () => true)[0]!.status).toBe('invalid');
    expect(mechanicStatuses([{ ...built, tests: [] }], () => true)[0]!.status).toBe('invalid');
  });
  it('a disabled mechanic needs no files', () => {
    expect(mechanicStatuses([{ ...built, status: 'disabled', code: [], tests: [], note: 'later' }], () => false)[0]).toMatchObject({ status: 'disabled', notes: ['later'] });
  });
  it('every mechanic in mechanics.json has unique ids and its files exist', () => {
    const list = mechanicsJson as Mechanic[];
    expect(new Set(list.map((m) => m.id)).size).toBe(list.length);
    const bad = mechanicStatuses(list, (p) => existsSync(join(__dirname, '..', '..', p))).filter((e) => e.status === 'invalid');
    expect(bad).toEqual([]);
  });
});

describe('dashboard', () => {
  const report: ContentReport = {
    totals: {},
    checks: [
      { id: 'good', title: 'Good', explain: 'fine', count: 0, offenders: [] },
      { id: 'bad', title: 'Bad <one>', explain: 'broken', count: 2, offenders: ['x&y', 'z'] },
    ],
    statuses: [{ kind: 'mechanic', id: 'm1', status: 'disabled', notes: ['later'] }],
    summary: { species: { supported: 1, limited: 0, disabled: 0, invalid: 0 } } as ContentReport['summary'],
  };
  it('shows every check with its count, the ids, the trend and the mechanics, with text escaped', () => {
    const html = dashboardHtml(report, { good: 0, bad: 1 }, '2026-10-30');
    expect(html).toContain('Bad &lt;one&gt;');
    expect(html).toContain('x&amp;y');
    expect(html).toContain('WORSE (was 1)');
    expect(html).toContain('<td>m1</td><td>disabled</td>');
    expect(html).toContain('1 of 2 checks have findings; 1 are worse');
  });
});
