import type { GameMeta } from '@/types';
import type { Fs } from './fs';
import { tokenize } from './util';

export interface CompleteEnv {
  commands: string[];
  games: Record<string, GameMeta>;
  targets: string[];
  cwd: string;
  fs: Fs;
  hostname: string;
}

/**
 * Tab completion candidates for the word under the (end-of-line) caret: command names, then per
 * verb - hack <game> <difficulty>, breach/ping <target>, help <command>, ipconfig switches, cd/dir
 * folder names (quoted when they contain spaces, like cmd). `base` is the input before that word.
 */
export function completions(input: string, env: CompleteEnv): { base: string; matches: string[] } | null {
  const lead = input.match(/^\s*/)?.[0] ?? '';
  const body = input.slice(lead.length);

  if (!/\s/.test(body)) {
    const p = body.toLowerCase();
    const matches = env.commands.filter(c => c.startsWith(p));
    return matches.length ? { base: lead, matches } : null;
  }

  const verb = body.split(/\s+/)[0].toLowerCase();
  const quotes = (body.match(/"/g) ?? []).length;
  const start = quotes % 2 === 1 ? body.lastIndexOf('"') : body.search(/\S*$/);
  const before = body.slice(0, start);
  const partialRaw = body.slice(start).replace(/^"/, '');
  const partial = partialRaw.toLowerCase();
  const argIndex = tokenize(before).length - 1;

  if (verb === 'cd' || verb === 'dir') {
    const slash = partialRaw.lastIndexOf('\\');
    const dirPart = slash >= 0 ? partialRaw.slice(0, slash + 1) : '';
    const namePart = partialRaw.slice(slash + 1).toLowerCase();
    const dirPath = dirPart ? env.fs.resolve(env.cwd, dirPart) : env.cwd;
    if (!dirPath || dirPath === 'bad-drive') return null;
    const matches = env.fs
      .list(dirPath)
      .filter(n => (verb === 'cd' ? n.dir : true) && n.name.toLowerCase().startsWith(namePart))
      .map(n => {
        const full = dirPart + n.name;
        return /\s/.test(full) ? `"${full}"` : full;
      });
    return matches.length ? { base: lead + before, matches } : null;
  }

  let cands: string[] = [];
  if (verb === 'hack') cands = argIndex === 0 ? Object.keys(env.games) : argIndex === 1 ? ['easy', 'medium', 'hard'] : [];
  else if (verb === 'breach') cands = argIndex === 0 ? env.targets : [];
  else if (verb === 'ping') cands = argIndex === 0 ? [...env.targets, env.hostname, 'localhost'] : [];
  else if (verb === 'help') cands = argIndex === 0 ? env.commands : [];
  else if (verb === 'ipconfig') cands = argIndex === 0 ? ['/all', '/flushdns'] : [];
  const matches = cands.filter(c => c.toLowerCase().startsWith(partial));
  return matches.length ? { base: lead + before, matches } : null;
}
