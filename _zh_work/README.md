# sd-computers 汉化工具链与维护手册

这份手册是给「以后维护这个汉化分支的人（大概率是下一个 AI 会话的我）」看的。
汉化本身只有两个产物：`locales/cn.json` 与一批「值被换成中文」的配置文件/代码字符串。
其余都是流程与自检。

---

## 0. 分支与远端

```
origin    https://github.com/AlexWangOlu/sd-computers          (fork，交付分支推这里)
upstream  https://github.com/Samuels-Development/sd-computers  (原作者)
main      上游镜像，只做 ff 合并：git fetch upstream && git merge --ff-only upstream/main
custom    汉化交付分支（日常都在这里）
```

---

## 1. 目录

```
_zh_work/
  GLOSSARY.md            术语表 + 硬规则（翻译任何东西前必读）
  split.py               locales/en.json → 20 个翻译单元（写进 src/）
  src/<unit>.json        英文单元（生成物，别手改）
  out/<unit>.json        中文单元（翻译产物；结构必须与 src 逐字一致）
  verify_unit.py         单元自检：键集合 / 占位符 / 空值 / 漏翻  （py _zh_work/verify_unit.py --all）
  assemble.py            装配 locales/cn.json + 覆盖率 + 一致性对账
  overrides.json         润色覆盖表 + 新增键译文（唯一允许手改的译文文件）
  inject_font.py         往所有 CSS 字体栈插入中文字体（幂等）
  inject_canvas_font.py  往 canvas .font 字符串与签名笔迹插入中文字体（幂等）
  shots.mjs              Playwright + Edge 批量截图 27 个界面（需先起 dev 服务器）
  shots/                 截图输出（验收用）
  pack.ps1               打发布 zip（等价于上游 release.yml 的产物 + README-CN.md）
  consistency.txt        最近一次装配的对账输出
```

`_zh_work/` 会随分支提交，方便换机器继续。

---

## 2. 上游更新后的标准流程

```bash
cd /d/FIVEMDEV/sd-computers

# 1) 取上游
git fetch upstream
git checkout main && git merge --ff-only upstream/main && git checkout custom
git merge upstream/main            # 冲突点通常只有两处：locales/en.json（生成物）与 configs/（我改过值）

# 2) locales/en.json 冲突一律以「上游版」为准，然后重新生成它的 ui.* 子树
git checkout --theirs locales/en.json 2>/dev/null || git checkout upstream/main -- locales/en.json
cd web && node scripts/merge-strings.mjs && cd ..

# 3) 重新切分单元，找出新键
py _zh_work/split.py               # 覆盖 src/，键总量会变大

# 4) 装配 —— 它会报「缺 N」即上游新增、尚未翻译的键
py _zh_work/assemble.py
#    把新键补齐：写进 out/<unit>.json（对应单元）或直接写进 overrides.json 的键值对
#    再跑一次直到「键覆盖: N/N 缺 0 多 0」

# 5) 自检与构建
py _zh_work/verify_unit.py --all
cd web && npm run build            # tsc --noEmit && vite build，必须过
cd .. && node _zh_work/shots.mjs   # 需先 npm run dev；27 场景应全 ok（控制台零错误）

# 6) 打包、提交、推送
powershell -NoProfile -ExecutionPolicy Bypass -File _zh_work/pack.ps1
git add -A && git commit -m "定制：合并上游 <版本/tag> 并补齐汉化"
git push origin custom
```

**判断「新键」的小抄**：`assemble.py` 的最后一行就是覆盖率；`缺` 列出的键路径直接决定要翻什么、翻完往哪写。

---

## 3. 硬约束与踩过的坑

