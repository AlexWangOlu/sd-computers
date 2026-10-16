#!/usr/bin/env py
"""切分 locales/en.json 为翻译单元 -> _zh_work/src/<unit>.json

按"顶层小节"整体切分，过大者按二级键均分，保证相关联的文案落在同一个单元里。
"""
import json, os, sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'locales', 'en.json')
WORK = os.path.join(ROOT, '_zh_work')
OUT_DIR = os.path.join(WORK, 'src')


def count(d):
    n = 0
    for v in d.values():
        n += count(v) if isinstance(v, dict) else 1
    return n


def split_balanced(d, parts):
    """把嵌套字典按二级键均分成 parts 组，尽量均衡。"""
    items = list(d.items())
    items.sort(key=lambda kv: -count(kv[1]) if isinstance(kv[1], dict) else -1)
    buckets = [OrderedDict() for _ in range(parts)]
    sizes = [0] * parts
    for k, v in items:
        i = sizes.index(min(sizes))
        buckets[i][k] = v
        sizes[i] += count(v) if isinstance(v, dict) else 1
    return [b for b in buckets if b]


UNITS = {}


def add(name, obj):
    UNITS[name] = obj


def ui_unit(name, ui, keys):
    """把 ui.<k> 若干小节打包成一个单元，保留 `ui` 外层。"""
    add(name, OrderedDict([('ui', OrderedDict((k, ui[k]) for k in keys))]))


def ui_split(name, ui, key, parts):
    """单独的 ui.<key> 小节，过大者按二级键均分。"""
    for i, bucket in enumerate(split_balanced(ui[key], parts), 1):
        add(f'{name}_{i}', OrderedDict([('ui', OrderedDict([(key, bucket)]))]))


def main():
    en = json.load(open(SRC, encoding='utf-8'), object_pairs_hook=OrderedDict)
    ui = en['ui']

    # 后端/系统叙事文案
    add('backend', OrderedDict((k, en[k]) for k in
        ['err', 'logs', 'mail', 'messages', 'notes', 'cameras', 'bank', 'files',
         'contacts', 'phonelink', 'board', 'photos']))
    # 业务应用后端文案
    add('apps_biz', OrderedDict((k, en[k]) for k in ['boss', 'hack', 'admin', 'print']))

    # 迷你游戏（两个单元）
    mg = en['minigames']
    add('minigames_a', OrderedDict([('minigames', OrderedDict((k, mg[k]) for k in
        ['typing', 'signal', 'pipe', 'breakout', 'shell']))]))
    add('minigames_b', OrderedDict([('minigames', OrderedDict((k, mg[k]) for k in
        ['maze', 'nodecap', 'snake', 'firewall', 'cipher', 'dodger']))]))

    # OS 核心
    ui_unit('ui_core', ui, ['common', 'lock', 'power', 'taskbar', 'start', 'desktop',
                        'quick', 'toast', 'hack'])

    # 单个 app 整包
    for name, key in [('ui_mail', 'mail'), ('ui_logs', 'logs'), ('ui_settings', 'settings'),
                      ('ui_files', 'files'), ('ui_cmd', 'cmd'), ('ui_boss', 'boss')]:
        ui_unit(name, ui, [key])

    # 大节按二级键均分
    ui_split('ui_browser', ui, 'browser', 2)
    ui_split('ui_admin', ui, 'admin', 3)

    # 其余 app
    ui_unit('ui_shells', ui, ['retro', 'mac'])
    ui_unit('ui_games_notes', ui, ['games', 'notepad', 'notes'])
    ui_unit('ui_messages_board', ui, ['messages', 'board', 'bank'])
    ui_unit('ui_misc', ui, ['photos', 'phonelink', 'contacts', 'calculator', 'cameras', 'print'])

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for name, data in UNITS.items():
        n = count(data)
        total += n
        json.dump(data, open(os.path.join(OUT_DIR, f'{name}.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=2)
        print(f'{name:20s} {n:5d} keys  {len(json.dumps(data, ensure_ascii=False)):7d} bytes')
    print(f'{"TOTAL":20s} {total:5d} keys  (en.json total: {count(en)})')


if __name__ == '__main__':
    main()
