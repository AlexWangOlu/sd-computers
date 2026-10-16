import type { MockHandler } from './index';
import { ok, fail } from './index';

// Browser mocks for notes:list / notes:save / notes:delete, mirroring server/computers/profile.lua:
// an unknown or missing id makes a new note, an empty title becomes "Untitled", title/body are cut
// to 80/20000 chars, at 50 notes a new save is refused, deleting an unknown id is a no-op.

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

const MAX_NOTES = 50;
const MAX_TITLE = 80;
const MAX_BODY = 20000;

const now = (): number => Math.floor(Date.now() / 1000);
const newId = (): string => now().toString(16) + Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');

const notes: Note[] = [
  {
    id: '66f1a2b30a1c',
    title: '交接班',
    body: [
      '交接班 - 夜班 -> 白班',
      '',
      '- 68 号公路的 10-80 在哈莫尼收场，嫌疑人已被羁押（3 号囚室）',
      '- 圆堡山来电：格罗夫街的枪伤伤者情况稳定，笔录待做',
      '- 扣押场大门又卡住了，已向后勤部门报修',
      '- 05:40 完成军械库清点，全部归还入库',
      '',
      '提醒：简报室 14:00 已被银行押运任务占用。',
    ].join('\n'),
    updatedAt: now() - 25 * 60,
  },
  {
    id: '66f0f9e10b7e',
    title: '车牌清单',
    body: ['布控车牌', '', '46EEK572  黑色 Sultan RS  - 与好麦坞连环入室盗窃案有关', '88JAX190  白色 Speedo   - 被盗，沙丘海岸', '12ROC447  红色 Buffalo S  - 登记过期，仅警告', '03FKN882  灰色 Baller    - 帮派组已标记'].join('\n'),
    updatedAt: now() - 3 * 3600,
  },
  {
    id: '66ee41c70f02',
    title: '密码 - 请勿外传',
    body: ['前台电脑 PIN：问警士', '档案终端：hale.j / Spring2026!', '军械库密码锁：每周一更换', '', '说真的，别把这便签开着就走。'].join('\n'),
    updatedAt: now() - 2 * 86400,
  },
];

const sorted = (): Note[] => [...notes].sort((a, b) => b.updatedAt - a.updatedAt).map(n => ({ ...n }));

const handlers: Record<string, MockHandler> = {
  'notes:list': () => ok(sorted()),

  'notes:save': p => {
    const input = p.note as { id?: unknown; title?: unknown; body?: unknown } | undefined;
    if (!input || typeof input !== 'object') return fail('无效请求。');
    const title = String(input.title ?? '').slice(0, MAX_TITLE) || '未命名';
    const body = String(input.body ?? '').slice(0, MAX_BODY);
    const existing = input.id !== undefined ? notes.find(n => n.id === input.id) : undefined;
    if (existing) {
      existing.title = title;
      existing.body = body;
      existing.updatedAt = now();
      return ok({ ...existing });
    }
    if (notes.length >= MAX_NOTES) return fail('你已达到便签数量上限。');
    const note: Note = { id: newId(), title, body, updatedAt: now() };
    notes.push(note);
    return ok({ ...note });
  },

  'notes:delete': p => {
    const i = notes.findIndex(n => n.id === p.id);
    if (i >= 0) notes.splice(i, 1);
    return ok();
  },
};

export default handlers;
