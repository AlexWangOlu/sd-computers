#!/usr/bin/env py
"""把中文字体插入所有 font-family 字体栈（幂等）。

规则（照抄 _hanhua_tools 的既有教训）：
  * 按「值」判定，不按变量名判定 —— 变量定义和直接声明都要处理。
  * 插入点是「最后一个通用族之前」，这样中文优先命中 Noto，而拉丁字形仍用原字体。
  * 已经含 Noto 的跳过；`inherit` / `var(...)` / 纯变量引用不动。

用法: py _zh_work/inject_font.py [--check]
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'web', 'src')
FONT = "'Noto Sans SC Variable'"
GENERIC = ('sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
           'ui-monospace', 'ui-sans-serif', 'ui-serif', 'ui-rounded')


def inject(value):
    """value 是 font-family 声明里的字体列表（不含 'font-family:'）。"""
    if FONT in value:
        return value, False
    stripped = value.strip()
    if not stripped or stripped.startswith('var(') or stripped == 'inherit':
        return value, False
    parts = [p.strip() for p in stripped.split(',')]
    # 找最后一个通用族的下标
    idx = None
    for i, p in enumerate(parts):
        if p.lower() in GENERIC or p.lower().startswith('ui-'):
            if p.lower() in GENERIC:
                idx = i
    if idx is None:
        parts.append(FONT)          # 没有通用族：挂在末尾
    else:
        parts.insert(idx, FONT)     # 插到最后一个通用族之前
    joined = ', '.join(parts)
    # 保留原本是否带尾随分号的写法由调用方处理
    return joined, True


DECL = re.compile(r'(font-family\s*:\s*)([^;}\n]+)')
VARFONT = re.compile(r'(--[A-Za-z0-9-]+\s*:\s*)([^;}\n]+)')


def looks_like_font_stack(value):
    v = value.strip()
    if FONT in v or v.startswith('var(') or v in ('inherit', 'initial', 'unset'):
        return False
    # 至少要有一个是字体名或通用族，且不含明显非字体语法
    return bool(re.search(r"(sans-serif|serif|monospace|cursive|fantasy|'[A-Za-z])", v))


def main():
    check = '--check' in sys.argv
    touched = []
    for dirpath, _dirs, files in os.walk(WEB):
        for f in files:
            if not f.endswith('.css'):
                continue
            path = os.path.join(dirpath, f)
            src = open(path, encoding='utf-8').read()
            out_lines = []
            changed = 0
            for line in src.split('\n'):
                new = line
                m = VARFONT.search(line)
                if m and looks_like_font_stack(m.group(2)):
                    new_val, did = inject(m.group(2))
                    if did:
                        new = line[:m.start(2)] + new_val + line[m.end(2):]
                elif 'font-family' in line:
                    m2 = DECL.search(line)
                    if m2:
                        new_val, did = inject(m2.group(2))
                        if did:
                            new = line[:m2.start(2)] + new_val + line[m2.end(2):]
                if new != line:
                    changed += 1
                out_lines.append(new)
            if changed:
                rel = os.path.relpath(path, ROOT).replace('\\', '/')
                touched.append((rel, changed))
                if not check:
                    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out_lines))
    for rel, n in touched:
        print(f'  {rel}  {n} 处')
    print(f'共 {len(touched)} 个文件，{"待改" if check else "已改"}')


if __name__ == '__main__':
    main()
