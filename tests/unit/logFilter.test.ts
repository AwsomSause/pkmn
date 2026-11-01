import { describe, expect, it } from 'vitest';
import { classifyLine, filterLog } from '../../src/ui/logFilter';

describe('battle log filter tabs', () => {
  const lines = ['It started to rain!', 'Rattata is hurt by its burn!', 'It\'s super effective! Rattata lost 12 HP.', 'Pikachu\'s Static activated!', 'A wild Rattata appeared!'];
  it('sorts lines into tabs and keeps plain story lines for All', () => {
    expect(classifyLine(lines[0]!)).toBe('weather');
    expect(classifyLine(lines[1]!)).toBe('status');
    expect(classifyLine(lines[2]!)).toBe('damage');
    expect(classifyLine(lines[4]!)).toBeNull();
    expect(filterLog(lines, 'all')).toHaveLength(5);
    expect(filterLog(lines, 'weather')).toEqual([lines[0]]);
  });
});
