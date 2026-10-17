# sd-computers · 简体中文版

[sd-computers](https://github.com/Samuels-Development/sd-computers) 的简体中文汉化分支，原作者 [Samuel's Development](https://fivem.samueldev.shop)（MIT 之外的授权以原作者商店条款为准，本分支仅供自建服务器使用，请勿二次分发原资源）。

上游仓库：`https://github.com/Samuels-Development/sd-computers`
本分支仓库：`https://github.com/AlexWangOlu/sd-computers`（分支 `custom`）

> **游戏内怎么用**：见 **[docs/GAMEPLAY-CN.md](docs/GAMEPLAY-CN.md)** —— 玩家篇（交互、登录、每个应用、入侵、打印与签批、手机联动、常见问题）与管理员篇（`/computeradmin` 放置电脑/摄像头/打印机、绘制屏幕、常用配置、排查清单）。

---

## 这一版改了什么

| 项目 | 说明 |
|---|---|
| 界面语言 | `locales/cn.json`，全量 2681 个键 100% 覆盖（错误提示、系统日志、邮件、短信、备忘录、银行、文件、联系人、公告板、经营管理、入侵小游戏、事件查看器、命令提示符、设置、三种桌面皮肤、管理面板…） |
| 默认语言 | `configs/config.lua` 的 `Locale = 'cn'`；改成 `'en'` 即回到英文（缺键自动按 key 回退英文，两侧都是这个行为） |
| 中文字体 | 内置 **Noto Sans SC**（SIL OFL 1.1，npm `@fontsource-variable/noto-sans-sc`，unicode-range 分片按需加载）。中文不再依赖玩家系统装了哪套字体，笔记本/主机/监控画面/打印件/迷你游戏 canvas 文字全覆盖 |
| 配置文案 | `configs/shared/*.lua` 与 `configs/server/*.lua` 中玩家可见的值已汉化（应用名、壁纸名、电脑名称、监控名称与区域、入侵目标与报警文案、打印机与道具昵称、浏览器的站点名与帮助页正文等）。**配置注释保持英文**，便于后续与上游合并 |
| 内建网站 | 浏览器里的威泽尔新闻 / 交易市场 / 黄页 / 商家名录 / 叽喳 / 法律与罚款 / 股票行情，站点标题、帮助页、网址栏提示均已汉化 |
| 日期时间 | 全部改用中文格式：`2026/10/16`、`上午10:10`、`周五 10月16日`、`昨天`、`5 分钟前`（三种皮肤、事件查看器、邮件、短信、设置、图表坐标轴、监控时间戳一致） |
| 硬编码文案 | 原文写死在代码里的玩家可见字符串（如准星下无目标、调度呼叫者、默认文档名、邮件附件名）改为走语言包，便于以后改词 |
| 零外链 | 全资源不含任何 CDN／外链请求：字体、图标（lucide-react）、图片全部随包本地化，离线内网服务器同样正常 |

三种桌面外观（现代 SD OS Pro / 复古 SD Desktop 3.11 / SD OS Harbor）都完整汉化，中文渲染与排版已逐屏截图验收（27 个界面，控制台零报错）。

---

## 安装

依赖与上游一致：`ox_lib`、`oxmysql`，并按需 `qbx_core` / `qb-core`（ESX 可用，但没有经营管理）。目标用 `ox_target`（`qb-target` / `qtarget` 也支持），物品用 `ox_inventory`。

1. `fxmanifest.lua` 所在这一层（`sd-computers/`）整个放进 `resources/`。
2. 确保下列资源先启动：`qbx_core`、`ox_lib`、`ox_inventory`、`ox_target`、`oxmysql`。
3. `server.cfg` 里加：

   ```cfg
   ensure sd-computers
   ```

4. 设置足够长的 `computer_auth_pepper`（`server.cfg`）：

   ```cfg
   setr computer_auth_pepper "换成一串足够长的随机字符串"
   ```

5. 按 `sql/` 的顺序执行数据库脚本（上游若有 `sql/README.md`，以它的数字顺序为准）。
6. 按上游文档 [物品接入](docs/OX_INVENTORY_ITEM.md) 合并非堆叠的电脑物品，并把随包的 `computer.png` 放进 `ox_inventory` 的图片目录。
7. 需要调外观、坐标、应用清单时改 `configs/shared/computers.lua` / `desktop.lua`；管理员也可以在游戏里用 `/computeradmin` 放电脑、摄像头、打印机并改外观。

### 语言切换

```lua
-- configs/config.lua
Locale = 'cn', -- 'cn' = 简体中文，'en' = 英文
```

- Lua 侧由 `ox_lib` 加载（缺键按 key 回退英文）。
- 前端由 `client/computers/nui.lua` 把语言包整体交给 NUI，React 侧深合并到内建英文之上。
- 浏览器里打开前端（开发预览）会直接用 `locales/cn.json` 显示中文。

---

## 先看界面（不用进游戏）

仓库里带了浏览器开发预览：`cd web && npm ci && npm run dev`，然后开

```
http://localhost:5173/os.html?style=modern#desktop     # 现代外观（可换 retro / mac）
http://localhost:5173/os.html?style=modern#mail        # 直接打开某个应用（#logs #cmd #boss …）
http://localhost:5173/admin.html                       # 管理面板
```

预览用内建中文语言包与样例数据，不需要游戏客户端。

> **注意**：与上游一致，仓库分支**不提交构建产物** `web/build/`。要直接部署，请用发布包 `sd-computers-cn.zip`（已含构建好的前端），或在 `web/` 里自行 `npm ci && npm run build`。

---

## 与上游保持同步

本分支的目标是「上游一更新就能合」。因此：

- 只改字符串值，不改结构与键名；
- 配置注释一律保留英文；
- 事件查看器的 `source` 字段（`Security` / `Eventlog` / `Shell` / `Business` / `Cameras` / `Print Spooler`）是前端的**分类依据**，按设计保持英文（真实的 Windows 事件查看器里来源名同样不翻译）。

合并上游更新的完整流程（含工具链与自检脚本）见 [`_zh_work/README.md`](_zh_work/README.md)。

---

## 字体与许可

- 内置 **Noto Sans SC Variable**（`@fontsource-variable/noto-sans-sc`，SIL Open Font License 1.1，可商用、可随包分发）。
- 其余随包字体（Inter、JetBrains Mono、Pixelify Sans、VT323）为上游既有，许可见各自包的 LICENSE。
