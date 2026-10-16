#!/usr/bin/env py
"""把中文字体插入 canvas / 内联 font 字符串（TSX）——迷你游戏 HUD 与签批用的是 canvas 文字。

针对性处理 `.font = '...'` / `.font = \`...\`` 与签名笔迹的 HANDS 表；
`nui/mock/` 是浏览器开发用样例数据，跳过。幂等。
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'web', 'src')
CJK = "'Noto Sans SC Variable'"
GENERIC = ('sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui')
ASSIGN = re.compile(r'\.font\s*=\s*(`[^`]*`|\'[^\']*\'|"[^"]*")')
# 签名笔迹：楷体在前，中文名才有手写感，缺字体时回落到内置 Noto
HAND_RE = re.compile(r'font:\s*"([^"]*)"')


def inject(value, name=CJK):
    """canvas 的 font 字符串形如 `700 9px "JetBrains Mono Variable",monospace`，
    也可能整串没有逗号（`bold 8px monospace`）。两种情况都要把中文字体插到通用族之前。
    name 用与 JS 字符串定界符相反的引号，避免把字符串截断。"""
    if 'Noto Sans SC' in value:
        return value, False
    parts = [p.strip() for p in value.split(',')]
    idx = None
    for i, p in enumerate(parts):
        if p.lower().strip('\'"') in GENERIC:
            idx = i
    if idx is not None:
        parts.insert(idx, name)
        return ', '.join(parts), True
    m = re.search(r'(?:^|\s)(%s)\s*$' % '|'.join(GENERIC), value)
    if m:
        head = value[: m.start(1)].rstrip()
        return f'{head} {name}, {m.group(1)}', True
    return value, False


def patch_hands(value):
    """HANDS 表里的写法字体栈：加楷体族 + 内置 Noto 回落。"""
    if 'Noto Sans SC' in value:
        return value, False
    generic = None
    for g in ('cursive', 'serif', 'sans-serif', 'monospace'):
        if value.rstrip().endswith(g):
            generic = g
            break
    if not generic:
        return value, False
    body = value[: value.rstrip().rfind(generic)].rstrip().rstrip(',')
    if generic == 'cursive':
        extra = "'KaiTi', 'STKaiti', " + CJK
    else:
        extra = CJK
    return f'{body}, {extra}, {generic}', True


def main():
    check = '--check' in sys.argv
    touched = []
    for dirpath, dirs, files in os.walk(WEB):
        dirs[:] = [d for d in dirs if d != 'mock']
        for f in files:
            if not f.endswith(('.ts', '.tsx')):
                continue
            path = os.path.join(dirpath, f)
            src = open(path, encoding='utf-8').read()
            n = 0

            def do_assign(m):
                nonlocal n
                quote = m.group(1)[0]
                inner = m.group(1)[1:-1]
                name = '"Noto Sans SC Variable"' if quote == "'" else "'Noto Sans SC Variable'"
                new, did = inject(inner, name)
                if did:
                    n += 1
                    return f'.font = {quote}{new}{quote}'
                return m.group(0)

            out = ASSIGN.sub(do_assign, src)

            if 'HANDS' in out and 'SignDialog' in f:
                def do_hand(m):
                    nonlocal n
                    new, did = patch_hands(m.group(1))
                    if did:
                        n += 1
                        return f'font: "{new}"'
                    return m.group(0)
                out = HAND_RE.sub(do_hand, out)

            if n:
                rel = os.path.relpath(path, ROOT).replace('\\', '/')
                touched.append((rel, n))
                if not check:
                    open(path, 'w', encoding='utf-8', newline='\n').write(out)
    for rel, n in touched:
        print(f'  {rel}  {n} 处')
    print(f'共 {len(touched)} 个文件，{"待改" if check else "已改"}')


if __name__ == '__main__':
    main()
