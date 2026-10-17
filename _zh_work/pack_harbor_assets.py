"""把 handoff 的壁纸/图标按目标尺寸压缩进 sd-computers 的 harbor 资源目录。"""
import os
from PIL import Image

SRC = 'D:/FIVEMDEV/COMPUTER-AI-HANDOFF/web/src/assets'
DST = 'D:/FIVEMDEV/sd-computers/web/src/os/mac/harbor/assets'

WALL = [
    ('mojave-starry.jpg', 'mojave-starry.jpg'),
    ('mojave-desert-night.jpg', 'mojave-desert-night.jpg'),
    ('mojave-multicolor.jpg', 'mojave-multicolor.jpg'),
    ('mojave-purple-flow.jpg', 'mojave-purple-flow.jpg'),
    ('mojave-purple-glass.jpg', 'mojave-purple-glass.jpg'),
    ('mojave-chroma.jpg', 'mojave-chroma.jpg'),
    ('sonoma.jpg', 'sonoma.jpg'),
]

ICONS = [
    'mail-icon.png', 'settings-icon.png', 'safari-icon.png', 'finder-icon.png',
    'notes-icon.png', 'calculator-new-icon.png', 'terminal-icon.png',
    'document-icon.png', 'trash-icon.png', 'launchpad-icon.png', 'appstore-icon.png',
    'folder-icon.png',
]

os.makedirs(f'{DST}/wallpapers', exist_ok=True)
os.makedirs(f'{DST}/icons', exist_ok=True)

total_before = total_after = 0
for src_name, out_name in WALL:
    p = os.path.join(SRC, 'wallpapers', src_name)
    img = Image.open(p).convert('RGB')
    before = os.path.getsize(p)
    total_before += before
    if img.width > 2560:
        h = round(img.height * 2560 / img.width)
        img = img.resize((2560, h), Image.LANCZOS)
    out = os.path.join(DST, 'wallpapers', out_name)
    img.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    total_after += os.path.getsize(out)
    print(f'wall  {src_name:28s} {before/1024:7.0f}KB -> {os.path.getsize(out)/1024:6.0f}KB  {img.size}')

for name in ICONS:
    p = os.path.join(SRC, name)
    img = Image.open(p).convert('RGBA')
    before = os.path.getsize(p)
    total_before += before
    if img.width > 256:
        h = round(img.height * 256 / img.width)
        img = img.resize((256, h), Image.LANCZOS)
    out = os.path.join(DST, 'icons', name)
    img.save(out, 'PNG', optimize=True)
    total_after += os.path.getsize(out)
    print(f'icon  {name:28s} {before/1024:7.0f}KB -> {os.path.getsize(out)/1024:6.0f}KB')

print(f'\n合计 {total_before/1048576:.1f}MB -> {total_after/1048576:.2f}MB')
