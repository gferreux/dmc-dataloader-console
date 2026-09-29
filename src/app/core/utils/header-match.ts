export interface HeaderMatchTarget {
  column: string;
  src: string;
}

export interface HeaderSuggestion {
  column: string;
  src: string;
}

export function splitHeader(line: string, preferredDelimiter: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) {
    return [];
  }
  const candidates = [preferredDelimiter, ',', ';', '\t', '|'].filter(
    (delimiter, index, all) => Boolean(delimiter) && all.indexOf(delimiter) === index,
  );
  const chosen = candidates.find((delimiter) => trimmed.includes(delimiter)) ?? preferredDelimiter;
  return trimmed
    .split(chosen)
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((part) => part.length > 0);
}

export function suggestHeaderMatches(
  targets: readonly HeaderMatchTarget[],
  headerLine: string,
  preferredDelimiter: string,
): HeaderSuggestion[] {
  const headers = splitHeader(headerLine, preferredDelimiter);
  const byNormal = new Map<string, string>();
  for (const header of headers) {
    byNormal.set(normalizeName(header), header);
    byNormal.set(normalizeName(header).replace(/_/g, ''), header);
  }

  const suggestions: HeaderSuggestion[] = [];
  for (const target of targets) {
    if (target.src.trim()) {
      continue;
    }
    const exact = byNormal.get(normalizeName(target.column));
    const loose = byNormal.get(normalizeName(target.column).replace(/_/g, ''));
    const src = exact ?? loose;
    if (src) {
      suggestions.push({ column: target.column, src });
    }
  }
  return suggestions;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
