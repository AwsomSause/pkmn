// Battle mechanics and game systems in the compatibility report (Electric plan §4).
// `mechanics.json` lists each one with the code that runs it and the unit tests that
// exercise it. A mechanic claimed as built whose code or test file is missing is
// "invalid": passing import or schema checks is not proof that it works.

import type { EntryStatus } from './supportStatus';

export interface Mechanic {
  id: string;
  name: string;
  /** What the maintainers say: supported, limited (see note), or disabled (not built). */
  status: 'supported' | 'limited' | 'disabled';
  /** Source files or folders that run it, from the project root. */
  code: string[];
  /** Unit test files that exercise it, from the project root. */
  tests: string[];
  note?: string;
}

/** The status of every mechanic. A built one needs code and at least one test, all of which must exist. */
export function mechanicStatuses(mechanics: Mechanic[], fileExists: (path: string) => boolean): EntryStatus[] {
  return mechanics.map((m) => {
    const notes: string[] = [];
    if (m.status === 'disabled') return { kind: 'mechanic', id: m.id, status: 'disabled', notes: [m.note ?? 'not built yet'] };
    if (m.code.length === 0) notes.push('no code listed');
    if (m.tests.length === 0) notes.push('no test listed');
    for (const f of [...m.code, ...m.tests]) if (!fileExists(f)) notes.push(`missing file ${f}`);
    if (notes.length > 0) return { kind: 'mechanic', id: m.id, status: 'invalid', notes };
    return { kind: 'mechanic', id: m.id, status: m.status, notes: m.status === 'limited' ? [m.note ?? 'limited'] : [] };
  });
}
