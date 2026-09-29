/** Real tab character. Never the two-character text `\t`. */
export const TAB_DELIMITER = '\t';

export const CUSTOM_DELIMITER = '__custom__';

export interface DelimiterPreset {
  value: string;
  label: string;
}

export const DELIMITER_PRESETS: readonly DelimiterPreset[] = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '|', label: 'Pipe (|)' },
  { value: TAB_DELIMITER, label: 'Tab' },
];

export function delimiterPreset(value: string): string {
  return DELIMITER_PRESETS.some((preset) => preset.value === value) ? value : CUSTOM_DELIMITER;
}

export function delimiterLabel(value: string): string {
  const preset = DELIMITER_PRESETS.find((item) => item.value === value);
  if (preset) {
    return preset.label;
  }
  if (!value) {
    return 'Empty';
  }
  return `Custom (${value})`;
}

export function isSingleCharacter(value: string): boolean {
  return Array.from(value).length === 1;
}
