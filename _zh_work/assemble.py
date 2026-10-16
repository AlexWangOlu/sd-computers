#!/usr/bin/env py
"""把 _zh_work/out/*.json 按 locales/en.json 的键顺序装配成 locales/cn.json，并做一致性对账。

用法:
  py _zh_work/assemble.py            # 装配 + 对账
  py _zh_work/assemble.py --check    # 只对账，不写文件

overrides.json 既是「润色覆盖表」也是「新增键的译文表」：新增键（上游没有、
本汉化分支加进 en.json 的）在这里给出译文即可计入。
"""
import json, os, sys
from collections import OrderedDict, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'locales', 'en.json')
DST = os.path.join(ROOT, 'locales', 'cn.json')
OUT_DIR = os.path.join(ROOT, '_zh_work', 'out')
OVER = os.path.join(ROOT, '_zh_work', 'overrides.json')


def flat(d, p=''):
    for k, v in d.items():
        q = f'{p}.{k}' if p else k
        if isinstance(v, dict):
            yield from flat(v, q)
        else:
            yield q, v


def nested(pairs):
    root = OrderedDict()
    for path, val in pairs:
        cur = root
        parts = path.split('.')
        for part in parts[:-1]:
            cur = cur.setdefault(part, OrderedDict())
        cur[parts[-1]] = val
    return root


def normalize(v):
    return v.replace(' ...', '…').replace('...', '…')


def main():
    check_only = '--check' in sys.argv
    en = json.load(open(SRC, encoding='utf-8'), object_pairs_hook=OrderedDict)
    en_flat = OrderedDict(flat(en))

    zh = {}
    for f in sorted(os.listdir(OUT_DIR)):
        if not f.endswith('.json'):
            continue
        d = json.load(open(os.path.join(OUT_DIR, f), encoding='utf-8'),
                        object_pairs_hook=OrderedDict)
        for k, v in flat(d):
            if k in zh and zh[k] != v:
                print(f'!! 单元间冲突 {k}: {zh[k]!r} vs {v!r}')
            zh[k] = v

    # 润色覆盖 + 新增键译文
    applied = added = 0
    if os.path.exists(OVER):
        over = json.load(open(OVER, encoding='utf-8'))
        for k, v in over.items():
            if k.startswith('_'):
                continue
            if k not in en_flat:
                print(f'!! 覆盖表键不在 en.json: {k}')
                continue
            if k not in zh:
                added += 1
            elif zh[k] != v:
                applied += 1
            zh[k] = v
        print(f'覆盖表: 改写 {applied} 条，补齐 {added} 条')

    missing = [k for k in en_flat if k not in zh]
    extra = [k for k in zh if k not in en_flat]
    print(f'键覆盖: {len(zh)}/{len(en_flat)}  缺 {len(missing)}  多 {len(extra)}')
    if missing:
        print('  缺:', missing[:20])
    if extra:
        print('  多:', extra[:20])

    # 一致性对账：同一英文原文出现多次而译文不一致
    by_en = defaultdict(set)
    for k, v in en_flat.items():
        by_en[v].add(zh.get(k, ''))
    inconsistent = {e: s for e, s in by_en.items() if len(s) > 1 and len(e) > 2}
    print(f'\n同一原文多种译法: {len(inconsistent)} 处')
    for e, s in sorted(inconsistent.items()):
        keys = [k for k, v in en_flat.items() if v == e]
        print(f'  EN {e!r}\n    -> {sorted(s)}   @ {keys[:4]}')

    changed = 0
    for k in list(zh):
        nv = normalize(zh[k])
        if nv != zh[k]:
            zh[k] = nv
            changed += 1
    if changed:
        print(f'省略号规范化: {changed} 条')

    if check_only or missing or extra:
        if missing or extra:
            print('\n未写文件（键不齐）')
            return 1

    cn = nested([(k, zh[k]) for k in en_flat if k in zh])
    with open(DST, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(cn, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(f'\n已写 {DST}  ({os.path.getsize(DST)} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