1. **`locales/en.json` 是生成物**：`web/src/apps/<app>/strings.en.json` 等片段经 `web/scripts/merge-strings.mjs` 合成它的 `ui.*` 子树。改了片段必须重跑 merge-strings 再 assemble，否则 en/cn 会错位。
2. **`overrides.json` 是唯一的手改译文入口**：assemble.py 在写完单元后应用它，既能润色既有键，也能给「为汉化新加进 en.json 的键」补译文（`err.nothing_aimed`、`ui.common.*` 的若干键就是这么来的）。
3. **事件查看器的 source 值不能译**：`Security` / `Eventlog` / `Shell` / `Business` / `Cameras` / `Print Spooler` 被 `web/src/apps/logs/model.ts` 当作频道分类依据（`categoryOf`）。真实 Windows 事件查看器的来源名也不翻译，保持英文是正确的。
4. **尖括号值**（`<All sources>`）：`verify_unit.py` 把 `<...>` 视为占位符，改动这类值要先确认脚本预期，否则自检会报「占位符不符」。
5. **CSS 字体插入点**：必须插在「最后一个通用族之前」（`sans-serif`/`serif`/`monospace`/`cursive`/`system-ui` 里最后出现的那个），并且**按值判定而不是按变量名**——`--rt-font`/`--rt-mono`/`--s-font`/`--s-head`/`--s-mono`/`--sans` 都要覆盖。
6. **canvas 文字不继承 CSS 字体**：迷你游戏 HUD、监控时间戳、纸面签批都是 `ctx.font`。`inject_canvas_font.py` 处理 `.font = '...'`；插入的字体名要用**与外层 JS 字符串相反的引号**，否则会把字符串截断（这个坑真踩过）。
7. **日期时间统一走 `web/src/lib/format.ts`**：`formatLocale` 默认 `'zh-CN'`，`setFormatLocale()` 可切换。页面里不要再出现 `toLocaleDateString('en-US')`；数字千分位保留 `'en-US'` 无所谓（zh-CN 分组长一样），改动收益为零、风险不小。
8. **应用标签有两个来源**：游戏内来自 `configs/shared/desktop.lua` 的 `Apps.<id>.label`，浏览器预览来自 `web/src/nui/mock/payload.ts`。**两处都要改**，否则预览与游戏显示不一致，验收会误导人。
9. **浏览器预览为什么是中文**：`web/src/i18n/index.ts` 与 `web/src/admin/i18n/index.ts` 里 `isEnvBrowser()` 为真时以内建 `cn.json` 为底；游戏内始终以内建 `en.json` 为底，再把运行时语言包深合并上去（所以将来上游加了还没翻的键，游戏里显示英文而不是键名）。
10. **预览入口**：`/os.html?style=modern|retro|mac#<appId>`（`#desktop`/`#mail`/`#logs`/`#cmd`/`#settings`/`#files`/`#boss`/`#browser`/`#bank`/`#games`/`#board`/`#cameras`/`#notepad`/`#contacts`/`#photos`/`#calculator`/`#messages`/`#notes`），`#paper&kind=statement`、`#lib`、`?frame`；管理面板 `/admin.html`。
11. **`web/src/nui/mock/*` 是样例数据**：会打进产物、浏览器里可见，但游戏内走 Lua 真数据。它汉化与否不影响游戏，但影响「浏览器验收」的可信度——所以也翻了。
12. **不要动上游的文件组织**：新增键写进既有片段（`strings.en.json`）或 en.json 的手写节（`err`/`logs`/…/`ui.common`），不要新建顶层小节，合并时冲突更小。
13. **口吻/术语一致性**：`assemble.py` 的「同一原文多种译法」清单是唯一的自动护栏——出现新条目时逐条判断是「语境合理差异」（如 Back 在浏览器=后退、在邮件=返回）还是「真不一致」（如 复制/拷贝），后者写进 `overrides.json` 统一。

---

## 4. 打包发布

`pack.ps1` 复刻上游 `release.yml` 的打包逻辑（allowlist + fxmanifest 路径校验），额外带上 `README-CN.md`：

```
pack.ps1 产出：D:\car\sd-computers-cn.zip
解压后得到 sd-computers/（资源根），内含
  fxmanifest.lua  README.md  README-CN.md
  bridge/ client/ server/ shared/ configs/ locales/ docs/items/
  web/build/（index.html os.html admin.html screen.html assets/ props/）
```

要点：

- **不要用 `Compress-Archive`**：PowerShell 5.1 会写出反斜杠条目名，7-Zip/WinRAR 解压异常。`pack.ps1` 用 `ZipArchive` 显式写 `/`。
- 打包后必须**独立校验**：用 `unzip -l` 数条目、确认无 `\` 条目名、随机取 `web/build/assets/*.woff2` 与 `locales/cn.json` 确认在包内。
- 发布物里**不要**包含 `_zh_work/`、`web/node_modules/`、`web/src/`。

---

## 5. 关键文件清单（改了要连带检查）

| 文件 | 作用 | 连带 |
|---|---|---|
| `locales/cn.json` | 全部界面文案 | 由 `assemble.py` 生成，**不要手改** |
| `locales/en.json` | 英文基线 + 我新增键 | 由 merge-strings 生成 `ui.*`；手写节可直接加键 |
| `configs/config.lua` | `Locale = 'cn'` | 改回 `'en'` 即英文 |
| `configs/shared/desktop.lua` | 应用名、壁纸名 | 与 `web/src/nui/mock/payload.ts` 同步改 |
| `web/src/lib/format.ts` | 日期时间语言 | `formatLocale` |
| `web/src/i18n/index.ts` | 前端语言底座 | 浏览器分支 |
| `package.json` | 多了 `@fontsource-variable/noto-sans-sc` | 上游若也加了字体依赖，合并时留意锁版本 |
| `web/src/styles/*.css`、`web/src/**/*.tsx` | 字体栈注入点 | `inject_font.py` / `inject_canvas_font.py` 可重跑，幂等 |
