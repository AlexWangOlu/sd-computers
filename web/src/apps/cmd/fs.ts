// A small fake C: drive for `dir` / `cd`: the system folders, the user's profile and a few
// believable files. Directories listed in a parent but without an entry here exist and are empty.

export interface FsNode {
  name: string;
  dir: boolean;
  size: number;
  mtime: number; // unix seconds
}

export interface Fs {
  /** Canonical path ("C:\Users\Jessica") or null if it isn't a directory. */
  resolve: (cwd: string, arg: string) => string | null | 'bad-drive';
  list: (path: string) => FsNode[];
  home: string;
}

const at = (daysAgo: number, h: number, m: number): number => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

const dir = (name: string, daysAgo: number, h = 9, m = 12): FsNode => ({ name, dir: true, size: 0, mtime: at(daysAgo, h, m) });
const file = (name: string, size: number, daysAgo: number, h = 14, m = 31): FsNode => ({ name, dir: false, size, mtime: at(daysAgo, h, m) });

export function makeFs(first: string): Fs {
  const home = `C:\\Users\\${first}`;
  const tree = new Map<string, FsNode[]>();
  const put = (path: string, nodes: FsNode[]) => tree.set(path.toLowerCase(), nodes);

  put('C:', [dir('PerfLogs', 412, 8, 2), dir('Program Files', 31, 17, 40), dir('Program Files (x86)', 31, 17, 38), dir('Users', 128, 10, 5), dir('System', 2, 4, 11)]);
  put('C:\\Users', [dir(first, 128, 10, 6), dir('Public', 128, 10, 5)]);
  put(home, [
    dir('Contacts', 128, 10, 7),
    dir('Desktop', 0, 9, 41),
    dir('Documents', 1, 16, 2),
    dir('Downloads', 3, 11, 58),
    dir('Favorites', 128, 10, 7),
    dir('Links', 128, 10, 7),
    dir('Music', 128, 10, 7),
    dir('OneDrive', 6, 8, 30),
    dir('Pictures', 12, 13, 15),
    dir('Saved Games', 128, 10, 7),
    dir('Searches', 128, 10, 7),
    dir('Videos', 128, 10, 7),
  ]);
  put(`${home}\\Desktop`, [
    file('Business Manager.lnk', 1408, 40, 9, 2),
    file('Evidence Log - Week 40.xlsx', 18432, 0, 9, 41),
    file('Mail.lnk', 1402, 40, 9, 2),
    file('MRPD Roster.docx', 24117, 5, 15, 20),
    file('Shift Notes.txt', 1288, 1, 22, 47),
  ]);
  put(`${home}\\Documents`, [
    dir('Reports', 1, 16, 2),
    dir('Templates', 60, 12, 0),
    file('Incident Report 2026-0931.docx', 41982, 1, 16, 2),
    file('Locker Audit.xlsx', 22610, 2, 10, 14),
    file('Overtime Request.pdf', 96244, 9, 8, 50),
  ]);
  put(`${home}\\Documents\\Reports`, [file('IR-2026-0928.docx', 38140, 8, 11, 3), file('IR-2026-0931.docx', 41982, 1, 16, 2)]);
  put(`${home}\\Downloads`, [
    file('cctv-viewer-setup.exe', 4812544, 3, 11, 58),
    file('driver_update_v2.zip', 2310144, 17, 20, 4),
    file('fleeca_branch_map.pdf', 1288320, 9, 23, 41),
  ]);
  put(`${home}\\Pictures`, [dir('Screenshots', 12, 13, 15), file('badge_photo.jpg', 88412, 90, 12, 30)]);
  put(`${home}\\Pictures\\Screenshots`, [file('Screenshot 2026-09-23 131502.png', 412883, 12, 13, 15)]);
  put('C:\\System', [dir('bin', 2, 4, 11), dir('lib', 2, 4, 11), dir('Temp', 0, 7, 55), file('desktop.exe', 5513216, 30, 2, 14), file('notepad.exe', 360448, 30, 2, 14)]);

  const split = (p: string): string[] => p.split('\\').filter(Boolean);

  /** The child directory of `path` whose name matches case-insensitively. */
  const child = (path: string, name: string): FsNode | undefined => (tree.get(path.toLowerCase()) ?? []).find(n => n.dir && n.name.toLowerCase() === name.toLowerCase());

  const resolve: Fs['resolve'] = (cwd, arg) => {
    let a = arg.replace(/\//g, '\\').replace(/"/g, '').trim();
    let parts: string[];
    const drive = a.match(/^([a-z]):/i);
    if (drive) {
      if (drive[1].toUpperCase() !== 'C') return 'bad-drive';
      a = a.slice(2);
      parts = a.startsWith('\\') ? ['C:'] : split(cwd);
    } else if (a.startsWith('\\')) parts = ['C:'];
    else parts = split(cwd);
    for (const seg of a.split('\\')) {
      if (!seg || seg === '.') continue;
      if (/^\.{2,}$/.test(seg)) {
        if (parts.length > 1) parts.pop();
        continue;
      }
      const cur = parts.length === 1 ? 'C:' : parts.join('\\');
      const hit = child(cur, seg.replace(/[. ]+$/, ''));
      if (!hit) return null;
      parts.push(hit.name);
    }
    return parts.length === 1 ? 'C:\\' : parts.join('\\');
  };

  const list = (path: string): FsNode[] => {
    const key = path === 'C:\\' ? 'c:' : path.toLowerCase();
    return [...(tree.get(key) ?? [])].sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }));
  };

  return { resolve, list, home };
}
