import { CUSTOM_DELIMITER, TAB_DELIMITER, delimiterLabel, delimiterPreset, isSingleCharacter } from './delimiter';

describe('delimiter', () => {
  it('treats a real tab as the Tab preset and a single character', () => {
    expect(TAB_DELIMITER).toBe('\t');
    expect(TAB_DELIMITER.length).toBe(1);
    expect(delimiterPreset(TAB_DELIMITER)).toBe(TAB_DELIMITER);
    expect(delimiterLabel(TAB_DELIMITER)).toBe('Tab');
    expect(isSingleCharacter(TAB_DELIMITER)).toBe(true);
  });

  it('does not treat the two-character text backslash-t as a tab', () => {
    const literal = '\\t';
    expect(literal.length).toBe(2);
    expect(literal).not.toBe(TAB_DELIMITER);
    expect(delimiterPreset(literal)).toBe(CUSTOM_DELIMITER);
    expect(isSingleCharacter(literal)).toBe(false);
  });

  it('recognises the common single-character presets', () => {
    expect(delimiterPreset(',')).toBe(',');
    expect(delimiterPreset(';')).toBe(';');
    expect(delimiterPreset('|')).toBe('|');
    expect(delimiterLabel('|')).toBe('Pipe (|)');
  });
});
