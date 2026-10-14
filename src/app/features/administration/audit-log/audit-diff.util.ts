export type DiffKind = 'added' | 'removed' | 'changed' | 'same';

export interface DiffRow {
  path: string;
  oldValue: string;
  newValue: string;
  kind: DiffKind;
}

/** parses a stored JSON string; returns undefined when empty, the raw text when it is not valid JSON */
export function parseJson(text: string | null | undefined): unknown {
  if (text === null || text === undefined || text.trim() === '') {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function prettyJson(text: string | null | undefined): string {
  const parsed = parseJson(text);
  if (parsed === undefined) {
    return '';
  }
  return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
}

function flatten(value: unknown, path: string, out: Map<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(path || '(value)', '[]');
    }
    value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out.set(path || '(value)', '{}');
    }
    for (const [k, v] of entries) {
      flatten(v, path ? `${path}.${k}` : k, out);
    }
  } else {
    out.set(path || '(value)', JSON.stringify(value) ?? 'null');
  }
}

/** field-by-field comparison of two JSON documents (nested keys become dotted paths) */
export function buildDiff(oldText: string | null | undefined, newText: string | null | undefined): DiffRow[] {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  const oldParsed = parseJson(oldText);
  const newParsed = parseJson(newText);
  if (oldParsed !== undefined) {
    flatten(oldParsed, '', a);
  }
  if (newParsed !== undefined) {
    flatten(newParsed, '', b);
  }
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  return keys.map((path): DiffRow => {
    const o = a.get(path);
    const n = b.get(path);
    if (o === undefined) {
      return { path, oldValue: '', newValue: n ?? '', kind: 'added' };
    }
    if (n === undefined) {
      return { path, oldValue: o, newValue: '', kind: 'removed' };
    }
    return { path, oldValue: o, newValue: n, kind: o === n ? 'same' : 'changed' };
  });
}
