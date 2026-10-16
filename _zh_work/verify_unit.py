#!/usr/bin/env py
"""翻译单元自检：键集合 / 占位符 / 空值 / 残留英文。

用法:  py _zh_work/verify_unit.py <unit> [<unit> ...]      # 校验指定单元
       py _zh_work/verify_unit.py --all                   # 校验 out/ 下全部单元
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, '_zh_work', 'src')
OUT_DIR = os.path.join(ROOT, '_zh_work', 'out')

# 允许保持英文的值（整个值完全命中才放行）
ALLOW_EXACT = {
    'PIN', 'PIN protected', 'A4', 'Wi-Fi', 'Safari', 'App Store', 'FiveM', 'SD OS Pro',
    'SD OS Harbor', 'SD Desktop', 'LSD', 'USD', 'OK', 'FAQ', 'ID',
}
PLACEHOLDER = re.compile(r'%[sd]|%%|\$\{[^}]*\}|~[a-zA-Z_]+~|<[a-zA-Z/][^>]*>')
CJK = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]')
# 一个值里连续 3 个以上纯英文单词 = 疑漏翻（排除占位符/URL/路径/命令）
ENGLISH_RUN = re.compile(r'(?<![\w.%/:\\-])(?:[A-Za-z][A-Za-z\'’]*)(?:\s+[A-Za-z][A-Za-z\'’]*){2,}(?![\w.%/:\\-])')


def flat(d, p=''):
    for k, v in d.items():
        q = f'{p}.{k}' if p else k
        if isinstance(v, dict):
            yield from flat(v, q)
        else:
            yield q, v


def check(unit, verbose=True):
    sp = os.path.join(SRC_DIR, f'{unit}.json')
    op = os.path.join(OUT_DIR, f'{unit}.json')
    if not os.path.exists(op):
        print(f'[{unit}] MISSING out/{unit}.json')
        return False
    src = dict(flat(json.load(open(sp, encoding='utf-8'))))
    out = dict(flat(json.load(open(op, encoding='utf-8'))))
    problems = []

    missing = sorted(set(src) - set(out))
    extra = sorted(set(out) - set(src))
    if missing:
        problems.append(f'缺键 {len(missing)}: {missing[:8]}')
    if extra:
        problems.append(f'多键 {len(extra)}: {extra[:8]}')

    empty, ph_bad, leftover, non_str = [], [], [], []
    for k, v in out.items():
        if not isinstance(v, str):
            non_str.append(k)
            continue
        if not v.strip():
            empty.append(k)
            continue
        if k in src and isinstance(src[k], str):
            a = sorted(PLACEHOLDER.findall(src[k]))
            b = sorted(PLACEHOLDER.findall(v))
            if a != b:
                ph_bad.append(f'{k}: {a} -> {b}')
            elif v.strip() in ALLOW_EXACT:
                continue
            elif not CJK.search(v) and ENGLISH_RUN.search(v):
                leftover.append(f'{k}: {v[:70]}')
    if empty:
        problems.append(f'空值 {len(empty)}: {empty[:8]}')
    if ph_bad:
        problems.append(f'占位符不符 {len(ph_bad)}: {ph_bad[:6]}')
    if non_str:
        problems.append(f'非字符串 {len(non_str)}: {non_str[:8]}')
    if leftover:
        problems.append(f'疑未翻译 {len(leftover)}: {leftover[:6]}')

    ok = not problems
    print(f'[{unit}] {"OK" if ok else "FAIL"}  keys={len(out)}/{len(src)}'
          + (f'  剩余疑点 {len(leftover)}' if leftover and ok else ''))
    if verbose:
        for p in problems:
            print('   -', p)
        if leftover and ok:
            for l in leftover[:10]:
                print('   ~ leftover:', l)
    return ok


def main():
    args = sys.argv[1:]
    if not args or args == ['--all']:
        units = sorted(f[:-5] for f in os.listdir(OUT_DIR) if f.endswith('.json'))
    else:
        units = args
    good = sum(1 for u in units if check(u))
    print(f'\n{good}/{len(units)} 单元通过')
    return 0 if good == len(units) else 1


if __name__ == '__main__':
    sys.exit(main())
