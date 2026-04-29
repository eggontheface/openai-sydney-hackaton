import { safeJsonStringify } from './json';

describe('safeJsonStringify', () => {
  it('replaces circular references with a marker', () => {
    const value: { name: string; self?: unknown } = { name: 'root' };
    value.self = value;

    expect(JSON.parse(safeJsonStringify(value))).toEqual({
      name: 'root',
      self: '[Circular]',
    });
  });

  it('omits functions from serialized objects', () => {
    const value = {
      label: 'coach',
      callback: () => 'ignored',
    };

    expect(safeJsonStringify(value)).toBe('{"label":"coach"}');
  });
});
