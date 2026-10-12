import en from '../../../../locales/en.json';

type Dict = { [key: string]: string | Dict };
type Flat = Record<string, string>;

// The panel's strings are the ui.admin block of the locale (src/admin/strings.en.json, merged into
// locales/en.json by scripts/merge-strings.mjs). The game sends the active locale flattened
// (lib.getLocales(): 'ui.admin.tabs.overview' = ...); the bundled English is the fallback, and
// what the browser preview shows.
const PREFIX = 'ui.admin.';
const bundled = en as unknown as Dict;
let dict: Flat = {};

export function setLocale(strings: Flat | null | undefined): void {
  dict = strings ?? {};
}

function lookup(source: Dict, path: string): string | undefined {
  let cur: string | Dict | undefined = source;
  for (const part of path.split('.')) {
    if (!cur || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function resolve(path: string): string {
  return dict[PREFIX + path] ?? lookup(bundled, PREFIX + path) ?? path;
}

// A string that may not be there (the blurb of a style somebody added in the config): `fallback` then.
export function tOr(path: string, fallback: string): string {
  const raw = resolve(path);
  return raw === path ? fallback : raw;
}

export function t(path: string, ...args: (string | number)[]): string {
  const raw = resolve(path);
  let i = 0;
  return raw.replace(/%[sd]/g, () => String(args[i++] ?? ''));
}
