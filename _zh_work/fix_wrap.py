#!/usr/bin/env py
"""一次性修复：给 ui_* / minigames_* 单元的 out 文件补回外层包裹键。

切分脚本最初漏了 `ui.` / `minigames.` 外层，导致单元键路径少一层前缀。
只处理 out/（src/ 由修好的 split.py 重新生成）。幂等：已包裹的跳过。
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_zh_work', 'out')


def main():
    fixed = []
    for f in sorted(os.listdir(OUT)):
        if not f.endswith('.json'):
            continue
        unit = f[:-5]
        outer = 'minigames' if unit.startswith('minigames_') else (
            'ui' if unit.startswith('ui_') else None)
        if not outer:
            continue
        path = os.path.join(OUT, f)
        data = json.load(open(path, encoding='utf-8'))
        if outer in data:
            continue
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            json.dump({outer: data}, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        fixed.append(unit)
    print(f'包裹修复 {len(fixed)} 个: {", ".join(fixed)}')


if __name__ == '__main__':
    main()
