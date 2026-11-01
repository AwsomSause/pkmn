// F224: a run that used the debug tools is tagged "assisted" so it can be told apart. The tag is a story flag; nothing
// about how the run plays changes. Pure.

import type { RunState } from '../state';

export const ASSISTED_FLAG = 'assisted';

type Flagged = { story: Pick<RunState['story'], 'flags'> };

export const isAssisted = (run: Flagged): boolean => run.story.flags[ASSISTED_FLAG] !== undefined;

/** Sets the flag in place (call on a run copy). Safe to call twice. */
export function markAssisted(run: Flagged): void {
  run.story.flags[ASSISTED_FLAG] = '1';
}
